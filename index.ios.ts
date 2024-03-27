/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnyFunction, ISocketConfig, TCallback } from "./index.types";
import { Common } from "./common";

declare const SocketManager: any,
  NSURLComponents: any,
  NSURL: any,
  NSArray: any,
  NSDictionary: any,
  NSNull: any,
  SocketIOStatus: any,
  NSHTTPCookie: any,
  NSHTTPCookieSecure: any,
  NSHTTPCookiePath: any,
  NSHTTPCookieDomain: any,
  NSHTTPCookieExpires: any,
  NSHTTPCookieMaximumAge: any,
  NSHTTPCookieName: any,
  NSHTTPCookieValue: any;

export class SocketIO extends Common {
  protected socket!: SocketIOClient; // TODO: Add type
  private auth_data: unknown;
  private manager!: SocketManager;

  constructor(
    private url: string,
    private config?: ISocketConfig, // TODO: Config interface
    client?: SocketIOClient, // TODO: Add type
  ) {
    super();

    if (!url) throw new Error("URL is required");
    if (client) {
      this.socket = client;
      return;
    }

    const opts = <any>{};

    const parsed = NSURLComponents.alloc().initWithString(this.url);
    const count = parsed.queryItems ? parsed.queryItems.count : 0;
    this.url = parsed;

    const connectParams = <any>{};

    for (let i = 0; i < count; i++) {
      const component = parsed.queryItems.objectAtIndex(i);
      connectParams[component.name] = component.value;
    }

    if (this.config) {
      for (const [key, value] of Object.entries(this.config)) {
        switch (key) {
          case "auth":
            this.auth_data = value;
            break;
          case "query":
            if (!value) break;
            switch (typeof value) {
              case "string": {
                let val = value;

                if (val.startsWith("?")) {
                  val = val.replace("?", "");
                }

                const optionsQuery = val
                  .split("&")
                  .map((p) => p.split("="))
                  .reduce((obj, pair) => {
                    const [key, value] = pair.map(decodeURIComponent);
                    return { ...obj, [key]: value };
                  });

                Object.assign(opts, optionsQuery);
                break;
              }
              case "object":
                for (const [qKey, qValue] of Object.entries(value)) {
                  const value = qValue;
                  opts[qKey] = value;
                }
                break;
              default:
            }
            break;
          case "debug":
            opts.log = value;
            break;
          case "cookie": {
            const cookie = <string>value;
            const props = <any>{};

            props[NSHTTPCookiePath] = "/";
            props[NSHTTPCookieDomain] = `${parsed.scheme}://${parsed.host}`;

            const cookies = cookie.split(";");
            for (const item of cookies) {
              const trimmed = item.trim();
              if (trimmed === "Secure") props[NSHTTPCookieSecure] = true;
              else if (trimmed !== "HttpOnly") {
                if (!trimmed) continue;
                if (!trimmed.includes("=")) continue;

                const keyValItems = trimmed.split("=");
                const key = keyValItems[0];
                const val = keyValItems[1];

                if (cookies.indexOf(item) === 0) {
                  props[NSHTTPCookieName] = key;
                  props[NSHTTPCookieValue] = val;
                } else {
                  switch (key.toLowerCase()) {
                    case "path":
                      props[NSHTTPCookiePath] = val;
                      break;
                    case "domain":
                      props[NSHTTPCookieDomain] = val;
                      break;
                    case "expires":
                      props[NSHTTPCookieExpires] = val;
                      break;
                    case "max-age":
                      props[NSHTTPCookieMaximumAge] = val;
                      break;
                    default:
                  }
                }
              }
            }
            const dict = NSDictionary.dictionaryWithDictionary(props);
            const native = NSHTTPCookie.cookieWithProperties(dict);
            if (native) {
              opts.cookies = NSArray.arrayWithObject(native);
            }
            break;
          }
          case "transports": {
            if (Array.isArray(value) && value.length === 1) {
              if (value.includes("websocket")) opts.forceWebsockets = true;
              else if (value.includes("polling")) opts.forcePolling = true;
            }
            break;
          }
          default:
            opts[key] = value;
            break;
        }
      }
    }

    opts.connectParams = connectParams;

    this.manager = SocketManager.alloc().initWithSocketURLConfig(
      NSURL.URLWithString(this.url),
      opts,
    );

    this.socket = this.manager!.defaultSocket;
  }

  public connect() {
    if (this.connected) return;
    this.socket.connectWithPayload(this.auth_data);
  }

  public disconnect() {
    this.socket.disconnect();
  }

  public get connected(): boolean {
    return this.socket.status === SocketIOStatus.Connected;
  }

  public on<TRes>(event: string, callback: TCallback<TRes>): () => void {
    const uuid = this.socket.onCallback(event, (data: any) => {
      const d = deserialize(data);
      data = Array.isArray(d) ? d[0] : d;
      callback(data);
    });

    return () => this.socket.offWithId(uuid);
  }

  public once<TRes>(event: string, callback: TCallback<TRes>): () => void {
    const uuid = this.socket.onceCallback(event, (data: any) => {
      const d = deserialize(data);
      data = Array.isArray(d) ? d[0] : d;
      callback(data);
    });

    return () => this.socket.offWithId(uuid);
  }

  public off(event: string) {
    this.socket.off(event);
  }

  public emit<TReq>(event: string, payload: TReq, ack?: AnyFunction): void {
    if (!event) throw new Error("Event name is required");

    const final = serialize(payload);

    // Check for ack callback
    if (ack) {
      const e = this.socket.rawEmitView.emitWithAckWith(event, final);
      e?.timingOutAfterCallback(0, function (args: unknown[]) {
        ack(deserialize(args));
      });
    } else {
      // Emit without Ack Callback
      this.socket.rawEmitView.emitWith(event, final);
    }
  }

  public of(namespace: string): SocketIO {
    return new SocketIO(
      this.url,
      this.config,
      this.manager.socketForNamespace(namespace),
    );
  }
}

function serialize(data: any): any {
  switch (typeof data) {
    case "string":
    case "boolean":
    case "number":
      return data;

    case "object": {
      if (data instanceof Date) return data.toJSON();

      if (!data) return NSNull.new();

      if (Array.isArray(data))
        return NSArray.arrayWithArray((<any>data).map(serialize));

      const node = <any>{};

      for (const [key, value] of Object.entries(data)) {
        node[key] = serialize(value);
      }

      return NSDictionary.dictionaryWithDictionary(node);
    }

    default:
      return NSNull.new();
  }
}

function deserialize(data: any): any {
  if (data instanceof NSNull) return null;
  if (data instanceof NSArray) {
    const array = [];
    for (let i = 0, n = data.count; i < n; i++) {
      array[i] = deserialize(data.objectAtIndex(i));
    }
    return array;
  }

  if (data instanceof NSDictionary) {
    const dict = <any>{};
    for (let i = 0, n = data.allKeys.count; i < n; i++) {
      const key = data.allKeys.objectAtIndex(i);
      dict[key] = deserialize(data.objectForKey(key));
    }
    return dict;
  }

  return data;
}

export function io(uri: string, options?: ISocketConfig): SocketIO {
  const socketio = new SocketIO(uri, options);
  socketio.connect();

  return socketio;
}
