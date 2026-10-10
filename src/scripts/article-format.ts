export function inline(text: string, target: HTMLElement) {
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    target.append(document.createTextNode(text.slice(start, match.index)));
    const node = document.createElement(match[1] ? 'strong' : 'em');
    node.textContent = match[1] || match[2]; target.append(node); start = match.index! + match[0].length;
  }
  target.append(document.createTextNode(text.slice(start)));
}
export function renderArticle(text: string, target: HTMLElement, photo: (index: number) => HTMLElement | null) {
  const lines = text.split('\n');
  let paragraph: string[] = [], list: HTMLElement | null = null;
  const flush = () => {
    if (paragraph.length) { const p = document.createElement('p'); inline(paragraph.join('\n'), p); target.append(p); paragraph = []; }
    list = null;
  };
  for (const line of lines) {
    const image = /^!\[图片\]\(photo:(\d+)\)$/.exec(line.trim());
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^(?:[-*]\s+|\d+\.\s+)(.+)$/.exec(line);
    if (image) { flush(); const node = photo(Number(image[1]) - 1); if (node) target.append(node); else {const p=document.createElement('p');p.textContent='[图片已移除]';target.append(p);} }
    else if (heading) { flush();const node=document.createElement('h' + (heading[1].length + 1));inline(heading[2],node);target.append(node); }
    else if (/^---+$/.test(line.trim())) {flush();target.append(document.createElement('hr'));}
    else if (line.startsWith('> ')) {flush();const node=document.createElement('blockquote');inline(line.slice(2),node);target.append(node);}
    else if (bullet) {
      if (paragraph.length) flush();
      const tag = /^\d+\./.test(line) ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) {list=document.createElement(tag);target.append(list);}
      const li=document.createElement('li');inline(bullet[1],li);list.append(li);
    } else if (!line.trim()) flush();
    else {list=null;paragraph.push(line);}
  }
  flush();
}
