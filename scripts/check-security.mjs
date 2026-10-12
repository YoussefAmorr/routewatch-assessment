import assert from 'node:assert/strict';
import app,{normalizeLeg} from '../worker/index.js';
const send=(body,headers={},path='/api/assess')=>app.fetch(new Request('http://localhost'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}));
for(const body of [null,[],{}, {origin:'__proto__',destination:'JFK',date:'2026-10-12'},{origin:'<script>',destination:'JFK',date:'2026-10-12'}, {origin:'JFK',destination:'JFK',date:'2026-10-12'},{origin:'JFK',destination:'SFO',date:'1900-01-01'},{origin:'JFK',destination:'SFO',date:'2099-01-01'}])assert.equal((await send(body)).status,400);
assert.equal((await send('{')).status,400);
assert.equal((await send(' '.repeat(16385))).status,413);
assert.equal((await send('{}',{'Origin':'https://evil.example'})).status,403);
assert.equal((await send('{}',{'Content-Type':'text/plain'})).status,415);
assert.equal((await send('{}',{},'/api/assess?url=https://evil.example')).status,400);
assert.throws(()=>normalizeLeg(null));
const page=await app.fetch(new Request('http://localhost/'));const html=await page.text();assert.equal(page.headers.get('X-Frame-Options'),'DENY');assert.equal(page.headers.get('X-Content-Type-Options'),'nosniff');assert(page.headers.get('Content-Security-Policy').includes('wasm-unsafe-eval'));assert(!page.headers.get('Content-Security-Policy').includes("'unsafe-eval'"));assert(/<script nonce="[a-f0-9]+"/.test(html));assert(!html.includes('id="saveHistory" checked'));assert(!/rel="noopener"/.test(html));
const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('SECRET /internal/file')};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try{for(let i=0;i<20;i++){const r=await send({origin:'JFK',destination:'SFO',date});assert.equal(r.status,200);const value=await r.json();assert.equal(value.missing,5);assert(!JSON.stringify(value).includes('SECRET'))}assert.equal((await send({origin:'JFK',destination:'SFO',date})).status,429);assert.equal(calls,100)}finally{globalThis.fetch=oldFetch}
console.log('Security: malformed routes, dates, JSON, oversized bodies, origin/content-type, CSP nonce, opt-in history, outage redaction and rate limits passed.');
const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');
const code=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');const start=code.indexOf('function validateSnapshot('),end=code.indexOf('async function openShare',start);
const airports=JSON.parse(await readFile(new URL('../data/us-airports.json',import.meta.url),'utf8'));const context=vm.createContext({airports,URL});vm.runInContext(code.slice(start,end)+';globalThis.validate=validateSnapshot',context);
const demo=(await(await app.fetch(new Request('http://localhost/api/demo'))).json()).assessment;assert(context.validate(structuredClone(demo)));
for(const alter of [r=>r.evidence[0].url='javascript:alert(1)',r=>r.evidence[0].url='https://api.weather.gov@evil.example/',r=>r.weatherSeries[0].expected='<img src=x onerror=alert(1)>',r=>r.weatherSeries[0].hours[0].gust='<script>',r=>r.ai=[{label:42}],r=>r.evidence[0].text='x'.repeat(12001)]){const value=structuredClone(demo);alter(value);assert.throws(()=>context.validate(value))}
const {assess}=await import('../worker/index.js');globalThis.fetch=async()=>new Response('x'.repeat(4000001));try{const limited=await assess({origin:'JFK',destination:'SFO',date});assert.equal(limited.missing,5);assert.equal(limited.evidence.length,0)}finally{globalThis.fetch=oldFetch}
console.log('Snapshot injection/URL/type limits and oversized provider responses rejected.');
