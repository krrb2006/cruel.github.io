const gallery = document.querySelector<HTMLElement>('[data-project-gallery]');
if (gallery) {
  const cards = Array.from(gallery.querySelectorAll<HTMLElement>('[data-repo]'));
  gallery.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.onclick = () => {
    gallery.querySelectorAll('[data-filter]').forEach(node => node.setAttribute('aria-pressed',String(node === button)));
    cards.forEach(card => card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter);
  });
  gallery.querySelectorAll<HTMLButtonElement>('[data-detail]').forEach(button => button.onclick = () => {
    const detail = document.getElementById('detail-' + button.dataset.detail) as HTMLDetailsElement;
    detail.open = !detail.open; button.textContent = detail.open ? '收起作品笔记' : '展开作品笔记';
  });
  void Promise.all(cards.map(async card => {
    const stats = card.querySelector<HTMLElement>('[data-stats]')!;
    try {
      const response = await fetch('https://api.github.com/repos/krrb2006/' + card.dataset.repo,{signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('GitHub unavailable');
      const data = await response.json();
      if (typeof data.stargazers_count !== 'number' || typeof data.updated_at !== 'string') throw new Error('Invalid response');
      stats.textContent = (data.language || '多语言') + ' · ☆ ' + data.stargazers_count + ' · 更新于 ' + new Date(data.updated_at).toLocaleDateString('zh-CN');
      if (data.homepage && card.dataset.repo !== 'cruel.github.io') {
        const url = new URL(data.homepage);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          const link = document.createElement('a'); link.textContent = '项目主页 ↗'; link.href = url.href; link.target = '_blank'; link.rel = 'noreferrer';
          card.querySelector('[data-live-link]')!.append(link);
        }
      }
      return true;
    } catch { stats.textContent = stats.textContent!.split(' · ')[0] + ' · 实时信息暂不可用，源码链接仍可访问'; return false; }
  })).then(results => {
    gallery.querySelector('[data-sync-status]')!.textContent = '概念图为原创示意，非产品截图。' + (results.every(Boolean) ? '已同步 GitHub 公开统计；项目功能与版本请以 README 为准。' : '部分 GitHub 信息未能同步，已保留项目介绍和源码链接。');
  });
}
