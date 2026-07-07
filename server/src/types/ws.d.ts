// Minimal type declarations for the "ws" package (already present in node_modules
// as a transitive dependency). Replace with @types/ws when it can be installed.
declare module "ws" {
    import { EventEmitter } from "events";
    import { IncomingMessage } from "http";
    import { Duplex } from "stream";

    export type RawData = Buffer | ArrayBuffer | Buffer[];

    export class WebSocket extends EventEmitter {
        static readonly CONNECTING: 0;
        static readonly OPEN: 1;
        static readonly CLOSING: 2;
        static readonly CLOSED: 3;
        readonly readyState: 0 | 1 | 2 | 3;
        constructor(address: string, options?: { headers?: Record<string, string> });
        send(data: string | Buffer | ArrayBuffer | Uint8Array, cb?: (err?: Error) => void): void;
        close(code?: number, reason?: string): void;
        terminate(): void;
        ping(data?: unknown): void;
        on(event: "open", listener: () => void): this;
        on(event: "close", listener: (code: number, reason: Buffer) => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "message", listener: (data: RawData, isBinary: boolean) => void): this;
        on(event: string, listener: (...args: any[]) => void): this;
    }

    export class WebSocketServer extends EventEmitter {
        constructor(options: { noServer?: boolean });
        handleUpgrade(
            request: IncomingMessage,
            socket: Duplex,
            head: Buffer,
            callback: (client: WebSocket) => void
        ): void;
    }
}
