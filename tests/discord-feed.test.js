'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const SITE_ORIGIN = 'https://turbodesigns.net';
const BOT_ORIGIN = 'https://bot-production-d58c.up.railway.app';
const CALLBACK = `${SITE_ORIGIN}/auth/discord/callback`;
const TEST_SECRET = 'unit-tests-only-discord-request-secret-2026';
const VERIFIED_USER = { id: '1531989453168578666', username: 'verified.creator' };
const TICKET_URL = 'https://discord.com/channels/1531989453168578650/1550470999999999999';

function request(url, options = {}) {
  const {
    method = 'GET', body, rawBody, cookie = '', ip = '192.0.2.10',
    headers = {},
  } = options;
  const content = rawBody === undefined ? (body === undefined ? '' : JSON.stringify(body)) : rawBody;
  const req = Readable.from(content ? [Buffer.from(content)] : []);
  req.url = url;
  req.method = method;
  req.headers = {
    ...(method === 'POST' ? { origin: SITE_ORIGIN, 'content-type': 'application/json' } : {}),
    ...(cookie ? { cookie } : {}),
    ...headers,
  };
  req.socket = { remoteAddress: ip };
  return req;
}

async function invoke(handler, url, options) {
  const response = {
    status: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(status, headers) {
      this.status = status;
      for (const [name, value] of Object.entries(headers || {})) this.setHeader(name, value);
    },
    end(body = '') { this.body += body; },
  };
  await handler(request(url, options), response);
  response.json = response.body ? JSON.parse(response.body) : null;
  return response;
}

function cookieValue(response, name) {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies]).find(value => value.startsWith(`${name}=`));
  assert.ok(cookie, `Expected ${name} cookie`);
  return cookie.split(';')[0];
}

function assertPrivateCookie(response, name) {
  const cookies = response.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies]).find(value => value.startsWith(`${name}=`));
  assert.ok(cookie);
  assert.match(cookie, /; Path=\//);
  assert.match(cookie, /; HttpOnly(?:;|$)/);
  assert.match(cookie, /; Secure(?:;|$)/);
  assert.match(cookie, /; SameSite=Lax(?:;|$)/);
  assert.doesNotMatch(cookie, /Domain=/i);
}

function assertSignedBotCall(call) {
  const route = new URL(call.url).pathname;
  const timestamp = call.headers['x-turbo-timestamp'];
  assert.match(timestamp, /^\d{13}$/);
  const expected = crypto.createHmac('sha256', TEST_SECRET)
    .update(`${timestamp}:${call.method}:${route}:${call.body || ''}`)
    .digest('hex');
  assert.equal(call.headers['x-turbo-signature'], expected);
  assert.equal(call.redirect, 'error');
}

function harness(t) {
  const saved = {
    secret: process.env.WEBSITE_REQUEST_SECRET,
    fetch: global.fetch,
    now: Date.now,
  };
  const modulePath = require.resolve('../discord-feed');
  process.env.WEBSITE_REQUEST_SECRET = TEST_SECRET;
  delete require.cache[modulePath];
  const app = require('../discord-feed');
  const state = {
    app,
    now: 1791806400000,
    calls: [],
    user: { ...VERIFIED_USER },
    advance(milliseconds) { this.now += milliseconds; },
    responseFor(call) {
      const path = new URL(call.url).pathname;
      if (path === '/turbo-website-oauth' && call.method === 'GET') {
        return { ready: true, clientId: '1531989453168578777', redirectUri: CALLBACK };
      }
      if (path === '/turbo-website-oauth' && call.method === 'POST') {
        return { ok: true, user: this.user };
      }
      if (path === '/turbo-website-requests' && call.method === 'GET') return { ready: true };
      if (path === '/turbo-website-requests' && call.method === 'POST') {
        return { ok: true, reference: 'WEB-A1B2C3D4', ticketUrl: TICKET_URL };
      }
      throw new Error(`Unexpected mocked request: ${call.method} ${path}`);
    },
    orderCalls() {
      return this.calls.filter(call => call.method === 'POST' && new URL(call.url).pathname === '/turbo-website-requests');
    },
    exchangeCalls() {
      return this.calls.filter(call => call.method === 'POST' && new URL(call.url).pathname === '/turbo-website-oauth');
    },
  };
  Date.now = () => state.now;
  global.fetch = async (url, options = {}) => {
    assert.equal(new URL(url).origin, BOT_ORIGIN, 'Tests must never use a live Discord endpoint');
    const call = { url: String(url), ...options, method: options.method || 'GET' };
    state.calls.push(call);
    const data = await state.responseFor(call);
    return { ok: true, status: 200, json: async () => data };
  };
  t.after(() => {
    global.fetch = saved.fetch;
    Date.now = saved.now;
    if (saved.secret === undefined) delete process.env.WEBSITE_REQUEST_SECRET;
    else process.env.WEBSITE_REQUEST_SECRET = saved.secret;
    delete require.cache[modulePath];
  });
  return state;
}

async function startLogin(h) {
  const start = await invoke(h.app.handleAuth, '/auth/discord');
  assert.equal(start.status, 303);
  const authorization = new URL(start.headers.location);
  assert.equal(authorization.origin, 'https://discord.com');
  return { start, authorization, stateCookie: cookieValue(start, '__Host-turbo_state') };
}

async function finishLogin(h, started) {
  const state = started.authorization.searchParams.get('state');
  return invoke(h.app.handleAuth, `/auth/discord/callback?code=test-authorization-code&state=${state}`, {
    cookie: started.stateCookie,
  });
}

async function login(h) {
  const started = await startLogin(h);
  const callback = await finishLogin(h, started);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.location, '/#anfrage');
  return { ...started, callback, cookie: cookieValue(callback, '__Host-turbo_account') };
}

async function challenge(h, cookie, options = {}) {
  const response = await invoke(h.app.handleRequests, '/api/discord-requests/status', { cookie, ...options });
  assert.equal(response.status, 200);
  assert.equal(response.json.ready, true);
  assert.equal(response.json.loginRequired, false);
  assert.equal(typeof response.json.token, 'string');
  return response.json.token;
}

function order(token, changes = {}) {
  return { product: 'thumbnail', project: 'Blue thumbnail for my next video', consent: true, token, ...changes };
}

test('ordering requires an authenticated account and never calls the bot for anonymous POSTs', async t => {
  const h = harness(t);
  const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', body: order('forged', { contact: 'someone', discordUserId: VERIFIED_USER.id }),
  });
  assert.equal(response.status, 401);
  assert.equal(response.json.error, 'AUTH_REQUIRED');
  assert.equal(h.calls.length, 0);
});

test('anonymous status advertises login without issuing a submission challenge', async t => {
  const h = harness(t);
  const response = await invoke(h.app.handleRequests, '/api/discord-requests/status');
  assert.deepEqual(response.json, { ready: false, loginRequired: true, loginAvailable: true });
  assert.equal(h.orderCalls().length, 0);
  assert.equal(h.calls.length, 1);
  assert.equal(new URL(h.calls[0].url).pathname, '/turbo-website-oauth');
  assertSignedBotCall(h.calls[0]);
});

test('OAuth delegates its code exchange to the signed bot route using identify scope', async t => {
  const h = harness(t);
  const account = await login(h);
  assert.equal(account.authorization.searchParams.get('scope'), 'identify');
  assert.equal(account.authorization.searchParams.get('response_type'), 'code');
  assert.equal(account.authorization.searchParams.get('redirect_uri'), CALLBACK);
  assert.equal(h.calls.length, 2);
  for (const call of h.calls) assertSignedBotCall(call);
  assert.deepEqual(JSON.parse(h.exchangeCalls()[0].body), {
    code: 'test-authorization-code', redirectUri: CALLBACK,
  });
  assertPrivateCookie(account.start, '__Host-turbo_state');
  assertPrivateCookie(account.callback, '__Host-turbo_account');
  assert.doesNotMatch(account.cookie, /verified\.creator|1531989453168578666/);
  const visibleAccount = await invoke(h.app.handleAuth, '/api/discord-account', { cookie: account.cookie });
  assert.deepEqual(visibleAccount.json, { loginAvailable: true, user: VERIFIED_USER });
});

test('OAuth rejects state mismatches, missing state cookies and consumed-state replay', async t => {
  const h = harness(t);
  const started = await startLogin(h);
  const mismatch = await invoke(h.app.handleAuth, '/auth/discord/callback?code=test&state=wrong', {
    cookie: started.stateCookie,
  });
  assert.equal(mismatch.headers.location, '/?discord=failed#anfrage');
  const missingCookie = await invoke(h.app.handleAuth,
    `/auth/discord/callback?code=test&state=${started.authorization.searchParams.get('state')}`);
  assert.equal(missingCookie.headers.location, '/?discord=failed#anfrage');
  assert.equal(h.exchangeCalls().length, 0);
  const accepted = await finishLogin(h, started);
  assert.equal(accepted.headers.location, '/#anfrage');
  const replay = await finishLogin(h, started);
  assert.equal(replay.headers.location, '/?discord=failed#anfrage');
  assert.equal(h.exchangeCalls().length, 1);
});

test('expired OAuth state cannot create an account or exchange a code', async t => {
  const h = harness(t);
  const started = await startLogin(h);
  h.advance(600001);
  const response = await finishLogin(h, started);
  assert.equal(response.headers.location, '/?discord=failed#anfrage');
  assert.equal(h.exchangeCalls().length, 0);
});

test('OAuth configuration with an unexpected callback keeps sign-in unavailable', async t => {
  const h = harness(t);
  h.responseFor = () => ({ ready: true, clientId: '1531989453168578777', redirectUri: 'https://other.example/callback' });
  const response = await invoke(h.app.handleAuth, '/auth/discord');
  assert.equal(response.headers.location, '/?discord=unavailable#anfrage');
  assert.equal(response.headers['set-cookie'], undefined);
});

test('tampered and expired account cookies cannot authenticate a request', async t => {
  const h = harness(t);
  const account = await login(h);
  const [name, value] = account.cookie.split('=');
  const changedFirstCharacter = value[0] === 'A' ? 'B' : 'A';
  assert.equal(h.app.readAccount(request('/', { cookie: `${name}=${changedFirstCharacter}${value.slice(1)}` })), null);
  h.advance(21600001);
  assert.equal(h.app.readAccount(request('/', { cookie: account.cookie })), null);
  const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie, body: order('token'),
  });
  assert.equal(response.status, 401);
  assert.equal(h.orderCalls().length, 0);
});

test('authenticated orders use verified identity instead of client-supplied contact or user ID', async t => {
  const h = harness(t);
  const account = await login(h);
  const token = await challenge(h, account.cookie);
  h.advance(3000);
  const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie,
    body: order(token, { contact: 'forged.contact', discordUserId: '1550470888888888888', price: 0, role: 'admin' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { ok: true, reference: 'WEB-A1B2C3D4', ticketUrl: TICKET_URL });
  assert.equal(h.orderCalls().length, 1);
  const submitted = JSON.parse(h.orderCalls()[0].body);
  assert.equal(submitted.contact, VERIFIED_USER.username);
  assert.equal(submitted.discordUserId, VERIFIED_USER.id);
  assert.equal(submitted.product, 'thumbnail');
  assert.equal(submitted.price, undefined);
  assert.equal(submitted.role, undefined);
  assertSignedBotCall(h.orderCalls()[0]);
});

test('submission challenges require a three-second age before an order can be sent', async t => {
  const h = harness(t);
  const account = await login(h);
  const token = await challenge(h, account.cookie);
  h.advance(2999);
  const early = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie, body: order(token),
  });
  assert.equal(early.status, 409);
  assert.equal(early.json.error, 'EXPIRED_TOKEN');
  assert.equal(h.orderCalls().length, 0);
  h.advance(1);
  const accepted = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie, body: order(token),
  });
  assert.equal(accepted.status, 200);
});

test('submission challenges are bound to both verified account and IP address', async t => {
  const h = harness(t);
  const first = await login(h);
  const token = await challenge(h, first.cookie);
  h.user = { id: '1531989453168578888', username: 'another.creator' };
  const second = await login(h);
  h.advance(3000);
  const differentAccount = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: second.cookie, body: order(token),
  });
  const differentIp = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: first.cookie, ip: '192.0.2.20', body: order(token),
  });
  assert.equal(differentAccount.status, 409);
  assert.equal(differentIp.status, 409);
  assert.equal(differentAccount.json.error, 'EXPIRED_TOKEN');
  assert.equal(differentIp.json.error, 'EXPIRED_TOKEN');
  assert.equal(h.orderCalls().length, 0);
});

test('expired submission challenges and modified signatures do not reach the order endpoint', async t => {
  const h = harness(t);
  const account = await login(h);
  const token = await challenge(h, account.cookie);
  h.advance(3000);
  const modified = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
  const badSignature = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie, body: order(modified),
  });
  assert.equal(badSignature.status, 409);
  h.advance(7200001);
  const expired = await invoke(h.app.handleRequests, '/api/discord-requests', {
    method: 'POST', cookie: account.cookie, body: order(token),
  });
  // The six-hour account remains valid after a two-hour challenge expires.
  assert.equal(expired.status, 409);
  assert.equal(expired.json.error, 'EXPIRED_TOKEN');
  assert.equal(h.orderCalls().length, 0);
});

test('tool orders accept only the three published plans and partnership remains a distinct request', t => {
  const h = harness(t);
  for (const plan of ['lifetime', 'month', 'week']) {
    const validated = h.app.validateWebsiteRequest(order('unused', { product: 'soundpack-tool', plan }));
    assert.equal(validated.product, 'soundpack-tool');
    assert.equal(validated.plan, plan);
  }
  for (const plan of ['', 'annual', '__proto__', 'LIFETIME']) {
    assert.throws(() => h.app.validateWebsiteRequest(order('unused', { product: 'soundpack-tool', plan })), /INVALID_REQUEST/);
  }
  const partnership = h.app.validateWebsiteRequest(order('unused', { product: 'partnership', plan: 'month' }));
  assert.equal(partnership.product, 'partnership');
  assert.equal(partnership.plan, undefined);
  assert.deepEqual(h.app.TOOL_PLANS, { week: 10, month: 15, lifetime: 20 });
});

test('authenticated tool and partnership submissions retain their selected product and plan', async t => {
  const h = harness(t);
  const account = await login(h);
  for (const selected of [{ product: 'soundpack-tool', plan: 'month' }, { product: 'partnership' }]) {
    const token = await challenge(h, account.cookie);
    h.advance(3000);
    const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
      method: 'POST', cookie: account.cookie, body: order(token, selected),
    });
    assert.equal(response.status, 200);
    const submitted = JSON.parse(h.orderCalls().at(-1).body);
    assert.equal(submitted.product, selected.product);
    assert.equal(submitted.plan, selected.plan);
    assert.equal(submitted.discordUserId, VERIFIED_USER.id);
  }
});

test('invalid product details, consent, honeypot and external references are rejected', t => {
  const h = harness(t);
  const invalid = [
    { product: 'weapon-skin-tool' }, { product: 'unknown' }, { consent: false },
    { consent: 'true' }, { website: 'https://spam.example' }, { project: '' },
    { project: 'x'.repeat(1501) }, { project: 'bad\u0000text' },
    { reference: 'https://evil.example/reference' },
    { reference: 'https://discord.com/channels/9999999999999999999/1550470150086729748/1550470777777777777' },
    { reference: 'https://discord.com/channels/1531989453168578650/1550470565364506694/1550470777777777777' },
    { reference: 'https://discord.com/channels/1531989453168578650/1550470150086729748/1550470777777777777?redirect=evil' },
  ];
  for (const change of invalid) assert.throws(() => h.app.validateWebsiteRequest(order('unused', change)), /INVALID_REQUEST/);
  const accepted = h.app.validateWebsiteRequest(order('unused', {
    reference: 'https://discord.com/channels/1531989453168578650/1550470150086729748/1550470777777777777',
  }));
  assert.match(accepted.reference, /1550470777777777777$/);
});

test('cross-origin and non-JSON POSTs cannot submit orders even with an account', async t => {
  const h = harness(t);
  const account = await login(h);
  for (const headers of [
    { origin: 'https://evil.example' }, { origin: 'https://turbodesigns.net.evil.example' },
    { origin: undefined }, { 'content-type': 'text/plain' },
  ]) {
    const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
      method: 'POST', cookie: account.cookie, headers, body: order('unused'),
    });
    assert.equal(response.status, 403);
    assert.equal(response.json.error, 'INVALID_ORIGIN');
  }
  assert.equal(h.orderCalls().length, 0);
});

test('malformed JSON and oversized bodies fail before the bot receives an order', async t => {
  const h = harness(t);
  const account = await login(h);
  for (const rawBody of ['{not-json', 'x'.repeat(8193)]) {
    const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
      method: 'POST', cookie: account.cookie, rawBody,
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.error, 'INVALID_REQUEST');
  }
  assert.equal(h.orderCalls().length, 0);
});

test('success requires a private ticket URL from the intended server', async t => {
  const h = harness(t);
  const account = await login(h);
  const token = await challenge(h, account.cookie);
  h.advance(3000);
  const defaultResponse = h.responseFor.bind(h);
  let botResult;
  h.responseFor = call => h.orderCalls().includes(call) ? botResult : defaultResponse(call);
  for (const invalidResult of [
    { ok: true, reference: 'WEB-A1B2C3D4' },
    { ok: true, reference: 'WEB-A1B2C3D4', ticketUrl: 'https://evil.example/ticket' },
    { ok: true, reference: 'WEB-A1B2C3D4', ticketUrl: 'https://discord.com/channels/9999999999999999999/1550470999999999999' },
    { ok: true, reference: 'invalid', ticketUrl: TICKET_URL },
  ]) {
    botResult = invalidResult;
    const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
      method: 'POST', cookie: account.cookie, body: order(token),
    });
    assert.equal(response.status, 409);
    assert.equal(response.json.error, 'TICKET_UNAVAILABLE');
    assert.equal(response.json.ticketUrl, undefined);
  }
});

test('the account order limit cannot be bypassed by changing client-supplied contact', async t => {
  const h = harness(t);
  const account = await login(h);
  for (let index = 0; index < 4; index += 1) {
    const token = await challenge(h, account.cookie);
    h.advance(3000);
    const response = await invoke(h.app.handleRequests, '/api/discord-requests', {
      method: 'POST', cookie: account.cookie,
      body: order(token, { contact: `forged-${index}`, discordUserId: `155047099999999999${index}` }),
    });
    assert.equal(response.status, index < 3 ? 200 : 429);
    if (index === 3) assert.equal(response.json.error, 'RATE_LIMIT');
  }
  assert.equal(h.orderCalls().length, 3);
});

test('logout requires the site origin and revokes the existing account cookie', async t => {
  const h = harness(t);
  const account = await login(h);
  const rejected = await invoke(h.app.handleAuth, '/auth/discord/logout', {
    method: 'POST', cookie: account.cookie, headers: { origin: 'https://evil.example' },
  });
  assert.equal(rejected.status, 403);
  assert.ok(h.app.readAccount(request('/', { cookie: account.cookie })));
  const accepted = await invoke(h.app.handleAuth, '/auth/discord/logout', { method: 'POST', cookie: account.cookie });
  assert.equal(accepted.status, 200);
  assertPrivateCookie(accepted, '__Host-turbo_account');
  assert.equal(h.app.readAccount(request('/', { cookie: account.cookie })), null);
});

test('missing or short request secrets disable ordering without network calls', async t => {
  const h = harness(t);
  process.env.WEBSITE_REQUEST_SECRET = 'too-short';
  const response = await invoke(h.app.handleRequests, '/api/discord-requests', { method: 'POST', body: order('unused') });
  assert.equal(response.status, 503);
  assert.equal(response.json.error, 'UNAVAILABLE');
  assert.equal(h.calls.length, 0);
});

test('gallery curation excludes Thumbnail 03 and moves 01, 02 and 06 to the end', t => {
  const h = harness(t);
  // These are the original attachment identities supplied by the existing portfolio.
  const attachmentIds = [
    '1558888753177559152', '1558518707649781832', '1558518708186521720',
    '1556760117389824010', '1556760099803107358', '1556733173210153110',
  ];
  const feed = h.app.validFeed({
    connected: true, products: [],
    previews: attachmentIds.map((attachment, index) => ({
      id: `new-position-${index}`,
      image: `https://cdn.discordapp.com/attachments/1550470150086729748/${attachment}/preview.webp?ex=changed-signature`,
    })),
  });
  assert.deepEqual(feed.previews.map(preview => preview.label), [
    'Thumbnail 04', 'Thumbnail 05', 'Thumbnail 01', 'Thumbnail 02', 'Thumbnail 06',
  ]);
  assert.equal(feed.previews.some(preview => preview.originalNumber === 3), false);
});

test('media feeds retain only HTTPS Discord attachments and safe preview links', t => {
  const h = harness(t);
  const safeImage = 'https://cdn.discordapp.com/attachments/1550470513070178374/1550470888888888888/nve.webp';
  const safeVideo = 'https://media.discordapp.net/attachments/1550470513070178374/1550470888888888889/nve.mp4';
  const unsafe = [
    'https://evil.example/attachments/1/2/nve.webp',
    'https://cdn.discordapp.com.evil.example/attachments/1/2/nve.webp',
    'http://cdn.discordapp.com/attachments/1/2/nve.webp',
    'https://cdn.discordapp.com/other/nve.webp',
    'javascript:alert(1)',
  ];
  const feed = h.app.validFeed({
    connected: true, products: [{ key: 'weapon-skin-tool', price: 14.99 }, { key: 'soundpack-tool', price: 20 }],
    previews: unsafe.map((image, index) => ({ id: index, image })),
    nvePreviews: [
      { id: 'safe-image', image: safeImage, messageUrl: 'https://evil.example/' },
      { id: 'safe-video', url: safeVideo, kind: 'video' },
      ...unsafe.map((url, index) => ({ id: index, url })),
    ],
    samples: [{ id: 'safe-audio', url: safeVideo }, ...unsafe.map(url => ({ url }))],
    nveChannelUrl: 'https://evil.example/channel',
  });
  assert.deepEqual(feed.nvePreviews.map(preview => preview.url), [safeImage, safeVideo]);
  assert.equal(feed.nvePreviews[1].kind, 'video');
  assert.equal(feed.nvePreviews[0].messageUrl, 'https://discord.gg/turbodesigns');
  assert.equal(feed.nveChannelUrl, 'https://discord.gg/turbodesigns');
  assert.equal(feed.previews.length, 0);
  assert.equal(feed.samples.length, 1);
  assert.deepEqual(feed.products.map(product => product.key), ['soundpack-tool']);
  assert.deepEqual(feed.toolPlans, { week: 10, month: 15, lifetime: 20 });
});

test('invalid feed envelopes fail closed instead of exposing incomplete data', t => {
  const h = harness(t);
  for (const feed of [null, {}, { connected: false, products: [], previews: [] }, { connected: true, products: [] }]) {
    assert.throws(() => h.app.validFeed(feed), /Invalid feed/);
  }
});
