import { EventEmitter } from 'node:events';
import { expect, test, vi } from 'vitest';
import { attachDeviceInput } from '../src/deviceConnection.ts';
import { MsgType } from '../src/protocol.ts';

function fixture() {
  const ws = new EventEmitter(); ws.close = vi.fn(() => ws.emit('close'));
  let ready; const promise = new Promise(resolve => {ready=resolve;});
  const device = {lastActive:0};
  const router = {handleOpenURLPacketAsync:vi.fn(),handleTouchPacketAsync:vi.fn(),handleFrameStatsPacketAsync:vi.fn()};
  attachDeviceInput(ws,promise,router);
  return {ws,ready:()=>ready(device),device,router};
}

test('initial navigation received before browser readiness is retained', async () => {
  const f=fixture(); const packet=Buffer.from([MsgType.OpenURL,1]);
  f.ws.emit('message',packet,true);
  expect(f.router.handleOpenURLPacketAsync).not.toHaveBeenCalled();
  f.ready();
  await vi.waitFor(()=>expect(f.router.handleOpenURLPacketAsync).toHaveBeenCalledWith(f.device,packet));
});

test('touch waits for preceding navigation to finish', async () => {
  const f=fixture(); let finish;
  f.router.handleOpenURLPacketAsync.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  f.ws.emit('message',Buffer.from([MsgType.OpenURL,1]),true);
  f.ws.emit('message',Buffer.from([MsgType.Touch,1]),true); f.ready();
  await vi.waitFor(()=>expect(f.router.handleOpenURLPacketAsync).toHaveBeenCalled());
  expect(f.router.handleTouchPacketAsync).not.toHaveBeenCalled();
  finish(); await vi.waitFor(()=>expect(f.router.handleTouchPacketAsync).toHaveBeenCalled());
});

test('closing during preparation cancels pending navigation', async () => {
  const f=fixture(); f.ws.emit('message',Buffer.from([MsgType.OpenURL,1]),true);
  f.ws.emit('close'); f.ready(); await new Promise(resolve=>setTimeout(resolve,10));
  expect(f.router.handleOpenURLPacketAsync).not.toHaveBeenCalled();
});

test('startup input queue is bounded', () => {
  const f=fixture(); for(let n=0;n<257;n++) f.ws.emit('message',Buffer.from([MsgType.Touch,1]),true);
  expect(f.ws.close).toHaveBeenCalledWith(1008,'Input queue full'); f.ready();
});
