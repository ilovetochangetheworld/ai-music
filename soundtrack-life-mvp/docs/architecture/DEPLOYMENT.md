# Pages + VPS 部署

## Web 前端

`npm run build` 在 `dist/` 生成 GitHub Pages 产物，基础路径为 `/ai-music/`。除非明确设置 `VITE_ENABLE_TUNING_DEMO=true`，生产修音功能保持关闭。

## VPS

1. 将仓库安装到 `/opt/ai-practice-room`，按 `services/analysis/requirements.txt` 创建 `services/analysis/.venv`。
2. 将密钥和允许来源写入 `/etc/ai-practice-room/bff.env`，设置 `ANALYSIS_BASE_URL=http://127.0.0.1:8790`。
3. 安装 `ops/systemd/ai-practice-analysis.service` 和 `ops/systemd/ai-practice-bff.service`。
4. 只反向代理 Node BFF；FastAPI 仅绑定回环地址。
5. 开放生产流量前验证 `/health`、25MB 超限拒绝、损坏请求和 24 小时过期清理。

当前 Web 客户端将录音保留在设备端。未来上传界面必须先取得明确同意，才能调用 BFF。
