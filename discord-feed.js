'use strict';
const crypto=require('node:crypto');
const net=require('node:net');
const FEED_URL = process.env.DISCORD_PUBLIC_FEED_URL || 'https://bot-production-d58c.up.railway.app/turbo-public-feed';
let cache, pending, retryAt = 0;
function validFeed(data) {
  if (!data || data.connected !== true || !Array.isArray(data.previews) || !Array.isArray(data.products)) throw new Error('Invalid feed');
  const allowed = url => { try { const u = new URL(url); return u.protocol === 'https:' && ['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname) && u.pathname.startsWith('/attachments/'); } catch { return false; } };
  const discordLink = value => /^https:\/\/discord\.com\/channels\/\d+\/\d+(?:\/\d+)?$/.test(value || '') ? value : 'https://discord.gg/turbodesigns';
  return { samples:(data.samples || []).slice(0,12).filter(p=>allowed(p.url)).map(p=>({id:String(p.id),url:p.url,title:String(p.title || 'Soundpack Hörprobe').slice(0,100),kind:p.kind==='video'?'video':'audio',messageUrl:discordLink(p.messageUrl)})),samplesAvailable:data.samplesAvailable===true,soundChannelUrl:discordLink(data.soundChannelUrl),orderChannelUrl:discordLink(data.orderChannelUrl), connected:true, updatedAt:data.updatedAt, previews:data.previews.slice(0,24).filter(p=>allowed(p.image)).map(p=>({id:String(p.id),image:p.image,title:'Thumbnail Preview',messageUrl:/^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/.test(p.messageUrl)?p.messageUrl:'https://discord.gg/turbodesigns'})), products:data.products.filter(p=>['thumbnail','nve','soundpack','grafik','fivem','bot','bundle'].includes(p.key)).map(p=>({key:p.key,orderUrl:discordLink(p.orderUrl),price:typeof p.price==='number'&&Number.isFinite(p.price)&&p.price>=0?p.price:null,enabled:p.enabled!==false,etaDays:typeof p.etaDays==='number'&&p.etaDays>=0?p.etaDays:null})), previewChannelUrl:/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(data.previewChannelUrl)?data.previewChannelUrl:'https://discord.gg/turbodesigns' };
}
async function getFeed() {
  if (cache && Date.now()-cache.at<30000) return cache.data;
  if (Date.now()<retryAt) throw new Error('Retry later');
  if (pending) return pending;
  pending = (async()=> {
    const response=await fetch(FEED_URL,{signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!response.ok) throw new Error('Feed unavailable');
    const data=validFeed(await response.json()); cache={at:Date.now(),data}; return data;
  })().catch(error=>{retryAt=Date.now()+15000;throw error;}).finally(()=>{pending=null;});
  return pending;
}


const REQUEST_URL='https://bot-production-d58c.up.railway.app/turbo-website-requests';
const requestLimits=new Map();let globalRequests=[];
const requestOrigin='https://turbodesigns.net';
const secret=()=>process.env.WEBSITE_REQUEST_SECRET;
function sign(value){return crypto.createHmac('sha256',secret()).update(value).digest('hex');}
function requestIp(req){const forwarded=String(req.headers['cf-connecting-ip']||'');return net.isIP(forwarded)?forwarded:req.socket.remoteAddress;}
function issueChallenge(ip){const stamp=Date.now(),id=crypto.randomUUID(),value=`${stamp}.${id}`;return `${value}.${sign(`${ip}:${value}`)}`;}
function validateChallenge(token,ip){
  const parts=String(token||'').split('.');if(parts.length!==3)return null;
  const [stamp,id,digest]=parts;if(!/^\d{13}$/.test(stamp)||!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/.test(digest))return null;
  const age=Date.now()-Number(stamp);if(age<3000||age>7200000)return null;
  const expected=sign(`${ip}:${stamp}.${id}`);return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(digest,'hex'))?id:null;
}
async function botRequest(method,data){
  const raw=data?JSON.stringify(data):'',stamp=String(Date.now());
  const headers={'content-type':'application/json','x-turbo-timestamp':stamp,'x-turbo-signature':sign(`${stamp}:${method}:/turbo-website-requests:${raw}`)};
  const response=await fetch(REQUEST_URL,{method,headers,...(raw?{body:raw}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw new Error('DISCORD_REQUEST_UNAVAILABLE');return response.json();
}
function validateWebsiteRequest(data){
  const text=(key,max,required=false)=>{const value=typeof data?.[key]==='string'?data[key].trim():'';if(value.length>max||(required&&!value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new Error('INVALID_REQUEST');return value;};
  const product=text('product',32,true),contact=text('contact',64,true);
  if(!['thumbnail','nve','soundpack','grafik','fivem','bot','bundle'].includes(product)||contact.length<2||data.consent!==true||text('website',100))throw new Error('INVALID_REQUEST');
  return {product,contact,project:text('project',1500,true),deadline:text('deadline',100),assets:text('assets',300)};
}
async function handleRequests(req,res){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  const reply=(status,data)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};
  if(!secret()||secret().length<32)return reply(503,{ready:false,error:'UNAVAILABLE'});
  const ip=requestIp(req),route=(req.url||'').split('?')[0];
  if(route==='/api/discord-requests/status'){
    if(req.method!=='GET')return reply(405,{ready:false});
    try{const status=await botRequest('GET');return reply(200,{ready:status.ready===true,token:issueChallenge(ip)});}catch{return reply(503,{ready:false});}
  }
  if(req.method!=='POST')return reply(405,{ok:false});
  if(req.headers.origin!==requestOrigin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(403,{ok:false,error:'INVALID_ORIGIN'});
  try{
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw new Error('INVALID_REQUEST');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),data=validateWebsiteRequest(input),requestId=validateChallenge(input.token,ip);
    if(!requestId)throw new Error('EXPIRED_TOKEN');
    const now=Date.now(),window=900000;
    for(const [key,value] of requestLimits)if(now-value.start>window)requestLimits.delete(key);
    const limit=requestLimits.get(ip)||{start:now,ids:new Set()};globalRequests=globalRequests.filter(x=>now-x.at<3600000);
    const retry=limit.ids.has(requestId);
    if(!retry&&(limit.ids.size>=3||globalRequests.length>=30))return reply(429,{ok:false,error:'RATE_LIMIT'});
    if(!retry){limit.ids.add(requestId);requestLimits.set(ip,limit);globalRequests.push({at:now,id:requestId});}
    const result=await botRequest('POST',{...data,requestId});
    if(result.ok!==true||!/^WEB-[A-F0-9]{8}$/.test(result.reference||''))throw new Error('DISCORD_REQUEST_UNAVAILABLE');
    return reply(200,{ok:true,reference:result.reference});
  }catch(error){const invalid=error.message==='INVALID_REQUEST'||error instanceof SyntaxError;return reply(invalid?400:error.message==='EXPIRED_TOKEN'?409:503,{ok:false,error:invalid?'INVALID_REQUEST':error.message==='EXPIRED_TOKEN'?'EXPIRED_TOKEN':'UNAVAILABLE'});}
}
module.exports={getFeed,validFeed,validateWebsiteRequest,handleRequests};
