import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { activeCreativeProfileIsOwned } from './CreativeProfileRoutes';

type Scope = 'global' | 'feeds' | 'post' | 'room' | 'notifications' | 'rooms' | 'refresh';
type Subscription = { scope: Scope; id?: number };
type Connection = { socket: WebSocket; member: number; privateAccount: boolean; alive: boolean; subscription?: Subscription };
const connections = new Set<Connection>();

/** Events are hints only. History and its authorization stay in the database API. */
export function pushSocialChange(scope: Scope, options: { id?: number; members?: number[]; deletedNotificationId?: number } = {}) {
  const data = JSON.stringify({ scope, ...(options.id ? { id: options.id } : {}),
    ...(scope === 'notifications' && options.deletedNotificationId ? { deletedNotificationId: options.deletedNotificationId } : {}) });
  for (const connection of connections) {
    const { subscription, socket, member, privateAccount } = connection;
    if (!subscription || socket.readyState !== WebSocket.OPEN) continue;
    if (options.members && !options.members.includes(member)) continue;
    if (!privateAccount && (scope === 'room' || scope === 'rooms' || scope === 'notifications')) continue;
    if (scope !== 'refresh' && scope !== 'notifications' &&
      !(scope === 'post' && subscription.scope === 'feeds') &&
      (subscription.scope !== scope || (options.id && subscription.id !== options.id))) continue;
    socket.send(data, error => { if (error) socket.terminate(); });
  }
}

export function attachSocialChatSocket(server: Server, origins: readonly string[]) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const timer = setInterval(() => {
    for (const connection of connections) {
      if (!connection.alive) { connection.socket.terminate(); continue; }
      connection.alive = false;
      connection.socket.ping();
    }
  }, 30_000);
  timer.unref();
  server.once('close', () => {
    clearInterval(timer);
    for (const { socket } of connections) socket.terminate();
  });
  server.on('upgrade', async (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/social/live') return;
    const member = Number(authenticatedUserId(req));
    const owner = authenticatedOwnerId(req);
    if (!req.headers.origin || !origins.includes(req.headers.origin) || !member || !owner) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    try {
      if (!await activeCreativeProfileIsOwned(String(member), owner) || socket.destroyed) {
        socket.destroy();
        return;
      }
    } catch { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, client => {
      const privateAccount = owner !== '1' || process.env.APP_STATE === 'dev';
      const connection: Connection = { socket: client, member, privateAccount, alive: true };
      connections.add(connection);
      client.on('pong', () => { connection.alive = true; });
      client.on('close', () => connections.delete(connection));
      client.on('error', () => client.terminate());
      client.on('message', (raw, binary) => {
        if (binary) { client.close(1003); return; }
        try {
          const message = JSON.parse(raw.toString());
          const { scope, id } = message;
          if (message.member !== member) { client.close(1008, 'Session changed'); return; }
          if (!['global', 'feeds', 'post', 'room', 'notifications', 'rooms'].includes(scope)) return;
          if (!privateAccount && ['room', 'rooms', 'notifications'].includes(scope)) {
            client.send(JSON.stringify({ scope: 'ready' }));
            return;
          }
          if ((scope === 'post' || scope === 'room') && (!Number.isSafeInteger(id) || id < 1)) return;
          connection.subscription = { scope, id };
          client.send(JSON.stringify({ scope: 'ready' }));
        } catch { client.close(1007); }
      });
    });
  });
}
