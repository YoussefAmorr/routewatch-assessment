import assert from 'node:assert/strict';
import {localDatabase} from './local-db.mjs';
import app,{monitoringChange,runOperationsCheck,deliverOperationsAlerts,operationsActor,simulateDecisions} from '../worker/index.js';
const DB=localDatabase(':memory:'),env={DB,LOCAL_DEVELOPMENT:true};
const api=async(path,body,config=env)=>{const response=await app.fetch(new Request('http://localhost/api/ops/'+path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}),config);return {status:response.status,data:await response.json()}};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));
const plan={origin:'JFK',destination:'SFO',date,departureTime:'10:00',arrivalDate:date,arrivalTime:'16:00'};
assert.equal((await api('state',undefined,{})).status,503);
assert.equal((await api('state',undefined,{DB})).status,503);
assert.equal((await api('trips',{legs:[{...plan,origin:'ZZZ'}]})).status,400);
const created=await api('trips',{label:'Test itinerary',traveler:'Operations test',legs:[plan]});assert.equal(created.status,201);const id=created.data.id;
let detail=(await api('trips/'+id)).data;assert.equal(detail.trip.plan.length,1);
assert.equal((await api('trips/'+id+'/update',{version:detail.trip.version,monitoring:true,owner:'analyst@example.com',workflow:'investigating',decision:'Review airline status'})).status,200);
assert.equal((await api('trips/'+id+'/update',{version:1,monitoring:false})).status,409);
assert.equal((await api('trips/'+id+'/note',{note:'<img src=x onerror=alert(1)> external text remains a note'})).status,200);
assert.equal((await api('trips/'+id+'/subscribe',{email:'ops@example.com'})).status,200);
const fakeQueue={send:async job=>fakeQueue.jobs.push(job),jobs:[]};env.ASSESSMENT_QUEUE=fakeQueue;
assert.equal((await api('trips/'+id+'/check',{})).status,202);assert.equal(fakeQueue.jobs.length,1);
const demo=(await(await app.fetch(new Request('http://localhost/api/demo'))).json()).assessment;
await runOperationsCheck(env,fakeQueue.jobs[0],async()=>structuredClone(demo));detail=(await api('trips/'+id)).data;assert(detail.assessment);assert.equal((await api('state')).data.alerts.length,0);
const elevated=structuredClone(demo);elevated.checked=new Date(Date.now()+1000).toISOString();elevated.level=2;elevated.verdict='Elevated disruption risk';elevated.evidence.unshift({id:'T1',source:'NWS',airport:'SFO',title:'Test assertion only: new advisory',onset:'test',level:2,url:'https://api.weather.gov/alerts/active'});
const job2={org:'local',id,token:crypto.randomUUID()};await DB.prepare('UPDATE trips SET check_token=?,checking_until=? WHERE id=?').bind(job2.token,Date.now()+180000,id).run();await runOperationsCheck(env,job2,async()=>elevated);const state=(await api('state')).data;assert.equal(state.alerts.length,1);assert(state.alerts[0].reason.reasons.some(r=>r.includes('increased')));assert(state.trips[0].signals.length);assert.equal((await api('trips/'+id)).data.trip.workflow,'unreviewed');
await runOperationsCheck(env,job2,async()=>{throw Error('Duplicate job must not execute')});assert.equal((await api('state')).data.history.length,2);
assert.equal(await monitoringChange(elevated,elevated),null);assert.equal(await monitoringChange(null,elevated),null);
assert.equal((await deliverOperationsAlerts(env)).configured,false);
let sends=0;const deliveryEnv={...env,RESEND_API_KEY:'test-key-not-real',ALERT_FROM:'test@example.com'};
await deliverOperationsAlerts(deliveryEnv,async(url,options)=>{sends++;assert.equal(url,'https://api.resend.com/emails');assert(options.headers['Idempotency-Key']);assert.equal(JSON.parse(options.body).to[0],'ops@example.com');return Response.json({id:'assertion-only-provider-id'})});assert.equal(sends,1);
await deliverOperationsAlerts(deliveryEnv,async()=>{sends++;throw Error()});assert.equal(sends,1);
// Delivery retry state is persisted and respects its backoff.
await DB.prepare('INSERT INTO deliveries(id,org,alert_id,email) VALUES(?,?,?,?)').bind('retry-test','local',state.alerts[0].id,'retry@example.com').run();await DB.prepare('INSERT INTO subscriptions(org,trip_id,email,created) VALUES(?,?,?,?)').bind('local',id,'retry@example.com',new Date().toISOString()).run();let failures=0;await deliverOperationsAlerts(deliveryEnv,async()=>{failures++;throw Error('Test delivery outage')});let failed=await DB.prepare('SELECT * FROM deliveries WHERE id=?').bind('retry-test').first();assert.equal(failed.status,'failed');assert.equal(failed.attempts,1);assert(failed.next_try>Date.now());await deliverOperationsAlerts(deliveryEnv,async()=>{failures++;throw Error()});assert.equal(failures,1);
// A 25-trip operations portfolio is supported without synthetic provider responses.
for(let i=0;i<24;i++)assert.equal((await api('trips',{label:'Portfolio validation '+i,legs:[plan]})).status,201);assert.equal((await api('state')).data.trips.length,25);
const rows=(await DB.prepare('SELECT * FROM actions WHERE trip_id=?').bind(id).all()).results;assert(rows.some(a=>a.kind==='note'));await assert.rejects(()=>DB.prepare('UPDATE actions SET kind=? WHERE id=?').bind('changed',rows[0].id).run(),/append-only/);
await DB.prepare('INSERT INTO trips(id,org,label,plan,created,updated) VALUES(?,?,?,?,?,?)').bind('other-org','elsewhere','Private',JSON.stringify([plan]),new Date().toISOString(),new Date().toISOString()).run();assert.equal((await api('trips/other-org')).status,404);
const untrusted={DB,ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'test',TEAM_MEMBERS:'{}'};assert.equal((await api('state',undefined,untrusted)).status,401);
// Validate real JWT cryptography, audience, expiration and organization role mapping using a test keypair.
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='security-test';const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const authEnv={DB,ACCESS_TEAM_DOMAIN:'team-test.cloudflareaccess.com',ACCESS_AUD:'aud-test',TEAM_MEMBERS:JSON.stringify({'reader@example.com':{org:'local',role:'viewer'}})};
const token=async overrides=>{const header=encode({alg:'RS256',kid:jwk.kid}),claims=encode({iss:'https://'+authEnv.ACCESS_TEAM_DOMAIN,aud:['aud-test'],exp:Math.floor(Date.now()/1000)+60,email:'reader@example.com',...overrides});const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(header+'.'+claims));return header+'.'+claims+'.'+Buffer.from(signature).toString('base64url')};const realFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});try{const valid=await token({});const response=await app.fetch(new Request('https://host.example/api/ops/state',{headers:{'Cf-Access-Jwt-Assertion':valid}}),authEnv);assert.equal(response.status,200);const write=await app.fetch(new Request('https://host.example/api/ops/trips',{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':valid},body:JSON.stringify({legs:[plan]})}),authEnv);assert.equal(write.status,403);for(const override of [{aud:['wrong']},{exp:0},{email:'unknown@example.com'}])await assert.rejects(async()=>operationsActor(new Request('https://host.example/',{headers:{'Cf-Access-Jwt-Assertion':await token(override)}}),authEnv))}finally{globalThis.fetch=realFetch}
DB.close();
console.log('Operations: persistent workflows, optimistic concurrency, baseline/no-duplicate alerts, subscriptions, idempotent email adapter, append-only audit, organization isolation and signed-JWT viewer permissions passed.');
