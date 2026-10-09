# 在网站里写作

打开网站页脚的「写作台」，或访问 /cruel.github.io/studio/。

## 第一次连接

在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌。
Repository access 只选择 krrb2006/cruel.github.io，Contents 权限设为 Read and write，设置有效期。
在写作台输入令牌并连接。令牌只保留在当前页面内存，刷新、离开或断开后需要重新连接。
请不要把令牌写进文章、提交到仓库或发到聊天。

官方说明：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## 图文发布

1. 写标题与正文（纯文字和换行），添加逗号分隔的标签。
2. 选择或拖入最多 4 张 JPG、PNG、WebP 图片；单张原图不超过 15MB。
3. 图片会被缩至最长边 1400px，压缩为 JPEG 并移除原始元数据。透明区域使用纸白背景。
4. 可修改照片说明、移除照片、预览并保存本机草稿。
5. 点击发布，确认内容适合公开。图片和文字会作为 public/journal.json 的一条记录提交到 main，触发现有 GitHub Pages 自动部署。
6. 部署完成后，所有访客都可在首页与手记页看到内容。

本机草稿与收藏只在当前浏览器中保存，不是云端同步。建议定期导出 JSON 备份；可通过导入在另一台设备恢复。
公开内容保存于 Git 仓库，可通过提交历史恢复。已发布内容在写作台列表中编辑后再次发布即可更新；也可撤下，撤下不清除 Git 历史。
每篇正文上限 30000 字符、8 个标签。总公开数据限制 8MB，适合个人轻量图文手记。

发布前会合并其他设备新增的手记；同篇出现远端修改或 GitHub SHA 冲突时会停止覆盖，并保留草稿。
网络中断可能发生在 GitHub 已收到提交之后，重试前可先查看仓库 Actions 和提交历史。

## 访问与特效

手记页提供正文/标题/标签搜索、标签筛选、本机收藏、独立分享链接、图文阅读与图片放大。
首页展示最新 3 篇手记。现有第一篇博客仍保留在原地址。
花瓣效果默认关闭，可在页脚开启；尊重系统减少动态效果偏好。顶部为阅读进度条，滚动后可一键回到页首。

## 验证

- npm run build
- npm run astro -- check
- node --test tests/journal.test.mjs

GitHub API 的公开发布流程有模拟测试覆盖。首次真实发布需要站主自己连接令牌；没有把本机 CLI 的登录凭据嵌入页面。
