import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArticle } from '../src/scripts/article-format.ts';
class Node {
  constructor(tag,text=''){this.tagName=tag.toUpperCase();this.textContent=text;this.children=[];}
  append(...nodes){this.children.push(...nodes);}
}
globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>new Node('text',text)};
const render=text=>{const root=new Node('article');renderArticle(text,root,index=>index===0?new Node('figure'):null);return root;};
test('article headings, quotations, lists and dividers render structurally',()=>{
  const root=render('## 标题\n\n> 引用\n\n- 第一项\n- 第二项\n\n---');
  assert.deepEqual(root.children.map(n=>n.tagName),['H3','BLOCKQUOTE','UL','HR']);
  assert.equal(root.children[2].children.length,2);
});
test('bold and italic are nodes, raw HTML remains literal text',()=>{
  const root=render('**加粗** 与 *强调* <script>alert(1)</script>');
  const nodes=root.children[0].children;
  assert.ok(nodes.some(n=>n.tagName==='STRONG'&&n.textContent==='加粗'));
  assert.ok(nodes.some(n=>n.tagName==='EM'&&n.textContent==='强调'));
  assert.ok(nodes.some(n=>n.tagName==='TEXT'&&n.textContent.includes('<script>')));
  assert.ok(!nodes.some(n=>n.tagName==='SCRIPT'));
});
test('local image references resolve while missing images degrade safely',()=>{
  const root=render('![图片](photo:1)\n\n![图片](photo:8)');
  assert.equal(root.children[0].tagName,'FIGURE');
  assert.equal(root.children[1].textContent,'[图片已移除]');
});
test('external image markup remains text and does not create remote images',()=>{
  const root=render('![外部](https://example.com/image.jpg)');
  assert.equal(root.children[0].tagName,'P');
  assert.equal(root.children[0].children[0].textContent,'![外部](https://example.com/image.jpg)');
});
