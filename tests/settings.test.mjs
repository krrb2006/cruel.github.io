import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings, readSettings, publishSettings } from '../src/lib/settings.ts';
import { encodeContent, decodeContent } from '../src/lib/journal.ts';
const settings = {blogName:'新的名字 🌷',nickname:'小花',headline:'第一行\n第二行',introduction:'你好',letterTitle:'欢迎',letterText:'慢慢读',footerText:'今天很好'};
const response = data => new Response(JSON.stringify(data), {status:200});
test('settings preserve Chinese and line breaks while rejecting missing or excessive fields', () => {
  assert.deepEqual(validateSettings(settings),settings);
  assert.throws(() => validateSettings({...settings,blogName:''}));
  assert.throws(() => validateSettings({...settings,headline:'x'.repeat(161)}));
  assert.throws(() => validateSettings({blogName:'不完整'}));
});
test('settings read remote immutable revision and publish authenticated SHA guarded updates', async () => {
  const remote = await readSettings('secret',async () => response({sha:'revision',content:encodeContent(JSON.stringify(settings))}));
  assert.deepEqual(remote.settings,settings);
  assert.equal(remote.sha,'revision');
  await publishSettings(settings,remote.sha,'secret',async (url,options) => {
    assert.ok(url.endsWith('/contents/src/data/settings.json'));
    assert.equal(options.headers.Authorization,'Bearer secret');
    const body = JSON.parse(options.body);
    assert.equal(body.sha,'revision'); assert.equal(body.branch,'main');
    assert.deepEqual(JSON.parse(decodeContent(body.content)),settings);
    assert.ok(!decodeContent(body.content).includes('secret'));
    return response({content:{sha:'new-revision'}});
  });
});
