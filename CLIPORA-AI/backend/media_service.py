import os
import shutil
import subprocess
from pathlib import Path

def get_ffmpeg_path() -> str:
    """
    Locates the FFmpeg executable on Windows or system PATH.
    """
    # 1. System PATH
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        return ffmpeg_bin

    # 2. LocalAppData Winget packages
    local_appdata = os.environ.get("LOCALAPPDATA", "")
    if local_appdata:
        winget_dir = Path(local_appdata) / "Microsoft" / "WinGet" / "Packages"
        if winget_dir.exists():
            matches = list(winget_dir.glob("**/ffmpeg.exe"))
            if matches:
                return str(matches[0])

    # 3. Known Gyan.FFmpeg installation path
    fallback_path = r"C:\Users\bm914\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
    if os.path.exists(fallback_path):
        return fallback_path

    return "ffmpeg"

def cut_audio_clip(input_file: str, output_file: str, start_sec: float, end_sec: float) -> str:
    """
    Extracts an audio clip between start_sec and end_sec using FFmpeg.
    """
    ffmpeg_exe = get_ffmpeg_path()
    duration = max(0.5, float(end_sec) - float(start_sec))
    start_time = max(0.0, float(start_sec))

    # Output directory check
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y",
        "-ss", f"{start_time:.2f}",
        "-i", str(input_file),
        "-t", f"{duration:.2f}",
        "-vn",
        "-c:a", "libmp3lame",
        "-q:a", "2",
        str(output_file)
    ]

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr or 'Unknown error'}")

    return output_file
