# 部署与后端方案

## GitHub Pages 能不能部署服务端？

不能。GitHub Pages 只能托管静态文件，适合部署 Vite 构建出来的 `dist/`，不能常驻运行 Node/Python 服务，也不能安全保存模型 API Key。

推荐架构：

```text
GitHub Pages / Vercel Static
  |
  | public VITE_BACKEND_BASE_URL
  v
Backend Proxy
  |
  |-- /api/llm/chat-json -> 模型服务，密钥只在后端环境变量里
  |-- /api/music/search -> QQMusicApi Web 服务
  v
QQMusicApi Web Service
```

可选部署后端：

- Vercel Serverless Functions
- Cloudflare Workers
- Render / Railway / Fly.io
- 腾讯云函数 / 云托管 / 轻量服务器
- 一台自己的 VPS

## 本地开发启动方式

### 1. 配 `.env`

```bash
VITE_BACKEND_BASE_URL=http://localhost:8787

VITE_LLM_BASE_URL=https://api.lkeap.cloud.tencent.com/plan/v3
VITE_LLM_API_KEY=your_key
VITE_LLM_MODEL=hy3-preview

QQ_MUSIC_API_BASE_URL=http://localhost:8080
```

说明：

- `VITE_BACKEND_BASE_URL` 会进入前端包，可以公开。
- `VITE_LLM_API_KEY` 不应该进入生产前端包。生产部署时应只放在后端环境变量中。
- 本地 demo 为了方便，`server/local-proxy.mjs` 会读取 `.env`。

### 2. 启动 QQMusicApi Web 服务

参考官方文档：

```bash
git clone https://github.com/L-1124/QQMusicApi
cd QQMusicApi
uv sync --group web
uv run python web/run.py
```

当前 QQMusicApi Web 服务默认会在 `http://localhost:8080` 暴露 API。

QQMusicApi Web 服务搜索歌曲示例：

```bash
curl "http://localhost:8080/search/search_by_type?keyword=周杰伦&search_type=0&num=5"
```

### 3. 启动本项目后端代理

```bash
npm run server
```

本地代理默认在：

```text
http://localhost:8787
```

可用接口：

```text
POST /api/llm/chat-json
GET  /api/music/search?keyword=周杰伦&num=5
```

### 4. 启动前端

```bash
npm run dev
```

如果 `.env` 是在 dev server 启动后修改的，需要重启 `npm run dev`。

## 为什么要加后端代理？

前端直连模型接口时，`VITE_LLM_API_KEY` 会被打进浏览器 bundle 或出现在网络请求里，任何用户都能看到。后端代理可以把密钥留在服务器环境变量中，前端只调用自己的 `/api/llm/chat-json`。

## 当前 QQMusicApi 接入方式

前端逻辑：

- `generateSoundtrack()` 调 LLM 生成场景。
- LLM 每个场景返回 `searchKeywords`。
- 前端调用 `/api/music/search` 搜真实歌曲。
- 搜索成功时用 QQ 音乐结果替换 mock 歌曲。
- 搜索失败时保留本地 mock，保证演示不断。

后端逻辑：

- `server/local-proxy.mjs` 转发到 `QQ_MUSIC_API_BASE_URL/search/search_by_type`。
- 响应规整为前端统一的 `Song` 结构。

## 版权与播放提醒

QQMusicApi 文档提示“请尊重版权，支持正版”，项目也声明仅用于技术可行性探索。黑客松 demo 中建议：

- 优先展示搜索、推荐、跳转和短试听能力。
- 播放 URL 获取失败时保留模拟播放器。
- 不做批量下载、缓存和商业分发。
