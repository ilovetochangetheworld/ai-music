#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/.audio-venv/bin/python"
SOURCE="$ROOT/music/周杰伦 - 轨迹.mp3"
WORK="$ROOT/audio-work"
PUBLIC="$ROOT/public/audio/trajectory"

mkdir -p "$WORK" "$PUBLIC"

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing .audio-venv. Create it with: uv venv --python 3.11 .audio-venv" >&2
  exit 1
fi

node "$ROOT/scripts/build-trajectory-timeline.mjs"

"$PYTHON" -m demucs \
  --two-stems vocals \
  --float32 \
  -n htdemucs_ft \
  -o "$WORK/separated" \
  "$SOURCE"

STEM_DIR="$WORK/separated/htdemucs_ft/周杰伦 - 轨迹"
VOCAL="$STEM_DIR/vocals.wav"
ACCOMPANIMENT="$STEM_DIR/no_vocals.wav"
HARMONY_WAV="$WORK/harmony.wav"
VOCAL_PCM="$WORK/vocals-pcm16.wav"

ffmpeg -y -hide_banner -loglevel warning -i "$VOCAL" -c:a pcm_s16le "$VOCAL_PCM"

"$PYTHON" "$ROOT/scripts/generate-trajectory-harmony.py" \
  "$VOCAL_PCM" "$HARMONY_WAV" --work-dir "$WORK/harmony"

CLIP_START="187.49"
CLIP_END="267.53"
CLIP_DURATION="80.04"
ffmpeg -y -hide_banner -loglevel warning -i "$ACCOMPANIMENT" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION" \
  -c:a flac -compression_level 8 "$PUBLIC/accompaniment.flac"
ffmpeg -y -hide_banner -loglevel warning -i "$VOCAL" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION,volume=-5dB" \
  -c:a flac -compression_level 8 "$PUBLIC/rescue-lead.flac"
ffmpeg -y -hide_banner -loglevel warning -i "$HARMONY_WAV" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION,volume=-6dB" \
  -c:a flac -compression_level 8 "$PUBLIC/harmony.flac"

echo "Trajectory assets are ready in $PUBLIC"
