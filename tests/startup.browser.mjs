// Run inside the built image: send the URL immediately when a display connects.
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { chromium } from 'playwright-core';

const url = 'http://127.0.0.1:18082/login';
const fixture = http.createServer((req,res) => {
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><label>Username<input></label><label>Password<input type="password"></label>');
});
await new Promise(resolve => fixture.listen(18082,'127.0.0.1',resolve));
let log = '', ws, browser;
const server = spawn('node',['dist/index.js'], {cwd:'/app',env:{...process.env,
  TOUCH_KEYBOARD_ENABLED:'true',USER_DATA_DIR:'/tmp/rwv-startup-test',WS_PORT:'8081',DEBUG_PORT:'9222',HEALTH_PORT:'18080'}});
server.stdout.on('data',chunk=>{log=(log+chunk).slice(-6000);});
server.stderr.on('data',chunk=>{log=(log+chunk).slice(-6000);});
try {
  const deadline = Date.now()+25000;
  for (;;) {
    try {if((await fetch('http://127.0.0.1:18080')).ok)break;} catch {}
    if(server.exitCode!==null || Date.now()>deadline)throw new Error('Server bootstrap failed: '+log);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Initial display URL was not retained: '+log)),10000);
    ws=new WebSocket('ws://127.0.0.1:8081/?id=startup-test&w=480&h=480');
    ws.once('error',reject);
    ws.once('open',()=>{
      const bytes=Buffer.from(url);const packet=Buffer.alloc(8+bytes.length);
      packet[0]=4;packet[1]=1;packet.writeUInt32LE(bytes.length,4);bytes.copy(packet,8);
      ws.send(packet);
    });
    ws.on('message',(raw,binary)=>{
      if(!binary || raw[0]!==6 || raw.length<6)return;
      const current=raw.subarray(6,6+raw.readUInt32LE(2)).toString();
      if(current===url){clearTimeout(timer);resolve();}
    });
  });
  const targets=await fetch('http://127.0.0.1:9222/json/list').then(r=>r.json());
  assert(targets.some(t=>t.url===url));
  browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page=browser.contexts()[0].pages().find(p=>p.url()===url);
  assert(page); await page.waitForSelector('#rwv-touch-keyboard');
  await page.getByLabel('Username').focus();
  const cdp=await page.context().newCDPSession(page);
  async function tap(name){
    const box=await page.getByRole('button',{name,exact:true}).boundingBox();assert(box);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await tap('Open touch keyboard');await tap('a');
  await page.waitForFunction(()=>document.querySelector('input').value==='a');
  await tap('⌫');await page.waitForFunction(()=>document.querySelector('input').value==='');
  await tap('Close');
  console.log('PASS: the actual built server injects the keyboard and accepts native typing through its CDP session.');
  console.log('PASS: initial navigation sent immediately on connection reaches the built-image browser.');
} finally {
  await browser?.close(); ws?.terminate(); server.kill('SIGTERM');
  // Chromium can inherit the child's output descriptors. Release our handles
  // so the test container exits and cleans up its remaining browser processes.
  server.stdin.destroy(); server.stdout.destroy(); server.stderr.destroy();
  server.unref(); fixture.close();
}
