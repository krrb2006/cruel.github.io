import { request, encodeContent, decodeContent, REPO } from './journal.ts';
export const limits = { blogName: 40, nickname: 40, headline: 160, introduction: 1000, letterTitle: 160, letterText: 1000, footerText: 160 };
export type Settings = Record<keyof typeof limits, string>;
export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('网站设置格式错误。');
  const result = {} as Settings;
  for (const [key, limit] of Object.entries(limits)) {
    const text = (value as Record<string, unknown>)[key];
    if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new Error('请完整填写设置，并遵守字数限制。');
    result[key as keyof Settings] = text.trim();
  }
  return result;
}
const path = '/repos/' + REPO + '/contents/src/data/settings.json';
export async function readSettings(token: string, fetcher: typeof fetch = fetch) {
  const data = await request(path + '?ref=main', token, {}, fetcher);
  return { settings: validateSettings(JSON.parse(decodeContent(data.content))), sha: data.sha as string };
}
export async function publishSettings(settings: Settings, sha: string, token: string, fetcher: typeof fetch = fetch) {
  return request(path, token, { method: 'PUT', body: JSON.stringify({
    message: 'Update website identity from writing studio', branch: 'main', sha,
    content: encodeContent(JSON.stringify(validateSettings(settings), null, 2) + '\n')
  }) }, fetcher);
}
