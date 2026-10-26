import net from "node:net";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";

// The app reaches Neon over WebSockets, which a plain Postgres does not speak. This turns each WebSocket back into
// a TCP connection to Postgres, which is what Neon's own `wsproxy` does. It listens on this machine only.
export type WsProxy = { ready: Promise<void>; port: () => number; stop: () => Promise<void> };

const asBuffer = (data: RawData): Buffer => (Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as Buffer));

export function startWsProxy({ target, listenPort = 0 }: { target: { host: string; port: number }; listenPort?: number }): WsProxy {
  const server = new WebSocketServer({ host: "127.0.0.1", port: listenPort });

  const ready = new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });

  server.on("connection", (client) => {
    const upstream = net.connect({ host: target.host, port: target.port });
    upstream.setNoDelay(true);
    client.on("message", (data) => upstream.write(asBuffer(data)));
    upstream.on("data", (chunk) => client.send(chunk));
    const close = () => {
      client.terminate();
      upstream.destroy();
    };
    client.on("close", close);
    client.on("error", close);
    upstream.on("close", close);
    upstream.on("error", close);
  });

  return {
    ready,
    port: () => (server.address() as AddressInfo).port,
    stop: async () => {
      for (const client of server.clients) client.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
