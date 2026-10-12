'use strict';
const crypto = require('node:crypto');
const net = require('node:net');
const { curatePreviews } = require('./gallery-curation.cjs');
const BOT_ORIGIN = 'https://bot-production-d58c.up.railway.app';
const FEED_URL = process.env.DISCORD_PUBLIC_FEED_URL || `${BOT_ORIGIN}/turbo-public-feed`;
const SITE_ORIGIN = 'https://turbodesigns.net';
const CALLBACK = `${SITE_ORIGIN}/auth/discord/callback`;
const PRODUCTS = new Set(['thumbnail','nve','soundpack','grafik','fivem','bot','bundle','soundpack-tool','partnership']);
const TOOL_PLANS = Object.freeze({ week:10, month:15, lifetime:20 });
const secret = () => process.env.WEBSITE_REQUEST_SECRET;
const secretReady = () => typeof secret() === 'string' && secret().length >= 32;
let cache, pending, retryAt = 0, authCache, authPending;

function validFeed(data) {
  if (!data || data.connected !== true || !Array.isArray(data.previews) || !Array.isArray(data.products)) throw new Error('Invalid feed');
  const allowed = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && ['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname) && u.pathname.startsWith('/attachments/'); }
    catch { return false; }
  };
  const discordLink = value => /^https:\/\/discord\.com\/channels\/\d+\/\d+(?:\/\d+)?$/.test(value || '') ? value : 'https://discord.gg/turbodesigns';
  const samples = (Array.isArray(data.samples) ? data.samples : []).slice(0,12).filter(p=>allowed(p.url)).map(p=>({id:String(p.id),url:p.url,title:String(p.title || 'Soundpack Hörprobe').slice(0,100),kind:p.kind==='video'?'video':'audio',messageUrl:discordLink(p.messageUrl)}));
  const previews = curatePreviews(data.previews.slice(0,48).filter(p=>allowed(p.image)).map(p=>({id:String(p.id),image:p.image,messageUrl:discordLink(p.messageUrl)})));
  const nvePreviews = (Array.isArray(data.nvePreviews) ? data.nvePreviews : []).slice(0,16).filter(p=>allowed(p.image || p.url)).map(p=>({id:String(p.id),title:String(p.title || 'NVE Preview').slice(0,100),kind:p.kind==='video'?'video':'image',url:p.image || p.url,messageUrl:discordLink(p.messageUrl)}));
  return {
    connected:true,updatedAt:data.updatedAt,previews,samples,nvePreviews,
    samplesAvailable:data.samplesAvailable===true,nveAvailable:data.nveAvailable===true,
    soundChannelUrl:discordLink(data.soundChannelUrl),nveChannelUrl:discordLink(data.nveChannelUrl || 'https://discord.com/channels/1531989453168578650/1550470513070178374'),
    orderChannelUrl:discordLink(data.orderChannelUrl),reviewsChannelUrl:discordLink(data.reviewsChannelUrl),previewChannelUrl:discordLink(data.previewChannelUrl),
    products:data.products.filter(p=>PRODUCTS.has(p.key)).map(p=>({key:p.key,orderUrl:discordLink(p.orderUrl),price:typeof p.price==='number' && Number.isFinite(p.price) && p.price>=0 ? p.price:null,enabled:p.enabled!==false,etaDays:typeof p.etaDays==='number' && p.etaDays>=0 ? p.etaDays:null})),
    toolPlans:TOOL_PLANS
  };
}
async function getFeed() {
  if (cache && Date.now()-cache.at<30000) return cache.data;
  if (Date.now()<retryAt) throw new Error('Retry later');
  if (pending) return pending;
  pending = (async()=>{
    const response = await fetch(FEED_URL,{signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!response.ok) throw new Error('Feed unavailable');
    const data = validFeed(await response.json());cache={at:Date.now(),data};return data;
  })().catch(error=>{retryAt=Date.now()+15000;throw error;}).finally(()=>{pending=null;});
  return pending;
}
function sign(value) { return crypto.createHmac('sha256',secret()).update(value).digest('hex'); }
async function botRequest(method,data,route='/turbo-website-requests') {
  if (!secretReady() || !['/turbo-website-requests','/turbo-website-oauth'].includes(route)) throw new Error('UNAVAILABLE');
  const raw = data ? JSON.stringify(data) : '', stamp = String(Date.now());
  const headers = {'content-type':'application/json','x-turbo-timestamp':stamp,'x-turbo-signature':sign(`${stamp}:${method}:${route}:${raw}`)};
  const response = await fetch(BOT_ORIGIN+route,{method,headers,...(raw?{body:raw}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});
  const result = await response.json().catch(()=>({}));
  if (!response.ok) {
    const error = new Error('UNAVAILABLE');
    if (['JOIN_REQUIRED','TICKET_UNAVAILABLE','AUTH_REQUIRED','RATE_LIMIT','AUTH_FAILED'].includes(result.error)) error.code=result.error;
    throw error;
  }
  return result;
}
async function getAuthConfiguration() {
  if (!secretReady()) return {ready:false};
  if (authCache && Date.now()-authCache.at<(authCache.data.ready?60000:5000)) return authCache.data;
  if (authPending) return authPending;
  authPending = (async()=>{
    try {
      const data = await botRequest('GET',null,'/turbo-website-oauth');
      if (data.ready!==true || !/^\d{17,20}$/.test(data.clientId || '') || data.redirectUri!==CALLBACK) throw new Error('Unavailable');
      return {ready:true,clientId:data.clientId};
    } catch { return {ready:false}; }
  })().then(data=>{authCache={at:Date.now(),data};return data;}).finally(()=>{authPending=null;});
  return authPending;
}

const revokedSessions = new Map(), usedStates = new Map();
function cookie(req,name) { return String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1) || ''; }
function seal(data,purpose) {
  const iv=crypto.randomBytes(12), key=crypto.createHmac('sha256',secret()).update('discord-cookie:'+purpose).digest(), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  return Buffer.concat([iv,cipher.update(JSON.stringify(data)),cipher.final(),cipher.getAuthTag()]).toString('base64url');
}
function unseal(raw,purpose) {
  try {
    if (!secretReady() || !raw || raw.length>2048) return null;
    const buffer=Buffer.from(raw,'base64url');if (buffer.length<29 || buffer.toString('base64url')!==raw) return null;
    const key=crypto.createHmac('sha256',secret()).update('discord-cookie:'+purpose).digest(), cipher=crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));
    cipher.setAuthTag(buffer.subarray(-16));const data=JSON.parse(Buffer.concat([cipher.update(buffer.subarray(12,-16)),cipher.final()]).toString());
    return data.exp>Date.now()?data:null;
  } catch { return null; }
}
function cleanAuthMaps() { for (const map of [revokedSessions,usedStates]) for (const [id,exp] of map) if (exp<Date.now()) map.delete(id); }
function readAccount(req) {
  if (!secretReady()) return null;cleanAuthMaps();
  const data=unseal(cookie(req,'__Host-turbo_account'),'account');
  return data && !revokedSessions.has(data.sid) && /^\d{17,20}$/.test(data.id || '') && typeof data.username==='string' && data.username.length>=2 && data.username.length<=64 ? data:null;
}
function authCookie(name,value,seconds) { return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`; }
async function handleAuth(req,res) {
  const url=new URL(req.url,SITE_ORIGIN), route=url.pathname;
  const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
  const json=(status,data)=>{res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const redirect=(location,cookies=[])=>{res.writeHead(303,{...headers,location,...(cookies.length?{'set-cookie':cookies}:{})});res.end();};
  if (route==='/api/discord-account') {
    if (req.method!=='GET') return json(405,{});
    const account=readAccount(req),config=await getAuthConfiguration();
    return json(200,{loginAvailable:config.ready,user:account?{id:account.id,username:account.username}:null});
  }
  if (route==='/auth/discord/logout') {
    if (req.method!=='POST' || req.headers.origin!==SITE_ORIGIN) return json(403,{});
    const account=readAccount(req);if(account) revokedSessions.set(account.sid,account.exp);
    res.setHeader('set-cookie',authCookie('__Host-turbo_account','',0));return json(200,{ok:true});
  }
  if (req.method!=='GET') return json(405,{});
  if (!secretReady()) return redirect('/?discord=unavailable#anfrage');
  if (route==='/auth/discord') {
    const config=await getAuthConfiguration();if(!config.ready) return redirect('/?discord=unavailable#anfrage');
    const state=crypto.randomBytes(32).toString('hex'),exp=Date.now()+600000;
    const authorize=new URL('https://discord.com/oauth2/authorize');
    for (const [key,value] of Object.entries({client_id:config.clientId,response_type:'code',redirect_uri:CALLBACK,scope:'identify',state})) authorize.searchParams.set(key,value);
    return redirect(authorize.href,[authCookie('__Host-turbo_state',seal({state,exp},'state'),600)]);
  }
  if (route!=='/auth/discord/callback') return json(404,{});
  const clear=authCookie('__Host-turbo_state','',0),state=unseal(cookie(req,'__Host-turbo_state'),'state');cleanAuthMaps();
  if (!state || url.searchParams.get('state')!==state.state || usedStates.has(state.state)) return redirect('/?discord=failed#anfrage',[clear]);
  usedStates.set(state.state,state.exp);
  if (url.searchParams.has('error')) return redirect('/?discord=cancelled#anfrage',[clear]);
  const code=url.searchParams.get('code');if(!code || code.length>512) return redirect('/?discord=failed#anfrage',[clear]);
  try {
    const result=await botRequest('POST',{code,redirectUri:CALLBACK},'/turbo-website-oauth'),user=result.user;
    if (result.ok!==true || !/^\d{17,20}$/.test(user?.id || '') || typeof user.username!=='string' || user.username.length<2 || user.username.length>64) throw new Error('AUTH_FAILED');
    const account={id:user.id,username:user.username,sid:crypto.randomUUID(),exp:Date.now()+21600000};
    return redirect('/#anfrage',[clear,authCookie('__Host-turbo_account',seal(account,'account'),21600)]);
  } catch { return redirect('/?discord=failed#anfrage',[clear]); }
}

const requestLimits=new Map();let globalRequests=[];
function requestIp(req) { const forwarded=String(req.headers['cf-connecting-ip'] || '');return net.isIP(forwarded)?forwarded:req.socket.remoteAddress; }
function issueChallenge(ip,userId) { const value=`${Date.now()}.${crypto.randomUUID()}`;return `${value}.${sign(`${ip}:${userId}:${value}`)}`; }
function validateChallenge(token,ip,userId) {
  const parts=String(token || '').split('.');if(parts.length!==3) return null;
  const [stamp,id,digest]=parts;
  if (!/^\d{13}$/.test(stamp) || !/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9]{64}$/.test(digest)) return null;
  const age=Date.now()-Number(stamp);if(age<3000 || age>7200000) return null;
  const expected=sign(`${ip}:${userId}:${stamp}.${id}`);
  return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(digest,'hex'))?id:null;
}
function validateWebsiteRequest(data) {
  const text=(key,max,required=false)=>{
    const value=typeof data?.[key]==='string'?data[key].trim():'';
    if (value.length>max || (required && !value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('INVALID_REQUEST');
    return value;
  };
  const product=text('product',32,true),plan=text('plan',16),reference=text('reference',200);
  if (!PRODUCTS.has(product) || data.consent!==true || text('website',100)) throw new Error('INVALID_REQUEST');
  if (product==='soundpack-tool' && !Object.hasOwn(TOOL_PLANS,plan)) throw new Error('INVALID_REQUEST');
  if (reference && !/^https:\/\/discord\.com\/channels\/1531989453168578650\/1550470150086729748\/\d{17,20}$/.test(reference)) throw new Error('INVALID_REQUEST');
  return {product,...(product==='soundpack-tool'?{plan}:{}),project:text('project',1500,true),deadline:text('deadline',100),assets:text('assets',300),reference};
}
async function handleRequests(req,res) {
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  const reply=(status,data)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};
  if (!secretReady()) return reply(503,{ready:false,error:'UNAVAILABLE'});
  const ip=requestIp(req),route=(req.url || '').split('?')[0],account=readAccount(req);
  if (route==='/api/discord-requests/status') {
    if (req.method!=='GET') return reply(405,{ready:false});
    if (!account) { const config=await getAuthConfiguration();return reply(200,{ready:false,loginRequired:true,loginAvailable:config.ready}); }
    try { const status=await botRequest('GET');return reply(200,{ready:status.ready===true,loginRequired:false,...(status.ready===true?{token:issueChallenge(ip,account.id)}:{})}); }
    catch { return reply(503,{ready:false}); }
  }
  if (req.method!=='POST') return reply(405,{ok:false});
  if (req.headers.origin!==SITE_ORIGIN || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(403,{ok:false,error:'INVALID_ORIGIN'});
  if (!account) return reply(401,{ok:false,error:'AUTH_REQUIRED'});
  try {
    const chunks=[];let size=0;
    for await (const chunk of req) { size+=chunk.length;if(size>8192) throw new Error('INVALID_REQUEST');chunks.push(chunk); }
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),data=validateWebsiteRequest(input),requestId=validateChallenge(input.token,ip,account.id);
    if (!requestId) throw new Error('EXPIRED_TOKEN');
    const now=Date.now(),window=900000;
    for (const [key,value] of requestLimits) if(now-value.start>window) requestLimits.delete(key);
    const limit=requestLimits.get(account.id) || {start:now,ids:new Set()};globalRequests=globalRequests.filter(x=>now-x.at<3600000);
    const retry=limit.ids.has(requestId);
    if (!retry && (limit.ids.size>=3 || globalRequests.length>=30)) return reply(429,{ok:false,error:'RATE_LIMIT'});
    if (!retry) { limit.ids.add(requestId);requestLimits.set(account.id,limit);globalRequests.push({at:now,id:requestId}); }
    const result=await botRequest('POST',{...data,requestId,contact:account.username,discordUserId:account.id});
    if (result.ok!==true || !/^WEB-[A-F0-9]{8}$/.test(result.reference || '') || !/^https:\/\/discord\.com\/channels\/1531989453168578650\/\d{17,20}$/.test(result.ticketUrl || '')) throw new Error('TICKET_UNAVAILABLE');
    return reply(200,{ok:true,reference:result.reference,ticketUrl:result.ticketUrl});
  } catch (error) {
    const invalid=error.message==='INVALID_REQUEST' || error instanceof SyntaxError;
    const code=error.code || (invalid?'INVALID_REQUEST':error.message==='EXPIRED_TOKEN'?'EXPIRED_TOKEN':error.message==='TICKET_UNAVAILABLE'?'TICKET_UNAVAILABLE':'UNAVAILABLE');
    return reply(invalid?400:code==='AUTH_REQUIRED'?401:code==='RATE_LIMIT'?429:['JOIN_REQUIRED','TICKET_UNAVAILABLE','EXPIRED_TOKEN'].includes(code)?409:503,{ok:false,error:code});
  }
}
module.exports={getFeed,validFeed,validateWebsiteRequest,handleRequests,handleAuth,readAccount,TOOL_PLANS};
