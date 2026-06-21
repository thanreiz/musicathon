#!/usr/bin/env python3
"""
Wrapper around Demucs that patches torchaudio.load to use soundfile,
bypassing the torchcodec requirement in torchaudio 2.11+.

Usage: python3 run_demucs.py <input_file> <output_dir>
Outputs: <output_dir>/htdemucs/<trackname>/no_vocals.mp3
"""
import sys
import os


def patch_torchaudio():
    """Replace torchaudio.load with a soundfile-based implementation."""
    import soundfile as sf
    import torch
    import torchaudio

    def soundfile_load(filepath, *args, **kwargs):
        filepath = str(filepath)
        # If the file is not wav, convert with ffmpeg first
        if not filepath.lower().endswith('.wav'):
            import subprocess, tempfile
            wav_path = tempfile.mktemp(suffix='.wav')
            subprocess.run(
                ['ffmpeg', '-y', '-i', filepath, '-ar', '44100', '-ac', '2', wav_path],
                capture_output=True, check=True
            )
            data, sr = sf.read(wav_path)
            os.unlink(wav_path)
        else:
            data, sr = sf.read(filepath)

        # Ensure data is writable and contiguous
        data = data.copy()
        if data.ndim == 1:
            # Mono: (samples,) -> (1, samples)
            wav = torch.tensor(data, dtype=torch.float32).unsqueeze(0)
        else:
            # Stereo: (samples, channels) -> (channels, samples)
            wav = torch.tensor(data.T.copy(), dtype=torch.float32)
        # .clone() guarantees the tensor owns its own memory for in-place ops
        return wav.clone(), sr

    torchaudio.load = soundfile_load


def patch_demucs_separate():
    """Patch demucs.separate.load_track to clone the output tensor,
    ensuring in-place operations (wav -= ...) work correctly."""
    import demucs.separate as sep

    original_load_track = sep.load_track

    def patched_load_track(track, audio_channels, samplerate):
        wav = original_load_track(track, audio_channels, samplerate)
        return wav.clone()

    sep.load_track = patched_load_track


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 run_demucs.py <input_file> <output_dir>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.isfile(input_file):
        print(f"Error: Input file not found: {input_file}", file=sys.stderr)
        sys.exit(1)

    # Set SSL certs for model download
    try:
        import certifi
        os.environ['SSL_CERT_FILE'] = certifi.where()
    except ImportError:
        pass

    # Patch before importing demucs
    patch_torchaudio()

    # Import demucs so we can patch load_track
    import demucs.separate
    patch_demucs_separate()

    # Now run demucs
    sys.argv = [
        'demucs',
        '--two-stems=vocals',
        '-o', output_dir,
        '--mp3',
        input_file,
    ]

    demucs.separate.main()


if __name__ == '__main__':
    main()
