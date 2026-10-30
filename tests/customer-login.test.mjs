import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerEmail, customerPhone, customerOtpHash, matchingCustomer } from '../lib/customer-login.ts';
const email = 'guest@example.com';
const phone = '+959123456789';
const account = { id: 'guest-id', email, phone, full_name: 'Guest', is_enabled: true, is_staff: false };
test('local 09 input and existing international numbers identify the same phone', () => {
  assert.equal(customerPhone('09123456789'), phone);
  assert.equal(customerPhone('+959123456789'), phone);
  assert.equal(customerEmail(' Guest@Example.COM '), email);
  for (const invalid of ['09123', '08123456789', '+66123456789', '091234567890']) assert.throws(() => customerPhone(invalid));
  assert.throws(() => customerEmail('invalid'));
});
test('OTP is bound to both email and phone', () => {
  assert.notEqual(customerOtpHash(email,phone,'123456'), customerOtpHash('other@example.com',phone,'123456'));
  assert.notEqual(customerOtpHash(email,phone,'123456'), customerOtpHash(email,'+959987654321','123456'));
});
test('customer OTP cannot claim another email, change an existing phone, or access staff', () => {
  assert.equal(matchingCustomer([account],email,phone),account);
  assert.equal(matchingCustomer([],email,phone),null);
  assert.equal(matchingCustomer([{...account,email:null}],email,phone).id,account.id);
  assert.throws(() => matchingCustomer([account],'other@example.com',phone));
  assert.throws(() => matchingCustomer([account],email,'+959987654321'));
  assert.throws(() => matchingCustomer([{...account,is_staff:true}],email,phone));
  assert.throws(() => matchingCustomer([{...account,is_enabled:false}],email,phone));
  assert.throws(() => matchingCustomer([account,{...account,id:'another'}],email,phone));
});
