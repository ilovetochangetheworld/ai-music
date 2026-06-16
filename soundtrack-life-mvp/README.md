# 人生原声机 MVP


## 一句话

人生原声机把用户一天的轨迹、情绪和长音频内容，生成一张“我的电影原声带”：既能为今天配 BGM，也能把播客/有声书变成可导航、可速听、可追问的音频地图。


## MVP 主体验

用户输入今天发生的事，或上传/选择一段播客、有声书。系统生成：

1. 今日情绪轨迹
2. 分场景 BGM 歌单
3. 电影式旁白/电台口播
4. 长音频章节地图
5. 可追问的“只听重点”导航

## 两个核心模式

### A. 日轨 BGM

输入：

```text
今天早上通勤很堵，上午做了一个重要汇报，下午被老板夸了，晚上想一个人散步。
```

输出：

- 4 个时间段：通勤、压力、释放、夜晚散步
- 每段 2-3 首推荐歌
- 一条情绪曲线
- 一段 AI DJ 旁白
- 一张可分享的“今日原声带”卡片

### B. 长音频速听教练

输入：

```text
一段 60 分钟播客转写文本，主题是 AI 音乐、版权和创作者经济。
```

输出：

- 自动章节
- 3 分钟摘要
- 15 分钟精听路线
- 争议点/金句/人物/术语
- 用户追问：“只听关于版权风险的部分”

## 推荐收敛版本

首选做一个 Web App：

- 首页：输入“今天发生了什么”或粘贴长音频转写文本
- 结果页：左侧是时间线，右侧是歌单/章节/旁白
- 播放体验：用模拟播放器 + TTS 音频/文本旁白即可
- 分享页：生成一张“我的今日电影原声”卡片

## 本地运行

```bash
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建
```

默认运行在 **MOCK 引擎**：无需联网或 API 密钥即可走通完整链路。如需接入真实大模型，复制 `.env.example` 为 `.env` 并填入兼容 OpenAI Chat Completions 协议的 `VITE_LLM_BASE_URL` / `VITE_LLM_API_KEY`，应用会自动切换为 LLM 引擎，调用失败时仍会降级回 mock。

技术栈：Vite + React + TypeScript + React Router + Framer Motion。架构与约定见 [CODEBUDDY.md](CODEBUDDY.md)。

详见：

- [产品方案](docs/product-brief.md)
- [MVP 计划](docs/mvp-plan.md)
- [开发 Checklist](docs/build-checklist.md)
- [功能接入与改进路线](docs/integration-and-improvements.md)
- [部署与后端方案](docs/deployment-and-backend.md)
- [技术方案](docs/technical-design.md)
- [数据与接口](docs/data-model.md)
- [演示脚本](demo/demo-script.md)
- [Prompt 模板](prompts/)
