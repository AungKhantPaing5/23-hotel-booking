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
  const session = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
  assert.match(session.headers.get('cache-control') || '', /no-store/);
  const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {method:'POST'});
  assert.equal(logout.status,200);
  assert.match(logout.headers.get('set-cookie') || '', /23hotel_session=;/);
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/i);
  console.log('PASS session is not cached and logout clears its cookie');
  const guestPage = await (await fetch(`http://127.0.0.1:${port}/login`)).text();
  assert.ok(guestPage.includes('EMAIL ADDRESS'));
  assert.ok(!guestPage.includes('Staff · Email'));
  assert.ok(guestPage.includes('type="password"'), 'Returning customers sign in with password');
  assert.ok(!guestPage.includes('Sign in to staff portal'), 'Customer page must not expose staff login');
  for (const next of ['/admin', '/admin/bookings']) {
    const url = `http://127.0.0.1:${port}/login?${new URLSearchParams({next})}`;
    const original = await fetch(url, {redirect:'manual'});
    assert.equal(original.status,307);
    const destination = new URL(original.headers.get('location'), url);
    assert.equal(destination.pathname,'/staff/login');
    assert.equal(destination.searchParams.get('next'),next);
    const oldAdminLink = await (await fetch(url)).text();
    assert.ok(oldAdminLink.includes('type="password"'), 'Old admin links must open password login');
    assert.ok(!oldAdminLink.includes('type="tel"'), 'Old admin links must never ask for a phone');
  }
  console.log('PASS old admin login links redirect to email/password login');
  assert.ok(!guestPage.includes('type="tel"'), 'Returning customers do not enter a phone number');
  const staffPage = await (await fetch(`http://127.0.0.1:${port}/staff/login?next=/admin`)).text();
  assert.ok(staffPage.includes('Sign in to staff portal'));
  assert.ok(staffPage.includes('type="password"'));
  assert.ok(!staffPage.includes('type="tel"'), 'Staff login must not request a phone');
  console.log('PASS returning guest and staff email/password forms without phone');
  for (const path of ['/api/auth/otp/request', '/api/auth/otp/verify']) {
    for (const body of [{phone:'09123456789',code:'123456'}, {email:'guest@example.com',phone:'08123456789',code:'123456'}]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.status,400,'Missing email or invalid Myanmar phone must fail before database access');
    }
  }
  console.log('PASS OTP input validation');
  const invalidLogin=await fetch(`http://127.0.0.1:${port}/api/auth/customer-login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(invalidLogin.status,400);
  const badAvailability=await fetch(`http://127.0.0.1:${port}/api/public/room-availability?roomId=bad&checkIn=wrong`);
  assert.equal(badAvailability.status,400);
  const unauthorizedInventory=await fetch(`http://127.0.0.1:${port}/api/admin/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(unauthorizedInventory.status,401);
  console.log('PASS inventory endpoints validate dates and protect admin edits');
  const logo=await fetch(`http://127.0.0.1:${port}/brand/hotel-logo.jpg`);
  assert.equal(logo.status,200);assert.match(logo.headers.get('content-type') || '',/image\/jpeg/);assert.ok((await logo.arrayBuffer()).byteLength>1000);
  console.log('PASS supplied hotel logo is served');
  const publicPage=await fetch(`http://127.0.0.1:${port}/payment/return`);
  assert.equal(publicPage.status,200);
  assert.ok((await publicPage.text()).includes('aria-label="Open support chat"'),'Customer pages include a floating support button');
  assert.ok(!guestPage.includes('aria-label="Open support chat"'),'Login pages do not display the chat widget');
  for(const path of ['/api/support/chat','/api/admin/support']){
    const response=await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status,401);
    assert.match(response.headers.get('cache-control') || '',/no-store/);
  }
  console.log('PASS support widget visibility and private chat API authentication');
} finally { child.kill('SIGTERM'); }
