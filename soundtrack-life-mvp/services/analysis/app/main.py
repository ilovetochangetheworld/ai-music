from __future__ import annotations

import math
from statistics import fmean, pstdev
from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


class Frame(BaseModel):
    at: float
    db: float
    pitchHz: float = 0
    clarity: float = 0
    vadProbability: float = 0
    isSinging: bool = False


class AnalyzeRequest(BaseModel):
    session: dict[str, Any]
    telemetry: list[Frame] = Field(default_factory=list)
    recordingBase64: str | None = None


MetricKey = Literal["pitch", "rhythm", "breath", "expression", "consistency"]


def metric(key: MetricKey, label: str, score: int | None, confidence: float, evidence: str, suggestion: str) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "score": score,
        "confidence": round(max(0, min(1, confidence)), 3),
        "status": "ok" if score is not None else "insufficient_data",
        "evidence": evidence,
        "suggestion": suggestion,
        "segments": [],
    }


def analyze_payload(request: AnalyzeRequest) -> dict[str, Any]:
    frames = request.telemetry
    active = [frame for frame in frames if frame.isSinging]
    duration = max((frame.at for frame in frames), default=0)
    coverage = len(active) * 0.08 / max(duration, 1)
    pitch_confidence = fmean([frame.clarity for frame in active]) if active else 0
    reasons: list[str] = []
    if coverage < 0.2:
        reasons.append("有效演唱覆盖不足 20%")
    if pitch_confidence < 0.45:
        reasons.append("音高检测置信度不足")
    valid = not reasons

    metrics = [
        metric("pitch", "音高准确度", None, 0, "参考旋律尚未完成人工校正，暂不提供音准分。", "完成参考旋律校正后再评估音准。"),
        rhythm_metric(active, valid),
        breath_metric(frames, valid),
        expression_metric(active, valid),
        consistency_metric(active, valid),
    ]
    # A total score is only legal when every dimension has trustworthy evidence.
    overall = None
    status = "insufficient_data"
    primary = next((item["suggestion"] for item in metrics if item["score"] is not None), "先完整唱完两句熟悉的歌词，小麦会继续记录。")
    return {
        "version": "1.0",
        "sessionId": request.session["id"],
        "songId": request.session["songId"],
        "status": status,
        "overallScore": overall,
        "dataQuality": {
            "vocalCoverage": round(min(1, coverage), 3),
            "pitchConfidence": round(pitch_confidence, 3),
            "noiseFloorDb": float((request.session.get("calibration") or {}).get("noiseFloorDb", -60)),
            "reasons": reasons + ["参考旋律等待人工校正"],
        },
        "metrics": metrics,
        "highlights": [],
        "headline": "这次的数据已经收到；参考旋律校正完成前，小麦不会给出推测总分。",
        "primarySuggestion": primary,
    }


def rhythm_metric(active: list[Frame], valid: bool) -> dict[str, Any]:
    if not valid or len(active) < 10:
        return metric("rhythm", "节奏贴合度", None, 0, "缺少经过校正的乐句窗口。", "完整演唱后再比较乐句起止位置。")
    return metric("rhythm", "节奏贴合度", None, 0, "乐句参考数据尚未接入。", "等待乐句人工校正。")


def breath_metric(frames: list[Frame], valid: bool) -> dict[str, Any]:
    if not valid or len(frames) < 20:
        return metric("breath", "呼吸控制", None, 0, "连续发声数据不足，只能做信号推测。", "在长句前完整吸气，保持句尾不断。")
    gaps = sum(1 for before, after in zip(frames, frames[1:]) if before.isSinging and not after.isSinging)
    score = round(max(0, 100 - gaps * 4))
    return metric("breath", "呼吸控制", score, 0.55, f"检测到 {gaps} 次发声转为停顿；这是信号推测。", "优先减少长句中间的非预期停顿。")


def expression_metric(active: list[Frame], valid: bool) -> dict[str, Any]:
    if not valid or len(active) < 20:
        return metric("expression", "情感表达", None, 0, "动态数据不足，不推断真实情绪。", "副歌关键词可以比主歌更突出一点。")
    levels = [frame.db for frame in active if math.isfinite(frame.db)]
    dynamic = max(levels) - min(levels) if levels else 0
    score = round(max(0, min(100, 55 + dynamic * 3)))
    return metric("expression", "情感表达", score, 0.5, f"有效发声动态范围约 {dynamic:.1f}dB；仅评价声音层次。", "保留自然表达，再拉开主副歌动态。")


def consistency_metric(active: list[Frame], valid: bool) -> dict[str, Any]:
    pitched = [frame for frame in active if frame.pitchHz > 0 and frame.clarity >= 0.55]
    if not valid or len(pitched) < 10:
        return metric("consistency", "一致性", None, 0, "连续有效音高帧不足。", "降低音量，先把每句起音和句尾唱稳。")
    midi = [69 + 12 * math.log2(frame.pitchHz / 440) for frame in pitched]
    spread = pstdev(midi)
    score = round(max(0, min(100, 100 - spread * 6)))
    return metric("consistency", "一致性", score, min(0.8, len(pitched) / 100), f"有效音高帧离散度约 {spread:.2f} 半音。", "前后半段继续保持相同的气息支撑。")


app = FastAPI(title="AI Practice Room Analysis", version="0.1.0")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "practice-analysis", "scoringVersion": "0.1.0"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    return analyze_payload(request)
