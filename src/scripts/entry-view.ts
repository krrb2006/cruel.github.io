import type { Entry } from '../lib/journal';
import { renderArticle } from './article-format';
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function renderEntry(entry: Entry, target: HTMLElement, onPhoto?: (photo: Entry['photos'][number]) => void) {
  target.replaceChildren();
  const article = element('article', '', 'entry-detail');
  article.append(element('p', new Date(entry.createdAt).toLocaleDateString('zh-CN'), 'entry-date'), element('h2', entry.title),
    element('p', entry.tags.map(t => '#' + t).join(' '), 'entry-tags'));
  const used = new Set<number>();
  function photoFigure(index: number) {
    const photo = entry.photos[index]; if (!photo) return null; used.add(index);
    const figure = element('figure'); const image = element('img'); image.src = photo.src; image.alt = photo.alt;
    if (onPhoto) {
      image.tabIndex = 0; image.setAttribute('role','button'); image.setAttribute('aria-label','放大照片：' + (photo.alt || entry.title));
      image.style.cursor = 'zoom-in'; image.onclick = () => onPhoto(photo);
      image.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();onPhoto(photo);} };
    }
    figure.append(image, element('figcaption', photo.alt, 'entry-caption')); return figure;
  }
  if (entry.format === 'markdown') renderArticle(entry.text, article, photoFigure);
  else article.append(element('p', entry.text));
  entry.photos.forEach((_,index) => {if (!used.has(index)) {const figure=photoFigure(index);if(figure)article.append(figure);}});
  target.append(article);
}
