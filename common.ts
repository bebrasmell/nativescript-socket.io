import { AnyFunction, TCallback } from "./index.types";

export abstract class Common {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract socket: any;

  /** Contains instance of Socket */

  abstract emit<TReq>(event: string, payload: TReq, ack?: AnyFunction): void;

  abstract on<TRes>(event: string, callback: TCallback<TRes>): void;

  abstract once<TRes>(event: string, callback: TCallback<TRes>): void;

  abstract off(event: string): void;

  abstract connected: boolean;

  get disconnected() {
    return !this.connected;
  }

  get instance() {
    return this.socket;
  }

  abstract of(nsp: string): Common;

  public connect(opts?: object) {
    this.socket.connect(opts);
  }

  public disconnect() {
    this.socket.disconnect();
  }
}
