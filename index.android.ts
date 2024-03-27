/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnyFunction, ISocketConfig, TCallback } from "./index.types";
import { Common } from "./common";

declare const co: any, java: any, io: any, android: any, org: any;

export class SocketIO extends Common {
  protected socket!: io.socket.client.Socket;
  private auth_data: unknown;

  constructor(
    private url: string,
    private config?: ISocketConfig, // TODO: Config interface
    private manager?: any, // TODO: Add type
  ) {
    super();

    if (!url) throw new Error("URL is required");
    if (this.manager) {
      this.socket = manager;
      return;
    }

    const opts = io.socket.client.SocketOptionBuilder.builder();
    opts.setMultiplex(true);

    if (this.config) {
      const options = this.config || <any>{};

      for (const [key, val] of Object.entries(options)) {
        switch (key) {
          case "auth": {
            this.auth_data = val;
            const cookies = options["cookie"];
            const extraHeaders = options["extraHeaders"];
            const headers = java.util.Collections.emptyMap();
            if (cookies) {
              if (headers && headers.put) {
                const list = new java.util.ArrayList(
                  java.util.Arrays.asList(cookies),
                );
                headers.put("Cookie", list);
              }
            }

            if (extraHeaders && headers && headers.put) {
              for (const [key, value] of Object.entries(extraHeaders)) {
                const list = new java.util.ArrayList();
                list.add(value);
                headers.put(key, list);
              }
            }

            if (!headers.isEmpty()) opts.setExtraHeaders(headers);
            break;
          }
          case "query": {
            switch (typeof val) {
              case "object": {
                const uri = android.net.Uri.parse(this.url);
                const uriBuilder = uri.buildUpon();

                for (const [qKey, qVal] of Object.entries(val)) {
                  uriBuilder.appendQueryParameter(qKey, qVal);
                }

                opts.setQuery(uriBuilder.build().getQuery());
                break;
              }
              case "string":
                opts.setQuery(val);
                break;
            }
            break;
          }
          case "debug":
            if (!val) break;

            co.fitcom.fancylogger.FancyLogger.reset(
              new co.fitcom.fancylogger.FancyLogger(),
            );

            java.util.logging.Logger.getLogger(
              io.socket.client.Socket.class.getName(),
            ).setLevel(java.util.logging.Level.FINEST);

            java.util.logging.Logger.getLogger(
              io.socket.client.Manager.class.getName(),
            ).setLevel(java.util.logging.Level.FINEST);

            break;
          case "transports": {
            const array = (Array as any).create("java.lang.String", val.length);

            for (let i = 0; i < val.length; i++) array[i] = val[i];

            opts.setTransports(array);
            break;
          }
          default:
            // opts.set(key, val);
            break;
        }
      }
    }

    this.socket = io.socket.client.IO.socket(this.url, opts.build());
  }

  connect() {
    if (this.connected) return;

    this.socket.connect();
    // this.socket.connect(this.auth_data);
  }

  disconnect() {
    this.socket.disconnect();
  }

  get connected(): boolean {
    return this.socket && this.socket.connected();
  }

  on<TRes>(event: string, callback: TCallback<TRes>): () => void {
    const listener = new io.socket.emitter.Emitter.Listener({
      call(...args: unknown[]) {
        let payload = Array.prototype.slice.call(args);
        let ack = payload.pop();

        if (
          ack &&
          !(
            ack.getClass().getName().indexOf("io.socket.client.Socket") === 0 &&
            ack.call
          )
        ) {
          payload.push(ack);
          ack = null;
        }

        payload = payload.map(deserialize);

        if (ack) {
          const _ack = function () {
            const _args = Array.prototype.slice.call(args);
            ack.call(_args.map(serialize));
          };
          payload.push(_ack);
        }

        callback(payload as TRes);
      },
    });

    this.socket.on(event, listener);

    return () => this.socket.off(event, listener);
  }

  once<TRes>(event: string, callback: TCallback<TRes>): () => void {
    const listener = new io.socket.emitter.Emitter.Listener({
      call(...args: unknown[]) {
        let payload = Array.prototype.slice.call(args);
        let ack = payload.pop();
        if (
          ack &&
          !(
            ack.getClass().getName().indexOf("io.socket.client.Socket") === 0 &&
            ack.call
          )
        ) {
          payload.push(ack);
          ack = null;
        }

        payload = payload.map(deserialize);

        if (ack) {
          const _ack = function () {
            const _args = Array.prototype.slice.call(args);
            ack.call(_args.map(serialize));
          };
          payload.push(_ack);
        }

        callback(payload as TRes);
      },
    });

    this.socket.once(event, listener);

    return () => this.socket.off(event, listener);
  }

  off(event: string) {
    this.socket.off(event);
  }

  emit<TReq>(event: string, payload: TReq, ack?: AnyFunction): void {
    if (!event) throw Error("Event name is required");

    // Serialize Emit
    const final = serialize(payload);

    if (ack) {
      final.push(
        new io.socket.client.Ack({
          call: function (...args: unknown[]) {
            args = Array.prototype.slice.call(args);
            ack(args.map(deserialize));
          },
        }),
      );
    }

    // Emit
    this.socket.emit(event, final);
  }

  of(nsp: string): SocketIO {
    const manager = this.socket.io();

    const socket = manager.socket(nsp);
    const namespaceSocket = new SocketIO(this.url, this.config, socket);

    if (this.socket.connected()) {
      // Only join if currently connected. Otherwise just configure to join on connect.
      // This mirrors IOS behavior
      namespaceSocket.connect();
    }
    return namespaceSocket;
  }
}

export function serialize(data: any): any {
  let store: any;

  switch (typeof data) {
    case "string":
    case "boolean":
    case "number": {
      return data;
    }

    case "object": {
      if (!data) {
        return null;
      }

      if (data instanceof Date) return data.toJSON();

      if (Array.isArray(data)) {
        store = new org.json.JSONArray();

        for (const item of data) {
          store.put(serialize(item));
        }

        return store;
      }

      store = new org.json.JSONObject();
      for (const [key, value] of Object.entries(data)) {
        store.put(key, serialize(value));
      }

      return store;
    }

    default:
      return null;
  }
}

export function deserialize(data: any): any {
  if (!data || typeof data !== "object") return data;

  let store: any;
  switch (data.getClass().getName()) {
    case "java.lang.String":
      return String(data);

    case "java.lang.Boolean":
      return String(data) === "true";

    case "java.lang.Integer":
    case "java.lang.Long":
    case "java.lang.Double":
    case "java.lang.Short":
      return Number(data);

    case "org.json.JSONArray": {
      store = [];

      for (let j = 0; j < data.length(); j++) {
        store[j] = deserialize(data.get(j));
      }

      break;
    }

    case "org.json.JSONObject": {
      store = {};

      const i = data.keys();
      while (i.hasNext()) {
        const key = i.next();
        store[key] = deserialize(data.get(key));
      }
      break;
    }

    default:
      store = undefined;
  }
  return store;
}

export function _io(uri: string, options?: any): SocketIO {
  const socketio = new SocketIO(uri, options);
  socketio.connect();

  return socketio;
}
