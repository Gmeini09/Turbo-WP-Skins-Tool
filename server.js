const http = require('http');
const fs = require('fs');
const path = require('path');

const { getFeed, handleRequests, handleAuth } = require('./discord-feed');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function safeFile(urlPath) {
  let clean;
  try { clean = decodeURIComponent(urlPath.split('?')[0]); }
  catch { return null; }
  let rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  if (!path.extname(rel)) rel += '.html';
  const file = path.resolve(root, rel);
  return file.startsWith(path.resolve(root) + path.sep) || file === path.resolve(root)
    ? file
    : null;
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (['/auth/discord','/auth/discord/callback','/auth/discord/logout','/api/discord-account'].includes(route)) {
    handleAuth(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{}');});return;
  }
  if (route === '/api/discord-requests' || route === '/api/discord-requests/status') {
    handleRequests(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:'UNAVAILABLE'}));});return;
  }
  if (route === '/api/discord-feed') {
    if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); return res.end(); }
    const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' };
    getFeed().then(data => { res.writeHead(200,headers); res.end(JSON.stringify(data)); }).catch(() => { res.writeHead(503,headers); res.end(JSON.stringify({connected:false})); });
    return;
  }
  const legacyProduct = route.match(/^\/(soundpack|weapon-skin)(?:\.html|\/)?$/);
  if (legacyProduct) {
    res.writeHead(301, { location: '/#' + legacyProduct[1], 'cache-control': 'no-cache' });
    return res.end();
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true }));
  }

  const file = safeFile(req.url || '/');
  if (!file) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const fallback = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return fs.createReadStream(fallback).pipe(res);
    }

    const ext = path.extname(file).toLowerCase();
    const isAsset = /\.(css|js|svg|png|jpe?g|webp|ico)$/.test(ext);
    res.writeHead(200, {
      'content-type': mime[ext] || 'application/octet-stream',
      'cache-control': isAsset ? 'public, max-age=0, must-revalidate' : 'no-cache',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'strict-origin-when-cross-origin'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Turbo Designs website running on port ${port}`);
});
