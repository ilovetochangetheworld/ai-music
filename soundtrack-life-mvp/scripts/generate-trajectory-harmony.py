#!/usr/bin/env python3
import argparse
import json
import subprocess
import wave
from pathlib import Path

import torch
import torchaudio

HARMONY_REGIONS = [(95.67, 146.0), (212.79, 241.28), (241.28, 303.5)]
MAJOR_PROFILE = torch.tensor([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = torch.tensor([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('vocal_wav', type=Path)
    parser.add_argument('output_wav', type=Path)
    parser.add_argument('--work-dir', type=Path, required=True)
    parser.add_argument('--regions', default='', help='Comma-separated source regions, for example 95.67:146,212.79:241.28')
    args = parser.parse_args()
    args.work_dir.mkdir(parents=True, exist_ok=True)

    regions = parse_regions(args.regions) if args.regions else HARMONY_REGIONS
    waveform, sr = load_pcm16_wav(args.vocal_wav)
    mono = waveform.mean(dim=0, keepdim=True)
    frame_time = 0.02
    pitch = torchaudio.functional.detect_pitch_frequency(
        mono,
        sample_rate=sr,
        frame_time=frame_time,
        win_length=15,
        freq_low=65,
        freq_high=1100,
    )[0]
    energy = frame_energy(mono[0], sr, frame_time, pitch.numel())
    midi = 69 + 12 * torch.log2(torch.clamp(pitch, min=1) / 440.0)
    voiced = (pitch >= 65) & (pitch <= 1100) & (energy > torch.quantile(energy, 0.42))

    root, mode = detect_key(midi[voiced])
    scale = scale_pitch_classes(root, mode)
    pitch_map = build_pitch_map(midi, voiced, sr, frame_time, scale, regions)
    pitch_map_path = args.work_dir / 'harmony-pitch-map.txt'
    with pitch_map_path.open('w') as handle:
        for frame, shift in pitch_map:
            handle.write(f'{frame} {shift:.4f}\n')

    shifted_path = args.work_dir / 'harmony-shifted.wav'
    subprocess.run([
        'rubberband', '--fine', '--formant', '--pitchmap', str(pitch_map_path),
        str(args.vocal_wav), str(shifted_path),
    ], check=True)

    shifted, shifted_sr = load_pcm16_wav(shifted_path)
    if shifted_sr != sr:
        shifted = torchaudio.functional.resample(shifted, shifted_sr, sr)
    shifted = fit_length(shifted, waveform.shape[1])
    mask = region_mask(waveform.shape[1], sr, regions, fade_seconds=0.12)
    shifted = shifted * mask.unsqueeze(0)
    shifted = torchaudio.functional.highpass_biquad(shifted, sr, cutoff_freq=120)

    harmony_mono = shifted.mean(dim=0)
    delay = int(sr * 0.021)
    room_delay = int(sr * 0.085)
    right = torch.zeros_like(harmony_mono)
    right[delay:] = harmony_mono[:-delay]
    room = torch.zeros_like(harmony_mono)
    room[room_delay:] = harmony_mono[:-room_delay] * 0.16
    stereo = torch.stack([harmony_mono * 0.76 + room, right * 0.76 + room * 0.9])
    peak = stereo.abs().max().item() or 1.0
    stereo *= min(1.0, 0.82 / peak)
    save_pcm16_wav(args.output_wav, stereo, sr)

    metadata = {
        'detectedKey': NOTE_NAMES[root],
        'mode': mode,
        'regions': regions,
        'sampleRate': sr,
        'pitchFrames': int(pitch.numel()),
    }
    (args.work_dir / 'harmony-analysis.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    print(json.dumps(metadata, ensure_ascii=False))


def frame_energy(audio, sr, frame_time, count):
    hop = max(1, int(sr * frame_time))
    padded = torch.nn.functional.pad(audio, (0, max(0, hop * count - audio.numel())))
    frames = padded[:hop * count].reshape(count, hop)
    return torch.sqrt(torch.mean(frames * frames, dim=1) + 1e-12)


def detect_key(midi):
    histogram = torch.zeros(12)
    for note in torch.round(midi).to(torch.int64):
        histogram[int(note.item()) % 12] += 1
    histogram = (histogram - histogram.mean()) / (histogram.std() + 1e-8)
    candidates = []
    for root in range(12):
        candidates.append((torch.dot(histogram, torch.roll(MAJOR_PROFILE, root)).item(), root, 'major'))
        candidates.append((torch.dot(histogram, torch.roll(MINOR_PROFILE, root)).item(), root, 'minor'))
    _, root, mode = max(candidates)
    return root, mode


def scale_pitch_classes(root, mode):
    pattern = [0, 2, 4, 5, 7, 9, 11] if mode == 'major' else [0, 2, 3, 5, 7, 8, 10]
    return [(root + interval) % 12 for interval in pattern]


def build_pitch_map(midi, voiced, sr, frame_time, scale, regions):
    points = [(0, 0.0)]
    last_shift = 0.0
    hop = int(sr * frame_time)
    for index in range(midi.numel()):
        at = index * frame_time
        if not in_regions(at, regions):
            shift = 0.0
        elif not bool(voiced[index]):
            shift = last_shift
        else:
            shift = diatonic_third_shift(int(round(midi[index].item())), scale)
            last_shift = shift
        frame = index * hop
        if abs(points[-1][1] - shift) > 0.05:
            points.append((frame, shift))
    points.append((midi.numel() * hop, 0.0))
    return points


def diatonic_third_shift(midi, scale):
    pc = midi % 12
    degree = min(range(7), key=lambda index: min((pc - scale[index]) % 12, (scale[index] - pc) % 12))
    target_pc = scale[(degree + 2) % 7]
    shift = (target_pc - pc) % 12
    shift = 3 if shift <= 3 else 4
    if midi + shift > 76:
        shift -= 12
    return float(shift)


def in_regions(at, regions):
    return any(start <= at <= end for start, end in regions)


def parse_regions(value):
    regions = []
    for item in value.split(','):
        start, end = item.split(':', 1)
        regions.append((float(start), float(end)))
    if not regions or any(start < 0 or end <= start for start, end in regions):
        raise ValueError('Invalid harmony regions')
    return regions


def region_mask(frames, sr, regions, fade_seconds):
    mask = torch.zeros(frames)
    fade = max(1, int(sr * fade_seconds))
    for start, end in regions:
        first = max(0, int(start * sr))
        last = min(frames, int(end * sr))
        mask[first:last] = 1.0
        width = min(fade, max(0, (last - first) // 2))
        if width:
            mask[first:first + width] = torch.linspace(0, 1, width)
            mask[last - width:last] = torch.linspace(1, 0, width)
    return mask


def fit_length(audio, frames):
    if audio.shape[1] >= frames:
        return audio[:, :frames]
    return torch.nn.functional.pad(audio, (0, frames - audio.shape[1]))


def load_pcm16_wav(path):
    with wave.open(str(path), 'rb') as handle:
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        sr = handle.getframerate()
        frames = handle.getnframes()
        if sample_width != 2:
            raise RuntimeError(f'{path} must be PCM 16-bit WAV, got {sample_width * 8}-bit')
        raw = bytearray(handle.readframes(frames))
    tensor = torch.frombuffer(raw, dtype=torch.int16).clone().to(torch.float32) / 32768.0
    return tensor.reshape(-1, channels).transpose(0, 1).contiguous(), sr


def save_pcm16_wav(path, audio, sr):
    samples = (audio.clamp(-1, 1) * 32767).round().to(torch.int16).transpose(0, 1).contiguous()
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(audio.shape[0])
        handle.setsampwidth(2)
        handle.setframerate(sr)
        handle.writeframes(samples.numpy().tobytes())


if __name__ == '__main__':
    main()
