# Pages + VPS deployment

## Web

`npm run build` produces the GitHub Pages bundle under `dist/` with `/ai-music/` as its base. Production tuning remains disabled unless `VITE_ENABLE_TUNING_DEMO=true` is explicitly set.

## VPS

1. Install the repository at `/opt/ai-practice-room` and create `services/analysis/.venv` from `services/analysis/requirements.txt`.
2. Put secrets and origins in `/etc/ai-practice-room/bff.env`; set `ANALYSIS_BASE_URL=http://127.0.0.1:8790`.
3. Install `ops/systemd/ai-practice-analysis.service` and `ops/systemd/ai-practice-bff.service`.
4. Reverse proxy only the Node BFF. Keep FastAPI bound to loopback.
5. Verify `/health`, a 25MB rejection, a damaged request, and 24-hour expiry before enabling production traffic.

The current web client keeps recordings on-device. A future upload UI must obtain explicit consent before calling the BFF.
