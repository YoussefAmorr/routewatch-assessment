import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist/server/',root),{recursive:true});
await copyFile(new URL('worker/index.js',root),new URL('dist/server/index.js',root));
console.log('Built dist/server/index.js');
