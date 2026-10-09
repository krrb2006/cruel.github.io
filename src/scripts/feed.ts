import { validateJournal, type Entry } from '../lib/journal';
import { element, renderEntry } from './entry-view';
const feed = document.querySelector<HTMLElement>('[data-feed]');
if (feed) {
  const base = feed.dataset.base!, compact = feed.dataset.compact === 'true';
  const grid = feed.querySelector<HTMLElement>('.journal-grid')!, status = feed.querySelector<HTMLElement>('.feed-status')!;
  const search = document.getElementById('journal-search') as HTMLInputElement | null;
  const tag = document.getElementById('journal-tag') as HTMLSelectElement | null;
  const favoriteButton = document.getElementById('favorites-only') as HTMLButtonElement | null;
  const dialog = document.getElementById('entry-dialog') as HTMLDialogElement;
  const lightbox = document.getElementById('photo-dialog') as HTMLDialogElement;
  let entries: Entry[] = [], onlyFavorites = false, favorites: string[] = [];
  try { const value = JSON.parse(localStorage.getItem('flower-favorites') || '[]'); if (Array.isArray(value)) favorites = value.filter(v => typeof v === 'string'); } catch {}
  function openEntry(item: Entry, updateURL = true) {
    if (item.id === 'first-post') { location.assign(base + 'posts/first-post/'); return; }
    renderEntry(item, document.getElementById('entry-content')!, showPhoto);
    if (!dialog.open) dialog.showModal();
    if (!compact && updateURL) { const url = new URL(location.href); url.searchParams.set('id',item.id); history.replaceState(null,'',url); }
  }
  dialog.querySelector('button')!.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (!compact) { const url = new URL(location.href); url.searchParams.delete('id'); history.replaceState(null,'',url); } });
  lightbox.querySelector('button')!.onclick = () => lightbox.close();
  function showPhoto(photo: Entry['photos'][number]) {
    lightbox.querySelector('img')!.src = photo.src; lightbox.querySelector('img')!.alt = photo.alt;
    lightbox.querySelector('p')!.textContent = photo.alt; lightbox.showModal();
  }
  function draw() {
    grid.replaceChildren();
    const query = search?.value.trim().toLocaleLowerCase() || '';
    const selected = entries.filter(e => (!query || [e.title,e.text,...e.tags].join(' ').toLocaleLowerCase().includes(query)) &&
      (!tag?.value || e.tags.includes(tag.value)) && (!onlyFavorites || favorites.includes(e.id)));
    status.textContent = selected.length ? (compact ? '新写下的来信' : '找到 ' + selected.length + ' 篇手记') :
      entries.length ? '没有匹配的手记，试试其他关键词或标签。' : '新的图文手记会在这里慢慢积攒。';
    for (const item of (compact ? selected.slice(0,3) : selected)) {
      const card = element('article','','journal-card');
      if (item.photos[0]) {
        const image = element('img'); image.src = item.photos[0].src; image.alt = item.photos[0].alt; image.loading = 'lazy';
        image.tabIndex = 0; image.setAttribute('role','button'); image.setAttribute('aria-label','放大照片：' + (image.alt || item.title));
        image.onclick = () => showPhoto(item.photos[0]); image.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPhoto(item.photos[0]); } }; card.append(image);
      }
      card.append(element('p',new Date(item.createdAt).toLocaleDateString('zh-CN') + ' · ' + item.tags.join(' / '),'entry-date'),
        element('h3',item.title),element('p',item.text.slice(0,120) + (item.text.length > 120 ? '…' : '')));
      const actions = element('div','','inline-controls'), read = element('button','读这封来信','quiet');
      read.onclick = () => openEntry(item); actions.append(read);
      const favorite = element('button',favorites.includes(item.id) ? '已收藏 ♡' : '收藏 ♡','quiet');
      favorite.setAttribute('aria-pressed',String(favorites.includes(item.id)));
      favorite.onclick = () => {
        const next = favorites.includes(item.id) ? favorites.filter(id => id !== item.id) : [...favorites,item.id];
        try { localStorage.setItem('flower-favorites',JSON.stringify(next)); favorites = next; draw(); }
        catch { status.textContent = '此浏览器无法保存收藏，请检查存储权限。'; }
      }; actions.append(favorite);
      if (!compact) {
        const share = element('button','复制链接','quiet');
        share.onclick = async () => {
          try { const url = new URL(base + (item.id === 'first-post' ? 'posts/first-post/' : 'journal/'),location.origin); if (item.id !== 'first-post') url.searchParams.set('id',item.id); await navigator.clipboard.writeText(url.href); status.textContent = '手记链接已复制。'; }
          catch { status.textContent = '复制失败。请点开手记后从地址栏复制链接。'; }
        }; actions.append(share);
      }
      card.append(actions); grid.append(card);
    }
  }
  search?.addEventListener('input',draw); tag?.addEventListener('change',draw);
  favoriteButton?.addEventListener('click',() => { onlyFavorites = !onlyFavorites; favoriteButton.setAttribute('aria-pressed',String(onlyFavorites)); favoriteButton.textContent = onlyFavorites ? '显示全部手记' : '只看本机收藏'; draw(); });
  async function fetchEntries() {
    try {
      const response = await fetch(base + 'journal.json', {cache:'no-cache',signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error();
      entries = validateJournal(await response.json()).entries.sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
      if (!compact) entries.push({id:'first-post',title:'我的第一篇博客',text:'从“我想做点什么”，到“我真的做出来了”。一个认真开始的故事。',tags:['建站手记','成长'],photos:[],createdAt:'2026-04-03T00:00:00.000Z',updatedAt:'2026-04-03T00:00:00.000Z'});
      if (tag) { for (const value of [...new Set(entries.flatMap(e => e.tags))].sort()) { const option = element('option',value); option.value = value; tag.append(option); } }
      draw(); const selected = new URL(location.href).searchParams.get('id');
      if (selected && !compact) { const item = entries.find(e => e.id === selected); if (item) openEntry(item,false); else status.textContent = '这封来信不存在或还未部署，请稍后刷新。'; }
    } catch {
      status.textContent = '手记暂时未能加载。'; const retry = element('button','重新加载','quiet');
      retry.onclick = () => { status.textContent = '正在重试…'; void fetchEntries(); }; status.append(retry);
    }
  }
  void fetchEntries();
}
