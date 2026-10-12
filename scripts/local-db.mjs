import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
export function localDatabase(filename){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true,mode:0o700});
 const previousMask=process.umask(0o077);let database;try{database=new DatabaseSync(filename)}finally{process.umask(previousMask)}if(filename!==':memory:'&&existsSync(filename))chmodSync(filename,0o600);database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 database.exec(readFileSync(new URL('../migrations/0001_operations.sql',import.meta.url),'utf8'));
 const prepare=sql=>{let args=[];const statement={bind(...values){args=values;return statement},async first(){return database.prepare(sql).get(...args)||null},async all(){return {results:database.prepare(sql).all(...args)}},async run(){const r=database.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}},_run(){return database.prepare(sql).run(...args)}};return statement};
 return {prepare,async batch(statements){database.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>{const r=s._run();return {meta:{changes:Number(r.changes)}}});database.exec('COMMIT');return results}catch(e){database.exec('ROLLBACK');throw e}},close(){database.close()}};
}
