import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings } from '../src/config';
import { mergeAi, removeChat, removeImage, saveChat, saveImage, switchImage, imageConnection } from '../src/aiparse';
import { CHAT_SOURCES, IMAGE_SOURCES, chatSnapFrom, imageSnapFrom, imageSourceOf } from '../src/catalog';

test('new installations start with hidden center lines, while explicit saved preferences survive', () => {
  assert.equal(mergeSettings(null).guides.center, false);
  assert.equal(mergeSettings({guides: {center: true}}).guides.center, true);
  assert.equal(mergeSettings({guides: {center: false}}).guides.center, false);
});
test('new model lists are empty; a legacy configured service is migrated and can be removed completely', () => {
  assert.deepEqual(mergeAi(null).chats, []); assert.deepEqual(mergeAi(null).images, []);
  const c = mergeAi({apiKey:'fixture',model:'layout',imageOn:true,imageKey:'picture',imageModel:'image'});
  assert.equal(c.chats.length,1); assert.equal(c.images.length,1);
  removeChat(c,c.chatId); removeImage(c,c.imageId);
  const restored=mergeAi(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.chats.length,0); assert.equal(restored.images.length,0);
  assert.equal(restored.apiKey,''); assert.equal(restored.imageKey,'');
});
test('editing another model preserves the default, image options and existing credentials', () => {
  const c=mergeAi(null);const source=IMAGE_SOURCES.find(s=>s.id==='ark')!;
  const first=saveImage(c,{...imageSnapFrom(source,{key:'a',baseUrl:source.baseUrl,model:'ep-1'}),imageSize:'1024x1024',imageFamily:'5.0-pro'});
  const second=saveImage(c,imageSnapFrom(source,{key:'b',baseUrl:source.baseUrl,model:'ep-2'}));
  switchImage(c,first);saveImage(c,{...c.images.find(p=>p.id===second)!.snap,imageAlias:'My model'},second);
  assert.equal(c.imageId,first);assert.equal(c.imageFamily,'5.0-pro');assert.equal(c.imageSize,'1024x1024');assert.equal(c.imageKey,'a');
  removeImage(c,second);assert.equal(c.imageId,first);assert.equal(c.imageFamily,'5.0-pro');
});
test('saved login connections use standard adapter credentials and model identity survives reload', () => {
  const c=mergeAi(null);const source=CHAT_SOURCES.find(s=>s.id==='openrouter')!;
  const a=saveChat(c,chatSnapFrom(source,{key:'oauth-fixture',baseUrl:source.baseUrl,model:'one'}));
  saveChat(c,chatSnapFrom(source,{key:'oauth-fixture',baseUrl:source.baseUrl,model:'two'}));
  const restored=mergeAi(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.chats.find(p=>p.id===a)!.snap.apiKey,'oauth-fixture');assert.equal(restored.chats.length,2);
  assert.equal(imageSourceOf(imageSnapFrom(IMAGE_SOURCES.find(s=>s.id==='openai')!,{key:'x',baseUrl:'https://api.openai.com/v1',model:'gpt-image-1'})).id,'openai');
});

test('legacy inherited image connections keep their actual endpoint and do not borrow a key for an explicit endpoint', () => {
  const snap=imageSnapFrom(IMAGE_SOURCES.find(s=>s.id==='custom')!,{key:'',baseUrl:'',model:'custom-image'});
  const inherited=imageConnection({protocol:'openai',baseUrl:'https://relay.example/v1',apiKey:'layout-key'},snap);
  assert.equal(inherited.imageBaseUrl,'https://relay.example/v1');assert.equal(inherited.imageKey,'layout-key');assert.equal(imageSourceOf(inherited).id,'custom');
  const explicit=imageConnection({protocol:'openai',baseUrl:'https://relay.example/v1',apiKey:'layout-key'},{...snap,imageBaseUrl:'https://another.example/v1'});
  assert.equal(explicit.imageKey,'');assert.equal(snap.imageBaseUrl,'');
});
