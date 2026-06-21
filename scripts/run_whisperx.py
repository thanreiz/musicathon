#!/usr/bin/env python3
"""
Forced alignment of KNOWN lyrics to a vocal stem using WhisperX.

We do NOT transcribe the lyrics with ASR (that produces wrong words). Instead
we take the known lyric lines (from Musixmatch LRC) and force-align them to the
separated vocal stem, producing word-level timestamps + per-word confidence.

Usage:
  python3 run_whisperx.py <vocals_audio> <lines_json> <output_json> [language]

lines_json : JSON array of {"text": str, "startMs": int, "endMs": int}
output_json: JSON array of
  {"text": str, "syncConfidence": float|null,
   "words": [{"text": str, "startTimeMs": int, "endTimeMs": int}]}
  (one entry per input line, SAME ORDER; "words" may be [] if a line could
  not be aligned — the Node caller fills those in.)

Exit codes: 0 ok; 2 bad args; 3 whisperx missing; 5 no align model for the
language; other non-zero on failure. The Node caller treats any non-zero exit
as "alignment unavailable" and falls back to the LRC estimate.

LOCAL-ONLY. Requires: pip install whisperx
"""
import sys
import os
import json


def eprint(*args):
    print(*args, file=sys.stderr)


def main():
    if len(sys.argv) < 4:
        eprint("Usage: run_whisperx.py <vocals> <lines_json> <output_json> [language]")
        sys.exit(2)

    vocals_path = sys.argv[1]
    lines_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None

    if not os.path.isfile(vocals_path):
        eprint(f"Vocals file not found: {vocals_path}")
        sys.exit(2)

    try:
        import certifi
        os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    except ImportError:
        pass

    try:
        import whisperx
    except ImportError:
        eprint("whisperx is not installed (pip install whisperx)")
        sys.exit(3)

    with open(lines_path, "r", encoding="utf-8") as f:
        lines = json.load(f)
    if not lines:
        eprint("No input lines")
        sys.exit(4)

    device = "cpu"
    compute_type = "int8"

    audio = whisperx.load_audio(vocals_path)

    # Determine language if not provided (alignment models are per-language).
    lang = language
    if not lang:
        try:
            asr = whisperx.load_model("small", device, compute_type=compute_type)
            detected = asr.transcribe(audio, batch_size=8)
            lang = detected.get("language", "en")
            eprint(f"Detected language: {lang}")
        except Exception as exc:  # noqa: BLE001
            eprint(f"Language detection failed, defaulting to en: {exc}")
            lang = "en"

    try:
        model_a, metadata = whisperx.load_align_model(language_code=lang, device=device)
    except Exception as exc:  # noqa: BLE001
        # No wav2vec2 alignment model for this language (e.g. Tagalog) — bail so
        # the caller falls back to the LRC estimate rather than bad timings.
        eprint(f"No alignment model for language '{lang}': {exc}")
        sys.exit(5)

    # Build alignment segments from the known lyric lines (times in seconds).
    segments = [
        {
            "start": float(l["startMs"]) / 1000.0,
            "end": float(l["endMs"]) / 1000.0,
            "text": l["text"],
        }
        for l in lines
    ]

    try:
        aligned = whisperx.align(
            segments,
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
    except Exception as exc:  # noqa: BLE001
        eprint(f"Alignment failed: {exc}")
        sys.exit(6)

    out_segments = aligned.get("segments", [])
    result = []
    # Align output to input order. WhisperX preserves segment order, but guard
    # against count drift by zipping on index.
    for idx, line in enumerate(lines):
        seg = out_segments[idx] if idx < len(out_segments) else {}
        words = []
        scores = []
        for w in seg.get("words", []):
            if w.get("start") is None or w.get("end") is None:
                continue
            words.append(
                {
                    "text": str(w.get("word", "")),
                    "startTimeMs": int(round(float(w["start"]) * 1000)),
                    "endTimeMs": int(round(float(w["end"]) * 1000)),
                }
            )
            if w.get("score") is not None:
                scores.append(float(w["score"]))
        result.append(
            {
                "text": line["text"],
                "syncConfidence": (sum(scores) / len(scores)) if scores else None,
                "words": words,
            }
        )

    aligned_count = sum(1 for r in result if r["words"])
    if aligned_count == 0:
        eprint("No lines could be aligned")
        sys.exit(7)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    eprint(f"Aligned {aligned_count}/{len(result)} lines (language={lang})")


if __name__ == "__main__":
    main()
