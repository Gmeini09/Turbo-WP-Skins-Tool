'use strict';
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
module.exports={getFeed,validFeed};
