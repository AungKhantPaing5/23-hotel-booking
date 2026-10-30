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
  const guestPage = await (await fetch(`http://127.0.0.1:${port}/login`)).text();
  assert.ok(guestPage.includes('EMAIL ADDRESS'));
  assert.ok(!guestPage.includes('Staff · Email'));
  assert.ok(!guestPage.includes('type="password"'), 'Customer page must not include staff login');
  const oldAdminLink = await (await fetch(`http://127.0.0.1:${port}/login?next=/admin`)).text();
  assert.ok(!oldAdminLink.includes('type="password"'), 'Query parameters cannot enable staff form on customer login');
  assert.ok(!guestPage.includes('type="tel"'), 'Guest enters email before phone');
  const staffPage = await (await fetch(`http://127.0.0.1:${port}/staff/login?next=/admin`)).text();
  assert.ok(staffPage.includes('Sign in to staff portal'));
  assert.ok(staffPage.includes('type="password"'));
  assert.ok(!staffPage.includes('type="tel"'), 'Staff login must not request a phone');
  console.log('PASS guest email-first and staff password-only forms');
  for (const path of ['/api/auth/otp/request', '/api/auth/otp/verify']) {
    for (const body of [{phone:'09123456789',code:'123456'}, {email:'guest@example.com',phone:'08123456789',code:'123456'}]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.status,400,'Missing email or invalid Myanmar phone must fail before database access');
    }
  }
  console.log('PASS OTP input validation');
} finally { child.kill('SIGTERM'); }
