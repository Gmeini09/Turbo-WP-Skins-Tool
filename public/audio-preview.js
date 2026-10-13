(function () {
  'use strict';
  const MAX_SIZE=16*1024*1024;
  function validWavHeader(buffer) {
    if (!(buffer instanceof ArrayBuffer)||buffer.byteLength<12) return false;
    const b=new Uint8Array(buffer);
    return String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WAVE';
  }
  if(typeof module==='object'&&module.exports)module.exports={validWavHeader,MAX_SIZE};
  if(typeof document==='undefined')return;
  const input=document.getElementById('demo-wav'),audio=document.getElementById('demo-audio');
  if(!input||!audio)return;
  const status=document.getElementById('demo-audio-status'),reset=document.getElementById('demo-audio-reset'),canvas=document.getElementById('demo-audio-wave'),illustration=document.getElementById('demo-wave-illustration'),details=document.getElementById('demo-audio-details');
  let objectUrl=null,version=0,context=null;
  const duration=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  function clear(){
    ++version;audio.pause();audio.removeAttribute('src');audio.load();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=null;input.value='';audio.hidden=true;reset.hidden=true;canvas.hidden=true;illustration.hidden=false;
    details.textContent='Wähle eine WAV-Datei und hör direkt rein.';status.textContent='';
  }
  function draw(buffer){
    const samples=buffer.getChannelData(0),painter=canvas.getContext('2d');
    canvas.width=640;canvas.height=100;if(!painter)return;
    painter.clearRect(0,0,640,100);painter.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#97d9f8';
    for(let i=0;i<64;i++){
      const from=Math.floor(i*samples.length/64),to=Math.floor((i+1)*samples.length/64);let peak=0;
      for(let j=from;j<to;j+=Math.max(1,Math.floor((to-from)/180)))peak=Math.max(peak,Math.abs(samples[j]));
      const bar=Math.max(3,Math.min(94,peak*94));painter.fillRect(i*10+2,(100-bar)/2,5,bar);
    }
    canvas.hidden=false;illustration.hidden=true;
  }
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    clear();const current=version;
    if(file.size>MAX_SIZE||file.size<44){status.textContent='Wähle eine gültige WAV-Datei bis 16 MB.';return;}
    status.textContent='Deine WAV-Datei wird vorbereitet …';
    try{
      const bytes=await file.arrayBuffer();if(current!==version)return;
      if(!validWavHeader(bytes))throw new Error('INVALID_WAV');
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('UNSUPPORTED');
      if(!context||context.state==='closed')context=new Context();
      const decoded=await context.decodeAudioData(bytes);if(current!==version)return;
      draw(decoded);objectUrl=URL.createObjectURL(file);audio.src=objectUrl;audio.hidden=false;reset.hidden=false;
      details.textContent=`${file.name} · ${duration(decoded.duration)}`;
      status.textContent='Bereit zum Vorhören. Deine Datei bleibt in deinem Browser.';
    }catch{if(current===version)status.textContent='Diese WAV-Datei lässt sich hier nicht vorhören. Versuche eine andere Datei.';}
  });
  reset.addEventListener('click',clear);
  audio.addEventListener('play',()=>document.querySelectorAll('audio,video').forEach(other=>{if(other!==audio)other.pause();}));
  document.addEventListener('play',event=>{if(event.target!==audio&&['AUDIO','VIDEO'].includes(event.target.tagName))audio.pause();},true);
  audio.addEventListener('error',()=>{if(objectUrl)status.textContent='Die Vorschau ist gerade nicht verfügbar. Wähle die Datei erneut aus.';});
  window.addEventListener('pagehide',()=>{clear();context?.close().catch(()=>{});});
})();
