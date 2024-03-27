export type AnyFunction = (d: unknown) => void;
export type TCallback<TRes> = (
  data: TRes,
  // ack?: (res: unknown) => void,
) => void;

export interface ISocketConfig {
  cookie?: string[];
  extraHeaders?: Record<string, string>;
  auth: unknown;
  query: string | Record<string, string>;
  transports: string[];
  debug: boolean;
}
