import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port = '3011';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
child.stdout.on('data', b => logs += b);
child.stderr.on('data', b => logs += b);
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { await fetch(`http://127.0.0.1:${port}/api/auth/me`); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, `Server did not start: ${logs}`);
  for (const [path, method] of [['/api/auth/me', 'GET'], ['/api/customer/bookings', 'GET'], ['/api/bookings', 'POST'], ['/api/payments/checkout', 'POST']]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, ...(method === 'POST' ? {headers: {'Content-Type': 'application/json'}, body: '{}'} : {}) });
    assert.equal(response.status, 401, `${method} ${path} must reject anonymous access`);
    console.log(`PASS ${method} ${path}: 401`);
  }
} finally { child.kill('SIGTERM'); }
