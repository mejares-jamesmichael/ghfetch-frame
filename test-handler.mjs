import fs from 'fs';

// Mock global fetch before importing the handler, so the handler's
// internal `await fetch(sourceUrl)` call resolves with our fixture
// instead of hitting the network.
const sampleSvg = fs.readFileSync(new URL('./frame-test/sample.svg', import.meta.url), 'utf8');

global.fetch = async (url) => {
  console.log('[mock fetch] called with:', url);
  return {
    ok: true,
    headers: new Map([['content-type', 'image/svg+xml']]),
    text: async () => sampleSvg,
  };
};

// Patch headers.get since Map doesn't have .get returning undefined properly for missing keys in this mock — it does actually, Map.get works fine.

const { default: handler } = await import('./api/frame.js');

function makeRes() {
  const res = {
    _status: null,
    _headers: {},
    _body: null,
    status(code) { this._status = code; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    send(body) { this._body = body; },
  };
  return res;
}

// Test 1: missing url param
{
  const req = { query: {} };
  const res = makeRes();
  await handler(req, res);
  console.log('\n=== Test 1: missing url ===');
  console.log('status:', res._status, '(expect 400)');
  console.log('body:', res._body);
}

// Test 2: valid url, default label
{
  const req = { query: { url: encodeURIComponent('https://neofetch-profile.vercel.app/api?username=test') } };
  const res = makeRes();
  await handler(req, res);
  console.log('\n=== Test 2: valid url, default label ===');
  console.log('status:', res._status, '(expect 200)');
  console.log('content-type header:', res._headers['Content-Type']);
  console.log('cache-control header:', res._headers['Cache-Control']);
  console.log('body length:', res._body.length);
  fs.writeFileSync(new URL('./handler-test-output.svg', import.meta.url), res._body);
  console.log('wrote handler-test-output.svg');
}

// Test 3: custom label + colors
{
  const req = { query: {
    url: encodeURIComponent('https://neofetch-profile.vercel.app/api?username=test'),
    label: 'root@archlinux',
    bg: '#000000',
  } };
  const res = makeRes();
  await handler(req, res);
  console.log('\n=== Test 3: custom label/colors ===');
  console.log('status:', res._status, '(expect 200)');
  console.log('contains custom label:', res._body.includes('root@archlinux'));
  console.log('contains custom bg:', res._body.includes('#000000'));
}

// Test 4: invalid url scheme rejected
{
  const req = { query: { url: 'javascript:alert(1)' } };
  const res = makeRes();
  await handler(req, res);
  console.log('\n=== Test 4: invalid url scheme ===');
  console.log('status:', res._status, '(expect 400)');
}

// Test 5: wrong host rejected
{
  const req = { query: { url: encodeURIComponent('https://evil.example.com/steal.svg') } };
  const res = makeRes();
  await handler(req, res);
  console.log('\n=== Test 5: wrong host ===');
  console.log('status:', res._status, '(expect 400)');
  console.log('body:', res._body);
}
