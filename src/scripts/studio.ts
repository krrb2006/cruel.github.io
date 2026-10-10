import { connect, publish, upsert, validateJournal, EMPTY, type Entry, type Journal, REPO } from '../lib/journal';
import { element, renderEntry } from './entry-view';
import defaults from '../data/settings.json';
import { limits, validateSettings, readSettings, publishSettings, type Settings } from '../lib/settings';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const title = $<HTMLInputElement>('entry-title'), text = $<HTMLTextAreaElement>('entry-text'), tags = $<HTMLInputElement>('entry-tags');
const fileInput = $<HTMLInputElement>('entry-photos');
const KEY = 'flower-journal-drafts-v1';
let token = '', sha = '', remote: Journal = structuredClone(EMPTY), drafts: Journal = structuredClone(EMPTY);
let id = crypto.randomUUID() as string, createdAt = new Date().toISOString(), photos: Entry['photos'] = [];
let articleFormat: Entry['format'] = 'markdown';
let busy = false, imageBusy = false, dirty = false, timer: ReturnType<typeof setTimeout> | undefined;
function status(message: string, error = false, connection = false) {
  const node = $(connection ? 'connection-status' : 'editor-status'); node.textContent = message; node.dataset.error = String(error);
}
function entry(): Entry {
  return { id, format: articleFormat, title: title.value.trim() || '未命名草稿', text: text.value, photos: structuredClone(photos),
    tags: [...new Set(tags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean))], createdAt, updatedAt: new Date().toISOString() };
}
function list(target: HTMLElement, items: Entry[], isDraft: boolean) {
  target.replaceChildren();
  if (!items.length) { target.append(element('p', isDraft ? '还没有草稿。' : '暂无已发布手记。', 'muted')); return; }
  for (const item of items) {
    const row = element('div', '', 'saved-item'); const name = element('span', item.title);
    const open = element('button', '编辑', 'quiet'); open.type = 'button';
    open.onclick = () => { if (dirty && !saveDraft()) return; load(item); };
    row.append(name, open);
    if (isDraft) {
      const remove = element('button', '删除', 'quiet'); remove.type = 'button';
      remove.onclick = () => {
        if (!confirm('仅删除本机草稿“' + item.title + '”？公开手记不受影响。')) return;
        const next = { version: 1 as const, entries: drafts.entries.filter(e => e.id !== item.id) };
        try { localStorage.setItem(KEY, JSON.stringify(next)); drafts = next; if (item.id === id) reset(); renderLists(); }
        catch { status('无法删除本机草稿，请检查浏览器存储权限。', true); }
      };
      row.append(remove);
    } else {
      const withdraw = element('button', '撤下', 'quiet'); withdraw.type = 'button';
      withdraw.onclick = () => { void unpublish(item); }; row.append(withdraw);
    }
    target.append(row);
  }
}
function renderLists() { list($('draft-list'), drafts.entries, true); list($('published-list'), remote.entries, false); }
function saveDraft() {
  if (!title.value.trim() && !text.value.trim() && !photos.length) return true;
  try {
    const next = upsert(drafts, entry());
    localStorage.setItem(KEY, JSON.stringify(next)); drafts = next; dirty = false;
    status('草稿已保存到本机 · ' + new Date().toLocaleTimeString('zh-CN')); renderLists(); return true;
  } catch { status('本机存储不足或内容超出限制。当前编辑内容仍在，请先导出备份。', true); return false; }
}
function renderPhotos() {
  const container = $('photo-list'); container.replaceChildren();
  photos.forEach((photo, index) => {
    const box = element('div'); const image = element('img'); image.src = photo.src; image.alt = photo.alt;
    const caption = element('input'); caption.value = photo.alt; caption.maxLength = 200;
    caption.setAttribute('aria-label', '照片 ' + (index + 1) + ' 的说明');
    caption.oninput = () => { photos[index].alt = caption.value; changed(); };
    const remove = element('button', '移除这张照片', 'quiet'); remove.type = 'button';
    remove.onclick = () => {
      if (articleFormat === 'markdown') text.value = text.value.replace(/!\[图片\]\(photo:(\d+)\)/g, (marker, number) => Number(number) === index + 1 ? '' : Number(number) > index + 1 ? '![图片](photo:' + (Number(number) - 1) + ')' : marker);
      photos.splice(index, 1); renderPhotos(); changed();
    };
    const insert = element('button', '插入正文', 'quiet'); insert.type = 'button'; insert.onclick = () => insertText('\n\n![图片](photo:' + (index + 1) + ')\n\n');
    box.append(image, caption, insert, remove); container.append(box);
  });
}
function load(item: Entry) {
  clearTimeout(timer); id = item.id; createdAt = item.createdAt; title.value = item.title;
  text.value = item.text; tags.value = item.tags.join(', '); photos = structuredClone(item.photos); dirty = false;
  articleFormat = item.format; updateCount();
  renderPhotos(); status('已载入“' + item.title + '”。修改后可保存草稿或重新发布。'); title.focus();
}
function reset() {
  clearTimeout(timer); id = crypto.randomUUID(); createdAt = new Date().toISOString();
  title.value = ''; text.value = ''; tags.value = ''; photos = []; dirty = false; renderPhotos();
  articleFormat = 'markdown'; updateCount();
}
function changed() { dirty = true; updateCount(); clearTimeout(timer); timer = setTimeout(saveDraft, 1200); }
function updateCount() { const count = text.value.replace(/\s/g,'').length; $('word-count').textContent = count + ' 字 · 约 ' + Math.max(1,Math.ceil(count / 400)) + ' 分钟阅读'; }
function insertText(value: string) {
  if (busy || imageBusy) return;
  if (text.value.length - (text.selectionEnd - text.selectionStart) + value.length > 30000) { status('正文不能超过 30,000 字。',true); return; }
  articleFormat = 'markdown'; text.setRangeText(value,text.selectionStart,text.selectionEnd,'end'); text.focus(); changed();
}
document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => button.onclick = () => {
  const selected = text.value.slice(text.selectionStart,text.selectionEnd);
  const mode = button.dataset.format;
  const value = mode === 'bold' ? '**' + (selected || '加粗文字') + '**' : mode === 'italic' ? '*' + (selected || '强调文字') + '*' :
    mode === 'divider' ? '\n\n---\n\n' : '\n\n' + (mode === 'heading' ? '## ' : mode === 'quote' ? '> ' : '- ') + (selected || '在这里输入内容') + '\n\n';
  insertText(value);
});
$('insert-photo').onclick = () => {if(!busy && !imageBusy) fileInput.click();};
$('preview-mobile').onclick = () => $('preview-dialog').classList.add('mobile');
$('preview-desktop').onclick = () => $('preview-dialog').classList.remove('mobile');
$<HTMLInputElement>('article-import').onchange = async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file || busy || imageBusy) return;
  try {
    if (!/\.(md|txt)$/i.test(file.name) || file.size > 150000) throw new Error('请选择小于 150KB 的 UTF-8 .md / .txt 文件。');
    const content = await file.text(); if (content.length > 30000 || !content.trim()) throw new Error('正文不能为空或超过 30,000 字。');
    if ((title.value || text.value || photos.length) && !confirm('导入为一篇新文章？当前内容会先保存到本机草稿，不会发布。')) return;
    if (!saveDraft()) return; reset(); title.value = file.name.replace(/\.(md|txt)$/i,'').slice(0,100); text.value = content;
    articleFormat = /\.md$/i.test(file.name) ? 'markdown' : undefined; changed(); status('文章已导入为新草稿。请检查排版并单独上传图片。');
  } catch (error) {status(error instanceof Error ? error.message : '导入失败。',true);}
  finally {input.value='';}
};
try { const raw = localStorage.getItem(KEY); if (raw) drafts = validateJournal(JSON.parse(raw)); }
catch { status('无法读取本机草稿。原存储内容未被修改，可尝试导出备份。', true); }
renderLists();
[title, text, tags].forEach(input => input.addEventListener('input', changed));
$('save-draft').onclick = saveDraft;
$('new-entry').onclick = () => { if (dirty && !saveDraft()) return; reset(); status('开始一封新的来信。'); title.focus(); };
window.addEventListener('beforeunload', event => { if (dirty || busy || imageBusy) event.preventDefault(); });
function setBusy(value: boolean) {
  busy = value;
  document.querySelectorAll<HTMLButtonElement>('.studio-topbar button').forEach(el => el.disabled = value);
  document.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('#settings-form button, #settings-form textarea').forEach(el => el.disabled = value);
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>('.studio-grid button, .studio-grid input, .studio-grid textarea, #disconnect, #connect-form button').forEach(el => el.disabled = value);
}
$('connect-form').onsubmit = async event => {
  event.preventDefault(); if (busy || imageBusy) return;
  const field = $<HTMLInputElement>('github-token'); const candidate = field.value.trim(); field.value = '';
  setBusy(true); status('正在连接 GitHub…', false, true);
  try {
    const result = await connect(candidate); token = candidate; sha = result.sha; remote = result.journal;
    status('已连接站主 krrb2006。令牌仅在当前页面内存中，刷新后需重新连接。', false, true);
    await loadRemoteSettings();
    $<HTMLDetailsElement>('connection-details').open = false; renderLists();
  } catch (error) { token = ''; sha = ''; status(error instanceof Error ? error.message : '连接失败。', true, true); }
  finally { setBusy(false); }
};
$('disconnect').onclick = () => { token = ''; sha = ''; status('已断开，令牌已清除。本机草稿仍然保留。', false, true); };
window.addEventListener('pagehide', () => { token = ''; sha = ''; status('页面已离开，连接已断开。请重新连接后发布。', false, true); });
async function unpublish(item: Entry) {
  if (busy || imageBusy || !token) { status('请先连接 GitHub。', true); return; }
  if (!confirm('从公开手记中撤下“' + item.title + '”？历史提交仍保留原内容。')) return;
  setBusy(true); status('正在撤下手记…');
  try {
    const latest = await connect(token);
    const current = latest.journal.entries.find(e => e.id === item.id);
    if (!current || JSON.stringify(current) !== JSON.stringify(item)) throw new Error('远端手记已改变，请重新连接后再操作。');
    const next: Journal = {version:1,entries:latest.journal.entries.filter(e => e.id !== item.id)};
    const result = await publish(next,latest.sha,token); sha=result.sha;remote=next;renderLists();
    status('手记已从公开数据中撤下，部署完成后生效。草稿和 Git 历史仍然保留。');
  } catch (error) { status(error instanceof Error ? error.message : '撤下失败，请检查网络。',true); }
  finally {setBusy(false);}
}
async function compress(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('仅支持 JPG、PNG、WebP，不支持 SVG、GIF 或其他文件。');
  if (file.size > 15 * 1024 * 1024) throw new Error('单张原图不能超过 15MB。');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 60_000_000) throw new Error('图片尺寸过大，请先缩小原图。');
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('此浏览器不支持图片压缩。');
    context.fillStyle = '#fffdfa'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let src = '';
    for (const quality of [.8,.65,.5,.35]) { src = canvas.toDataURL('image/jpeg', quality); if (src.length <= 300000) break; }
    if (src.length > 300000) throw new Error('图片压缩后仍过大，请换一张较小的图片。');
    return { src, alt: file.name.replace(/\.[^.]+$/, '').slice(0,200) };
  } finally { bitmap.close(); }
}
async function addFiles(files: File[]) {
  if (busy || imageBusy) return;
  if (photos.length + files.length > 4) { status('每篇手记最多 4 张照片。', true); return; }
  imageBusy = true; setBusy(true); status('正在压缩照片…');
  try {
    const additions = []; for (const file of files) additions.push(await compress(file));
    photos.push(...additions); renderPhotos(); changed(); status('照片已加入。可填写说明、保存草稿或预览。');
  } catch (error) { status(error instanceof Error ? error.message : '照片无法读取。', true); }
  finally { imageBusy = false; setBusy(false); fileInput.value = ''; }
}
fileInput.onchange = () => { void addFiles(Array.from(fileInput.files || [])); };
const drop = $('drop-zone');
drop.ondragover = event => { event.preventDefault(); drop.classList.add('dragging'); };
drop.ondragleave = () => drop.classList.remove('dragging');
drop.ondrop = event => { event.preventDefault(); drop.classList.remove('dragging'); void addFiles(Array.from(event.dataTransfer?.files || [])); };
const dialog = $<HTMLDialogElement>('preview-dialog');
dialog.querySelector('button')!.onclick = () => dialog.close();
$('preview-entry').onclick = () => { renderEntry(entry(), $('preview-content')); dialog.showModal(); };
$('entry-form').onsubmit = async event => {
  event.preventDefault(); if (busy || imageBusy) return;
  if (!token || !sha) { status('请先连接 GitHub，再公开发布。你也可以继续保存本机草稿。', true); $<HTMLDetailsElement>('connection-details').open = true; return; }
  if (!title.value.trim() || !text.value.trim()) { status('请填写标题和正文。', true); return; }
  if (!confirm('发布到公开网站？本篇文字与照片会保存到 GitHub，任何人都可以查看。')) return;
  saveDraft(); clearTimeout(timer); setBusy(true);
  status('正在保存到 GitHub，请不要关闭页面…');
  try {
    // Re-read immediately before publishing, merging other devices' unrelated entries.
    const latest = await connect(token);
    const previous = remote.entries.find(e => e.id === id);
    const current = latest.journal.entries.find(e => e.id === id);
    if (previous && (!current || JSON.stringify(previous) !== JSON.stringify(current))) throw new Error('这篇手记已在其他地方修改。请重新连接并载入最新版本；本机草稿保留。');
    const next = upsert(latest.journal, entry());
    const result = await publish(next, latest.sha, token); sha = result.sha; remote = next; dirty = false; renderLists();
    status('已保存到 GitHub。等待自动部署完成后，首页与手记页会更新（通常约 1–2 分钟）。草稿继续保留。');
    const link = element('a', '查看本次提交与发布进度 ↗'); link.href = 'https://github.com/' + REPO + '/actions'; link.target = '_blank'; link.rel = 'noreferrer'; $('editor-status').append(element('br'), link);
  } catch (error) { status((error instanceof Error ? error.message : '发布失败。') + ' 网络中断时请先检查仓库，草稿未删除。', true); }
  finally { setBusy(false); }
};
$('export-drafts').onclick = () => {
  const entries = [...drafts.entries.filter(e => e.id !== id), ...(title.value || text.value || photos.length ? [entry()] : [])];
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,entries},null,2)], {type:'application/json'}));
  const a = element('a'); a.href = url; a.download = 'flower-journal-drafts.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
};
$<HTMLInputElement>('import-drafts').onchange = async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('备份文件不能超过 8MB。');
    const imported = validateJournal(JSON.parse(await file.text()));
    if (dirty && !saveDraft()) return;
    let merged = drafts; for (const item of imported.entries) { if (!merged.entries.some(e => e.id === item.id)) merged = upsert(merged,item); }
    localStorage.setItem(KEY,JSON.stringify(merged)); drafts = merged; renderLists(); status('已导入备份。同编号的现有草稿未覆盖。');
  } catch (error) { status(error instanceof Error ? error.message : '导入失败。',true); }
  finally { input.value = ''; }
};

const SETTINGS_KEY = 'flower-site-settings-v1';
let settingsSha = '', settingsBase: Settings = validateSettings(defaults), settingsDirty = false;
const settingsStatus = $('settings-status');
function formSettings() {
  return validateSettings(Object.fromEntries(Object.keys(limits).map(key => [key, $<HTMLTextAreaElement>('setting-' + key).value])));
}
function fillSettings(value: Settings) {
  for (const key of Object.keys(limits)) $<HTMLTextAreaElement>('setting-' + key).value = value[key as keyof Settings];
}
async function loadRemoteSettings() {
  try {
    const latest = await readSettings(token); settingsSha = latest.sha; settingsBase = latest.settings;
    if (!settingsDirty) fillSettings(latest.settings);
    settingsStatus.textContent = settingsDirty ? '已读取远端版本，本机设置草稿保留。' : '已载入最新网站设置。';
  } catch (error) { settingsSha = ''; settingsStatus.textContent = '网站设置读取失败：' + (error instanceof Error ? error.message : '请重试连接'); }
}
try {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) { fillSettings(validateSettings(JSON.parse(saved))); settingsDirty = true; }
} catch { settingsStatus.textContent = '本机设置草稿无法读取，原数据未修改。'; }
$('settings-form').addEventListener('input', () => {
  settingsDirty = true;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(formSettings())); settingsStatus.textContent = '设置草稿已保存到本机，尚未公开。'; }
  catch { settingsStatus.textContent = '设置未保存，请完整填写并检查浏览器存储空间。'; }
});
const settingsDialog = $<HTMLDialogElement>('settings-dialog');
settingsDialog.querySelector('button')!.onclick = () => settingsDialog.close();
$('settings-preview').onclick = () => {
  try {
    const value = formSettings(), target = $('settings-preview-content'); target.replaceChildren();
    for (const [key, tag] of [['blogName','h2'],['nickname','p'],['headline','h1'],['introduction','p'],['letterTitle','h2'],['letterText','p'],['footerText','p']]) {
      const node = element(tag as keyof HTMLElementTagNameMap, value[key as keyof Settings]); node.style.whiteSpace = 'pre-line'; node.style.overflowWrap = 'anywhere'; target.append(node);
    }
    settingsDialog.showModal();
  } catch (error) { settingsStatus.textContent = error instanceof Error ? error.message : '请检查设置。'; }
};
$('settings-form').onsubmit = async event => {
  event.preventDefault(); if (busy || imageBusy) return;
  if (!token || !settingsSha) { settingsStatus.textContent = '请先连接 GitHub，读取网站设置后发布。'; $<HTMLDetailsElement>('connection-details').open = true; return; }
  let value: Settings;
  try { value = formSettings(); } catch (error) { settingsStatus.textContent = String(error); return; }
  if (!confirm('公开更新网站名称和首页介绍？部署完成后所有访客可见。')) return;
  setBusy(true); settingsStatus.textContent = '正在发布网站设置…';
  try {
    const latest = await readSettings(token);
    if (JSON.stringify(latest.settings) !== JSON.stringify(settingsBase)) throw new Error('远端设置已改变。请重新连接，核对最新内容后再发布，本机草稿保留。');
    const result = await publishSettings(value, latest.sha, token);
    settingsSha = result.content.sha; settingsBase = value; settingsDirty = false;
    try { localStorage.removeItem(SETTINGS_KEY); } catch { /* Publishing succeeds independently of local storage. */ }
    settingsStatus.textContent = '网站设置已提交，等待自动部署完成后生效。刷新首页即可看到更新。';
  } catch (error) { settingsStatus.textContent = (error instanceof Error ? error.message : '网络异常') + '；请检查仓库发布进度，本机草稿保留。'; }
  finally { setBusy(false); }
};
