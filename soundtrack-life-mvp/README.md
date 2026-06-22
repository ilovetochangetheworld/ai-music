# AI 练歌房

移动端优先的陪伴式练歌产品。用户负责唱，小麦负责安静倾听；唱后依据真实采集信号给出音高、节奏、呼吸、表达和一致性反馈。参考数据或录音质量不足时不生成总分。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:5173/#/`。首首可练歌曲为《轨迹》原型；歌曲资产仅用于内部原型，不代表商业授权。

分析服务与 BFF：

```bash
python3 -m venv services/analysis/.venv
services/analysis/.venv/bin/pip install -r services/analysis/requirements.txt
PYTHONPATH=services/analysis services/analysis/.venv/bin/uvicorn app.main:app --port 8790
npm run server
```

## 质量命令

```bash
npm run typecheck
npm run lint
npm test
npm run test:analysis
npm run catalog:validate
npm run build
```

非主线实验保留在 `#/lab/soundtrack` 与 `#/lab/audio-coach`。项目协作规范以根目录 [`AGENTS.md`](../AGENTS.md) 为准，文档入口见 [`docs/README.md`](docs/README.md)。
