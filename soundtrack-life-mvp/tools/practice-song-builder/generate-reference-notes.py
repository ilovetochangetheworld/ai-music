#!/usr/bin/env python3
"""从练习片段人声干声生成「参考旋律音符」候选，供人工校正。

输出 ReferenceNote[]（startSec/endSec/midi/lineId/sustained），写入 notes.json，
reviewStatus = "auto_generated_requires_review"。

重要不变量（见 AGENTS.md）：自动生成的音符**不得**直接当作音准依据。运行时评分
只信任 reviewStatus == "reviewed" 的音符；校正者核对/修正后再把状态改为 reviewed。

输入人声应与 timeline.json 处于同一（输出）时间轴，即 public/audio/<id>/rescue-lead
对应的 PCM 干声（请先用 ffmpeg 转成 pcm_s16le wav）。

用法：
  python generate-reference-notes.py <vocal_pcm16.wav> <timeline.json> <out_notes.json> \
      [--frame-time 0.02] [--min-note 0.12] [--sustain 0.6] [--energy-quantile 0.5]
"""
from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path

import torch
import torchaudio


def load_pcm16_wav(path: Path):
    with wave.open(str(path), "rb") as handle:
        sr = handle.getframerate()
        channels = handle.getnchannels()
        frames = handle.readframes(handle.getnframes())
    data = torch.frombuffer(bytearray(frames), dtype=torch.int16).float() / 32768.0
    if channels > 1:
        data = data.view(-1, channels).mean(dim=1)
    return data, sr


def frame_energy(samples: torch.Tensor, sr: int, frame_time: float, n_frames: int) -> torch.Tensor:
    hop = max(1, int(round(sr * frame_time)))
    energy = torch.zeros(n_frames)
    for i in range(n_frames):
        chunk = samples[i * hop:(i + 1) * hop]
        energy[i] = float(torch.sqrt(torch.clamp((chunk ** 2).mean(), min=1e-12))) if chunk.numel() else 0.0
    return energy


def line_id_at(lines, t: float):
    for line in lines:
        if line["start"] <= t < line["end"]:
            return line["id"]
    # 落在行间隙：就近归属最近的行，避免丢音符
    if not lines:
        return None
    return min(lines, key=lambda ln: min(abs(t - ln["start"]), abs(t - ln["end"])))["id"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("vocal_wav", type=Path)
    parser.add_argument("timeline_json", type=Path)
    parser.add_argument("out_notes", type=Path)
    parser.add_argument("--frame-time", type=float, default=0.02)
    parser.add_argument("--min-note", type=float, default=0.12, help="最短音符时长（秒）")
    parser.add_argument("--sustain", type=float, default=0.6, help="判定为长音(sustained)的时长阈值（秒）")
    parser.add_argument("--energy-quantile", type=float, default=0.5, help="发声能量门限分位数")
    parser.add_argument("--freq-low", type=float, default=65.0)
    parser.add_argument("--freq-high", type=float, default=1100.0)
    args = parser.parse_args()

    timeline = json.loads(args.timeline_json.read_text(encoding="utf-8"))
    lines = timeline.get("lines", [])

    mono, sr = load_pcm16_wav(args.vocal_wav)
    pitch = torchaudio.functional.detect_pitch_frequency(
        mono.unsqueeze(0), sample_rate=sr, frame_time=args.frame_time,
        win_length=15, freq_low=args.freq_low, freq_high=args.freq_high,
    )[0]
    energy = frame_energy(mono, sr, args.frame_time, pitch.numel())
    voiced_gate = torch.quantile(energy, max(0.0, min(0.95, args.energy_quantile)))
    voiced = (pitch >= args.freq_low) & (pitch <= args.freq_high) & (energy > voiced_gate)
    midi = 69 + 12 * torch.log2(torch.clamp(pitch, min=1e-6) / 440.0)

    # 把连续、音高稳定的发声帧聚合成音符；音高跳变 > 0.7 半音或出现间隙则切分。
    notes = []
    cur = None  # (start_frame, [midi values])
    max_gap_frames = max(1, int(round(0.12 / args.frame_time)))
    last_voiced = -10
    for i in range(pitch.numel()):
        t = i * args.frame_time
        if bool(voiced[i]):
            m = float(midi[i])
            if cur is None or (i - last_voiced) > max_gap_frames or abs(m - median(cur[1])) > 0.7:
                flush(cur, args, lines, notes)
                cur = (i, [m])
            else:
                cur[1].append(m)
            last_voiced = i
    flush(cur, args, lines, notes)

    notes.sort(key=lambda n: n["startSec"])
    payload = {
        "version": "1.0",
        "reviewStatus": "auto_generated_requires_review",
        "generator": "practice-song-builder/generate-reference-notes.py",
        "notes": notes,
    }
    args.out_notes.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"生成 {len(notes)} 个候选音符 → {args.out_notes}")
    print("请人工核对/修正后，将 reviewStatus 改为 'reviewed' 才会参与音准评分。")


def flush(cur, args, lines, notes):
    if cur is None:
        return
    start_frame, values = cur
    duration = len(values) * args.frame_time
    if duration < args.min_note or not values:
        return
    start_sec = round(start_frame * args.frame_time, 3)
    end_sec = round(start_sec + duration, 3)
    note_midi = int(round(median(values)))
    line_id = line_id_at(lines, (start_sec + end_sec) / 2)
    notes.append({
        "startSec": start_sec,
        "endSec": end_sec,
        "midi": note_midi,
        "lineId": line_id,
        "sustained": duration >= args.sustain,
    })


def median(values):
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0.0
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


if __name__ == "__main__":
    main()
