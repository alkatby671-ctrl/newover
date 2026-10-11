// Cave Overlays live server: serves index.html and streams TikTok LIVE events (SSE).
const http=require('http'),fs=require('fs'),path=require('path');
const L=require('tiktok-live-connector');
const Conn=L.TikTokLiveConnection||L.WebcastPushConnection;
const rooms=new Map(),PORT=process.env.PORT||3000,MAX=20;
const nick=d=>d.nickname||(d.user&&d.user.nickname)||d.uniqueId||(d.user&&d.user.uniqueId)||'?';
function getRoom(user){
  if(rooms.has(user))return rooms.get(user);
  if(rooms.size>=MAX)return null;
  const r={clients:new Set(),conn:new Conn(user),timer:null};
  const push=o=>{const m='data: '+JSON.stringify(o)+'\n\n';r.clients.forEach(c=>c.write(m))};
  r.conn.on('chat',d=>push({t:'chat',u:nick(d),m:String(d.comment||'').slice(0,200)}));
  r.conn.on('gift',d=>{if(d.giftType===1&&!d.repeatEnd)return;push({t:'gift',u:nick(d),g:d.giftName,n:d.repeatCount||1})});
  r.conn.on('like',d=>push({t:'like',n:d.likeCount||1}));
  r.conn.on('roomUser',d=>push({t:'view',n:d.viewerCount||0}));
  r.conn.connect().then(()=>console.log('connected',user)).catch(e=>console.error('connect failed',user,e&&e.message||e));
  rooms.set(user,r);return r;
}
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/events'){
    const user=u.searchParams.get('user')||'';
    if(!/^[A-Za-z0-9_.]{1,40}$/.test(user)){res.writeHead(400);return res.end('bad user')}
    const r=getRoom(user);if(!r){res.writeHead(503);return res.end('busy')}
    clearTimeout(r.timer);
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
    res.write(': ok\n\n');r.clients.add(res);
    const hb=setInterval(()=>res.write(': hb\n\n'),20000);
    req.on('close',()=>{clearInterval(hb);r.clients.delete(res);
      if(!r.clients.size)r.timer=setTimeout(()=>{try{r.conn.disconnect()}catch(e){}rooms.delete(user)},30000)});
    return;
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(fs.readFileSync(path.join(__dirname,'index.html')));
}).listen(PORT,()=>console.log('http://localhost:'+PORT+'/?u=YOUR_TIKTOK_USERNAME'));
