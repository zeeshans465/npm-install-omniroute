"""GTA 6 Live Auto-Clipper pipeline — ported from GTA6_Live_Clipper_Mobile_Colab.ipynb."""
import glob
import os
import re
import shutil
import subprocess
import threading
import time
from collections import deque

HYPE_WORDS = re.compile(
    r"\b(w+|lmao|lmfao|clip|omg|wtf|bro|op|insane|no way|haha)\b|💀|🔥|😂|😱", re.I
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WHISPER_MODEL = None
WHISPER_LOCK = threading.Lock()


def get_whisper():
    global WHISPER_MODEL
    with WHISPER_LOCK:
        if WHISPER_MODEL is None:
            _patch_decode_audio()
            from faster_whisper import WhisperModel
            WHISPER_MODEL = WhisperModel("base", device="cpu", compute_type="int8")
    return WHISPER_MODEL


def _patch_decode_audio():
    """av>=15 dropped the metadata_errors kwarg faster-whisper passes; provide a compatible decoder."""
    import faster_whisper.transcribe as ft

    def decode_audio(input_file, sampling_rate=16000):
        import av
        import numpy as np
        with av.open(input_file, mode="r") as container:
            resampler = av.AudioResampler(format="s16", layout="mono", rate=sampling_rate)
            chunks = []
            for packet in container.demux(audio=0):
                for frame in packet.decode():
                    chunks.extend(resampler.resample(frame))
            if not chunks:
                return np.empty(0, dtype=np.float32)
            audio = np.concatenate([c.to_ndarray().ravel() for c in chunks])
            return audio.astype(np.float32) / 32768.0

    ft.decode_audio = decode_audio


def get_video_id(url: str) -> str:
    match = re.search(r"(?:v=|live/|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    return match.group(1) if match else url


class ClipperJob:
    """One monitoring session against one YouTube URL."""

    def __init__(self, job_id, url, credit, spike_multiplier, min_messages, cooldown):
        self.job_id = job_id
        self.url = url
        self.credit = credit
        self.spike_multiplier = spike_multiplier
        self.min_messages = min_messages
        self.cooldown = cooldown
        self.dir = os.path.join(BASE_DIR, "output_clips", job_id)
        self.buffer_dir = os.path.join(self.dir, "buffer")
        self.log = deque(maxlen=300)
        self.clips = []  # finished clip filenames
        self.status = "starting"
        self.clip_count = 0
        self.last_clip_time = 0.0
        self._stop = threading.Event()
        self._threads = []
        os.makedirs(self.buffer_dir, exist_ok=True)

    def note(self, line):
        stamp = time.strftime("%H:%M:%S")
        self.log.append(f"[{stamp}] {line}")

    def start(self):
        t = threading.Thread(target=self._run, daemon=True)
        t.start()
        self._threads.append(t)

    def stop(self):
        self._stop.set()
        self.status = "stopped"

    # --- pipeline pieces (notebook logic) ---

    def _start_rolling_buffer(self):
        hls = (
            subprocess.check_output(
                ["yt-dlp", "-g", "-f", "best[height<=1080]", self.url]
            )
            .decode()
            .strip()
            .splitlines()[0]
        )
        self.note("Media stream resolved, recording rolling buffer…")
        return subprocess.Popen(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", hls,
                "-c", "copy", "-f", "segment", "-segment_time", "5",
                "-segment_wrap", "12", "-reset_timestamps", "1",
                os.path.join(self.buffer_dir, "seg_%02d.ts"),
            ]
        )

    def _generate_ass_subtitles(self, clip_path, ass_path):
        model = get_whisper()
        segments, _ = model.transcribe(clip_path, word_timestamps=True)
        header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Viral,Arial Black,78,&H0000D7FF,&H00000000,&H80000000,-1,1,6,2,2,320

[Events]
Format: Layer, Start, End, Style, Text
"""

        def fmt_time(t):
            h, m = int(t // 3600), int((t % 3600) // 60)
            s = t % 60
            return f"{h}:{m:02d}:{s:05.2f}"

        lines = [header]
        for seg in segments:
            words = seg.words or []
            for i in range(0, len(words), 3):
                chunk = words[i:i + 3]
                if not chunk:
                    continue
                start = fmt_time(chunk[0].start)
                end = fmt_time(chunk[-1].end)
                text = " ".join(w.word.strip().upper() for w in chunk)
                lines.append(f"Dialogue: 0,{start},{end},Viral,{text}\n")
        with open(ass_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    def _process_viral_clip(self, clip_index, hype_score):
        try:
            self.note(f"🔥 HYPE SPIKE DETECTED (Score: {hype_score})! Waiting 8s for reaction…")
            time.sleep(8)
            files = sorted(glob.glob(os.path.join(self.buffer_dir, "seg_*.ts")),
                           key=os.path.getmtime)
            recent = files[-6:]
            if len(recent) < 3:
                self.note("Not enough buffered footage yet, skipping clip.")
                return
            concat = os.path.join(self.dir, "concat.txt")
            with open(concat, "w") as f:
                for seg in recent:
                    f.write(f"file '{os.path.abspath(seg)}'\n")
            raw_clip = os.path.join(self.dir, f"raw_{clip_index}.mp4")
            ass_file = os.path.join(self.dir, f"subs_{clip_index}.ass")
            final_clip = os.path.join(self.dir, f"GTA6_Clip_{clip_index}_Hype{hype_score}.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat",
                            "-safe", "0", "-i", concat, "-c", "copy", raw_clip])
            self.note("Transcribing with Faster-Whisper…")
            self._generate_ass_subtitles(raw_clip, ass_file)
            vf_filter = (
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
                f"ass={ass_file},"
                f"drawtext=text='Credit\\: {self.credit}':fontcolor=white:fontsize=36:"
                "box=1:boxcolor=black@0.65:boxborderw=14:x=45:y=90"
            )
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw_clip,
                            "-vf", vf_filter, "-c:v", "libx264", "-preset", "veryfast",
                            "-crf", "22", "-c:a", "aac", "-b:a", "128k", final_clip])
            os.remove(raw_clip)
            self.clips.append(os.path.basename(final_clip))
            self.note(f"✅ READY TO POST: {os.path.basename(final_clip)}")
        except Exception as exc:  # keep the monitor alive on clip failures
            self.note(f"Clip {clip_index} failed: {exc}")

    def clip_now(self):
        """Manual clip (used for VODs / when chat is quiet)."""
        if self._stop.is_set():
            return False
        self.clip_count += 1
        t = threading.Thread(target=self._process_viral_clip,
                             args=(self.clip_count, "manual"), daemon=True)
        t.start()
        self._threads.append(t)
        return True

    # --- main monitoring loop (notebook logic) ---

    def _run(self):
        import pytchat

        vid_id = get_video_id(self.url)
        try:
            buffer_proc = self._start_rolling_buffer()
        except Exception as exc:
            self.status = "error"
            self.note(f"Could not open stream: {exc}")
            return
        self.status = "monitoring"
        try:
            chat = pytchat.create(video_id=vid_id)
        except Exception as exc:
            self.note(f"Chat unavailable ({exc}); use 'Clip now' to cut clips.")
            chat = None

        history = deque(maxlen=12)
        try:
            while not self._stop.is_set() and (chat is None or chat.is_alive()):
                window_start = time.time()
                msg_count, hype_hits = 0, 0
                while time.time() - window_start < 5 and not self._stop.is_set():
                    if chat is not None:
                        for c in chat.get().sync_items():
                            msg_count += 1
                            if HYPE_WORDS.search(c.message):
                                hype_hits += 1
                    time.sleep(0.3)
                baseline = (sum(history) / len(history)) if history else 10
                history.append(msg_count)
                self.note(f"[LIVE] {msg_count} msgs/5s | Hype keywords: {hype_hits} | Avg: {baseline:.1f}")
                now = time.time()
                if chat is not None and (
                    (msg_count >= max(self.min_messages, baseline * self.spike_multiplier))
                    or (hype_hits >= 10)
                ) and (now - self.last_clip_time > self.cooldown):
                    self.last_clip_time = now
                    self.clip_count += 1
                    t = threading.Thread(target=self._process_viral_clip,
                                         args=(self.clip_count, msg_count + hype_hits),
                                         daemon=True)
                    t.start()
                    self._threads.append(t)
            if chat is not None and not chat.is_alive():
                self.note("Live chat ended.")
        finally:
            buffer_proc.terminate()
            if self.status != "stopped":
                self.status = "ended"
