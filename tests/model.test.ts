import { test } from 'node:test';
import assert from 'node:assert/strict';
import {folderPath,History,parseDesign,safeName,SerialWriter} from '../src/model';
import {en,zh,translate} from '../src/i18n';
const valid = {format:'qiaomu-cover-design',schema:1,width:960,height:1280,canvas:{objects:[]}};
test('design roundtrip and reject incompatible or broken dimensions',()=>{
  assert.equal(parseDesign(JSON.stringify(valid)).width,960);
  for(const change of [{schema:2},{width:0},{height:5000},{width:960.5},{canvas:null},{canvas:{objects:'broken'}}])assert.throws(()=>parseDesign(JSON.stringify({...valid,...change})));
  assert.throws(()=>parseDesign('broken'));
});
test('opening a design cannot trigger external image or prototype payloads',()=>{
  for(const src of ['https://example.com/a.png','file:///tmp/x','data:image/svg+xml;base64,abcd','javascript:x'])assert.throws(()=>parseDesign(JSON.stringify({...valid,canvas:{objects:[{type:'Image',src}]}})));
  assert.throws(()=>parseDesign(JSON.stringify(valid).replace('"objects":[]','"objects":[],"__proto__":{}')));
  assert.doesNotThrow(()=>parseDesign(JSON.stringify({...valid,canvas:{objects:[{type:'Image',src:'data:image/png;base64,YWJj'}]}})));
});
test('folder paths remain within vault; names cannot introduce nested folders',()=>{
  assert.equal(folderPath('Cover designs/Exports/'),'Cover designs/Exports');
  for(const path of ['/tmp/x','../x','x/../y','C:\\x','x//y','x/./y',''])assert.throws(()=>folderPath(path));
  assert.equal(safeName('../a/b:标题'),'a b 标题');
});
test('undo branch discards redo and bounds memory',()=>{
  const h=new History();h.reset('a');h.push('b');h.push('c');assert.equal(h.step(-1),'b');h.push('d');assert.equal(h.step(1),undefined);assert.equal(h.step(-1),'b');assert.equal(h.step(-1),'a');assert.equal(h.step(-1),undefined);
  for(let i=0;i<100;i++)h.push(String(i));let count=0;while(h.step(-1)!==undefined)count++;assert.equal(count,39);
});
test('writes stay ordered after failures, avoiding stale asynchronous saves',async()=>{
  const w=new SerialWriter();const result:number[]=[];
  const a=w.run(async()=>{await new Promise(r=>setTimeout(r,10));result.push(1);});
  const b=w.run(async()=>{result.push(2);throw new Error('failed');});
  const c=w.run(async()=>{result.push(3);});await Promise.allSettled([a,b,c]);assert.deepEqual(result,[1,2,3]);
});
test('complete zh/en keys and interpolation, deterministic unknown locale fallback',()=>{
  assert.deepEqual(Object.keys(en).sort(),Object.keys(zh).sort());
  for(const key of Object.keys(en) as (keyof typeof en)[]){assert.deepEqual(en[key].match(/\{\w+\}/g),zh[key].match(/\{\w+\}/g));}
  assert.equal(translate('zh-CN','exportDone',{path:'设计.png'}),'PNG 已保存：设计.png');assert.equal(translate('xx','save'),'Save');
});
