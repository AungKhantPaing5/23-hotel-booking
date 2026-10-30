import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/HeaderClient.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
const resolve = name => name === 'next/link' ? { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) } : require(name);
new Function('require', 'exports', compiled)(resolve, exports);
const Header = exports.default;
test('anonymous header offers customer sign in', () => {
  const html = renderToStaticMarkup(React.createElement(Header, {user:null}));
  assert.match(html, /href="\/login"[^>]*>Sign in<\/a>/);
  assert.doesNotMatch(html, />Sign out</);
});
test('signed-in header shows identity and sign out instead of sign in', () => {
  for (const user of [{full_name:'Test Guest',email:'guest@example.com',phone:'+959123456789'}, {full_name:'',email:'guest@example.com',phone:null}]) {
    const html = renderToStaticMarkup(React.createElement(Header,{user}));
    assert.ok(html.includes(user.full_name || user.email));
    assert.match(html, />Sign out<\/button>/);
    assert.doesNotMatch(html, /href="\/login"/);
    assert.match(html, /href="\/my-bookings"/);
  }
});
