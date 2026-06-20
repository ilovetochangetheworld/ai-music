# AGENTS.md

## Mission

This repository now builds **AI 练歌房**, a mobile-first, companion-led singing practice product. The user sings; the single companion 小麦 listens, records, analyzes, and responds after the performance. Professional feedback must be evidence-backed and low-pressure.

The active product does **not** include QQ Music, playlist management, rankings, voice cloning, or unsolicited real-time correction. Legacy soundtrack and long-audio experiments live under `/lab` only.

## Sources of truth

Read in this order before changing behavior:

1. `AGENTS.md`
2. `soundtrack-life-mvp/docs/product/AI_PRACTICE_ROOM_PRD.md`
3. `soundtrack-life-mvp/docs/architecture/AI_PRACTICE_ROOM_TECH.md`
4. `soundtrack-life-mvp/shared/schema/`
5. implementation and tests

If these conflict, stop and record a decision in `docs/project/DECISIONS.md`; do not silently broaden scope.

## Repository map

- `soundtrack-life-mvp/src/features/practice-room/`: active web product.
- `soundtrack-life-mvp/src/features/sing-room/`: transitional audio runtime; migrate rather than duplicate.
- `soundtrack-life-mvp/shared/schema/`: language-neutral contracts.
- `soundtrack-life-mvp/server/`: public Node BFF.
- `soundtrack-life-mvp/services/analysis/`: internal Python CPU analysis service.
- `soundtrack-life-mvp/public/catalog/`: deployable song packages and validation metadata.
- `soundtrack-life-mvp/docs/project/`: roadmap, merged status, decisions, and handoffs.

## Commands and gates

Run from `soundtrack-life-mvp/`:

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:analysis
npm run catalog:validate
```

No task is done until relevant tests and `npm run build` pass. Scoring changes also require contract fixtures and Python tests.

## Product and scoring constraints

- Scores are deterministic outputs; LLMs may rewrite wording but may not calculate or alter scores.
- Do not claim pitch accuracy without a reference melody or breath physiology from microphone audio.
- If vocal coverage is below 20%, noise is excessive, or confidence is insufficient, return `insufficient_data` instead of inventing a score.
- Raw recordings must not leave the device without explicit consent. Server uploads are capped at 25 MB and expire within 24 hours.
- Tuning never overwrites the original and must not clone another person's voice.
- Existing song assets are prototype-only and are not proof of commercial rights.

## Multi-agent workflow

- One issue, one task ID, one branch, one PR. Never push directly to `main`.
- Codex branches: `codex/apr-<task-id>-<slug>`; other agents: `<agent>/apr-<task-id>-<slug>`.
- Claim the GitHub issue before editing. If GitHub is unavailable, create `docs/project/handoffs/APR-<task-id>.md` from the task template.
- Preserve unrelated dirty files. Do not reformat or rewrite files outside the task boundary.
- Avoid parallel ownership of the same module. Contracts must merge before consumers.
- PR handoff must include base/head SHA, changed behavior, commands run, evidence, risks, and unfinished work.
- `STATUS.md` describes merged `main` only and is updated by the integration owner after merge.

## Definition of done

- Acceptance criteria are met without mock claims presented as real analysis.
- Public contracts and docs are updated with code.
- Tests cover success, insufficient data, and failure paths.
- Mobile behavior is checked at 390×844 and microphone denial has a recovery path.
- No secret, raw private recording, full source song, generated cache, or unrelated user file is committed.
