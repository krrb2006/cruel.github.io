import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeContent, decodeContent, validateJournal, upsert, readRemote, connect, publish } from '../src/lib/journal.ts';
const entry = {id:'test-1',title:'春日来信',text:'中文与 🌸\n<script>只是文字</script>',tags:['日常'],photos:[],createdAt:'2026-10-09T00:00:00.000Z',updatedAt:'2026-10-09T00:00:00.000Z'};
const journal = {version:1,entries:[entry]};
const response = data => new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
test('UTF-8 content preserves Chinese, emoji and line breaks', () => assert.equal(decodeContent(encodeContent(entry.text)),entry.text));
test('validation rejects duplicate IDs and executable photo URLs', () => {
  assert.throws(() => validateJournal({version:1,entries:[entry,entry]}));
  assert.throws(() => validateJournal({version:1,entries:[{...entry,photos:[{src:'javascript:alert(1)',alt:'test'}]}]}));
});
test('validation rejects oversized fields and invalid dates', () => {
  assert.throws(() => validateJournal({version:1,entries:[{...entry,title:'x'.repeat(101)}]}));
  assert.throws(() => validateJournal({version:1,entries:[{...entry,updatedAt:'invalid'}]}));
});
test('upsert retains unrelated entries and does not mutate original', () => {
  const other = {...entry,id:'test-2'}, original = {version:1,entries:[entry,other]};
  const updated = upsert(original,{...entry,title:'新版'});
  assert.equal(updated.entries.length,2); assert.equal(updated.entries[1].id,'test-2'); assert.equal(original.entries[0].title,'春日来信');
});
test('remote reads preserve SHA and authenticate only to GitHub', async () => {
  const data = await readRemote('test-secret',async (url,options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/krrb2006/cruel.github.io/'));
    assert.equal(options.headers.Authorization,'Bearer test-secret');
    return response({sha:'original-sha',encoding:'base64',content:encodeContent(JSON.stringify(journal))});
  });
  assert.equal(data.sha,'original-sha'); assert.deepEqual(data.journal,journal);
});
test('remote reads large content by immutable blob SHA', async () => {
  let calls = 0;
  const data = await readRemote('secret',async url => {
    calls++;
    if(calls===1) return response({sha:'large-blob',encoding:'none'});
    assert.ok(url.endsWith('/git/blobs/large-blob'));
    return response({content:encodeContent(JSON.stringify(journal))});
  });
  assert.equal(calls,2); assert.deepEqual(data.journal,journal);
});
test('connect rejects another account before reading or writing contents', async () => {
  let calls=0;
  await assert.rejects(connect('secret',async()=>{calls++;return response({login:'someone-else'});}),/站主/);
  assert.equal(calls,1);
});
test('publish uses explicit main branch and compare-and-swap SHA without storing token in content', async () => {
  const result = await publish(journal,'current-sha','test-secret',async(_url,options)=>{
    assert.equal(options.method,'PUT'); const body=JSON.parse(options.body);
    assert.equal(body.branch,'main'); assert.equal(body.sha,'current-sha');
    assert.deepEqual(JSON.parse(decodeContent(body.content)),journal);
    assert.ok(!options.body.includes('test-secret'));
    return response({content:{sha:'new-sha'},commit:{html_url:'https://github.com/krrb2006/cruel.github.io/commit/test'}});
  });
  assert.equal(result.sha,'new-sha');
});
test('conflicts and expired credentials return clear errors and do not mutate content',async()=>{
  await assert.rejects(publish(journal,'old-sha','secret',async()=>new Response('{}',{status:409})),/没有覆盖/);
  await assert.rejects(readRemote('secret',async()=>new Response('{}',{status:401})),/过期/);
  assert.equal(journal.entries.length,1);
});
