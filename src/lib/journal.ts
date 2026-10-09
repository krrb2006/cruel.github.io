export interface Photo { src: string; alt: string }
export interface Entry {
  id: string; title: string; text: string; tags: string[]; photos: Photo[];
  createdAt: string; updatedAt: string;
}
export interface Journal { version: 1; entries: Entry[] }
export const EMPTY: Journal = { version: 1, entries: [] };
export const REPO = 'krrb2006/cruel.github.io';
const FILE = 'public/journal.json';
export function validateJournal(value: unknown): Journal {
  const data = value as Journal;
  if (!data || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 300) throw new Error('手记数据格式不正确。');
  const ids = new Set<string>();
  for (const item of data.entries) {
    if (!item || typeof item.id !== 'string' || item.id === 'first-post' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error('手记编号重复或无效。');
    ids.add(item.id);
    if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 ||
        typeof item.text !== 'string' || item.text.length > 30000 ||
        !Array.isArray(item.tags) || item.tags.length > 8 || item.tags.some(t => typeof t !== 'string' || t.length > 24) ||
        !Array.isArray(item.photos) || item.photos.length > 4 ||
        typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
        typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('手记内容超出限制或格式错误。');
    for (const photo of item.photos) {
      if (!photo || typeof photo.alt !== 'string' || photo.alt.length > 200 ||
          typeof photo.src !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.src) || photo.src.length > 300000) throw new Error('图片须为压缩后的 JPEG。');
    }
  }
  return data;
}
export function encodeContent(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeContent(text: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
}
type Fetcher = typeof fetch;
async function request(path: string, token: string, init: RequestInit = {}, fetcher: Fetcher = fetch) {
  const response = await fetcher('https://api.github.com' + path, {
    ...init, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('令牌无效或已过期，请重新连接。');
    if (response.status === 403) throw new Error('没有写入权限或 API 次数受限。请检查令牌的 Contents 读写权限。');
    if (response.status === 409 || response.status === 422) throw new Error('仓库有新改动，本次没有覆盖。请重新连接后再发布；草稿仍在。');
    throw new Error('GitHub 请求失败（' + response.status + '），请检查网络与仓库权限。');
  }
  return response.json();
}
export async function readRemote(token: string, fetcher: Fetcher = fetch): Promise<{ journal: Journal; sha: string }> {
  const metadata = await request('/repos/' + REPO + '/contents/' + FILE + '?ref=main', token, {}, fetcher);
  const content = metadata.encoding === 'base64' ? metadata.content :
    (await request('/repos/' + REPO + '/git/blobs/' + metadata.sha, token, {}, fetcher)).content;
  return { journal: validateJournal(JSON.parse(decodeContent(content))), sha: metadata.sha };
}
export async function connect(token: string, fetcher: Fetcher = fetch) {
  const account = await request('/user', token, {}, fetcher);
  if (account.login.toLowerCase() !== 'krrb2006') throw new Error('请使用站主 krrb2006 的 GitHub 账户。');
  return readRemote(token, fetcher);
}
export async function publish(journal: Journal, sha: string, token: string, fetcher: Fetcher = fetch) {
  validateJournal(journal);
  const serialized = JSON.stringify(journal);
  if (new TextEncoder().encode(serialized).length > 8 * 1024 * 1024) throw new Error('手记总量超过 8MB，请先导出备份并减少图片。');
  const result = await request('/repos/' + REPO + '/contents/' + FILE, token, {
    method: 'PUT', body: JSON.stringify({ message: 'Publish journal from writing studio', content: encodeContent(serialized), sha, branch: 'main' })
  }, fetcher);
  return { sha: result.content.sha as string, url: result.commit.html_url as string };
}
export function upsert(journal: Journal, entry: Entry): Journal {
  return validateJournal({ version: 1, entries: [entry, ...journal.entries.filter(e => e.id !== entry.id)] });
}
