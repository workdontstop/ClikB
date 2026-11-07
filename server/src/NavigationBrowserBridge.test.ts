import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { navigationBrowserReply, requestNavigationBrowser } from './NavigationBrowserBridge';

test('browser command is correlated to one reply and cannot be replayed', async () => {
  let command: any;
  const waiting = requestNavigationBrowser(message => { command = message; }, 'action', 'clikb.settings.action.theme_light', 7);
  assert.equal(command.command, 'action');
  assert.equal(command.expectedVersion, 7);
  assert.ok(command.requestId);
  const responses: Array<{ code: number; body: any }> = [];
  const response = (code = 200): Response => ({
    status(next: number) { return response(next); },
    json(body: any) { responses.push({ code, body }); return this; },
  } as unknown as Response);
  const reply = { status: 'observed_change', snapshot: { navigation: { stateVersion: 8 } } };
  navigationBrowserReply({ body: { requestId: command.requestId, reply } } as Request, response());
  assert.deepEqual(await waiting, reply);
  navigationBrowserReply({ body: { requestId: command.requestId, reply } } as Request, response());
  assert.equal(responses.at(-1)?.code, 410);
});
