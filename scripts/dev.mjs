import http from 'node:http';
import { stat } from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {localDatabase} from './local-db.mjs';
const config=new URL('../.env.local',import.meta.url);if(existsSync(config))process.loadEnvFile(fileURLToPath(config));
const port=Number(process.env.PORT||4173);
const entry=new URL('../worker/index.js',import.meta.url);
const DB=localDatabase(process.env.ROUTEWATCH_DB||fileURLToPath(new URL('../.data/routewatch.sqlite',import.meta.url)));
const env={DB,LOCAL_DEVELOPMENT:true,...Object.fromEntries(['RESEND_API_KEY','ALERT_FROM','PUBLIC_BASE_URL'].map(key=>[key,process.env[key]]))};
let lastModified,app,scheduling=false;
async function reload(){const modified=(await stat(entry)).mtimeMs;if(modified!==lastModified){app=(await import(entry.href+'?v='+modified)).default;lastModified=modified}return app}
const server=http.createServer(async(req,res)=>{try{await reload();const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16384){res.writeHead(413,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Request exceeds 16 KB.'}));return}chunks.push(c)}const body=Buffer.concat(chunks);const request=new Request('http://localhost:'+port+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{})});const response=await app.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();res.on('close',()=>{reader.cancel().catch(()=>{})});try{while(true){const {value,done}=await reader.read();if(done||res.destroyed)break;res.write(Buffer.from(value))}}finally{reader.releaseLock()}}res.end()}catch{if(!res.headersSent)res.writeHead(500,{'Cache-Control':'no-store'});res.end('Service unavailable; retry shortly.')}});
server.requestTimeout=30000;server.headersTimeout=15000;
const timer=setInterval(async()=>{if(scheduling)return;scheduling=true;try{await reload();await app.scheduled({},env)}catch{console.error(JSON.stringify({event:'local_scheduler_failed'}))}finally{scheduling=false}},60000);timer.unref();
server.listen(port,'127.0.0.1',()=>console.log('Local: http://localhost:'+port+' · SQLite operations storage enabled · Scheduled checks run while this server is open'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{DB.close();process.exit(0)})});
