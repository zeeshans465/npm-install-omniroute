# GTA 6 Live Auto-Clipper — Android App

## Goal and users
Wrap the GTA 6 Live Auto-Clipper (from `GTA6_Live_Clipper_Mobile_Colab.ipynb`) into an
Android APK. Users paste a YouTube live URL + streamer credit, tune hype settings, watch
the live hype monitor, and download finished 9:16 subtitle-burned Reel clips from their phone.

Whisper (CTranslate2), yt-dlp and ffmpeg cannot realistically run inside an Android app, so
the phone app is a client for a real backend that runs the exact pipeline from the notebook.

**Working means:** APK installs on Android, app talks to the backend, a real live/VOD URL
produces a real downloadable 9:16 clip with burned subtitles and credit overlay.

## Scope
In scope: FastAPI backend running the notebook pipeline (yt-dlp, ffmpeg, pytchat,
faster-whisper), REST API, Expo app (Setup / Live monitor / Clips gallery), APK build.
Out of scope: publishing to Play Store, TikTok/YouTube upload, accounts/auth (single user),
cloud GPU — CPU int8 whisper `base` as in the notebook.

## Architecture
- `backend/` FastAPI (python3 + uvicorn). One-line reason: the notebook is Python; it runs as-is on the server.
  - `pipeline.py`: hype-word chat monitor (pytchat), rolling ffmpeg segment buffer (12×5s),
    clip stitching, ASS subtitles via faster-whisper, 1080x1920 crop + drawtext credit (same constants as notebook).
  - API: `POST /api/jobs` (url, credit, spike_multiplier, min_messages, cooldown) → job id;
    `GET /api/jobs/{id}` (status + hype log); `GET /api/clips/{id}` (finished clips);
    `GET /api/clips/file/{name}` (download); `POST /api/jobs/{id}/stop`.
  - Storage: `backend/output_clips/<job_id>/`, served as static files.
- `mobile/` Expo (React Native + Expo Router). One-line reason: fastest route to a real APK.
  - Screens: Setup (form), Monitor (hype log + clip progress), Clips (gallery + share/download).
  - Backend base URL configurable in-app (default = this workspace's public port-8000 URL).
- APK: `npx expo prebuild` → `mobile/android` → `./gradlew assembleDebug` with Android
  cmdline-tools installed locally. Debug-signed APK is installable on any Android phone.

## Risks and assumptions
- Whisper on CPU: base/int8 transcribes a ~30s clip in well under a minute on 8 CPUs. OK.
- pytchat depends on YouTube's private chat API; it may break without warning (same as the notebook).
- Verification of live clip generation uses a public YouTube VOD (same yt-dlp/ffmpeg path); no
  currently-live stream can be guaranteed during the build.
- APK is debug-signed (not Play-store ready); release signing needs the user's keystore.
- Chat monitoring requires an active live chat; for VODs the app supports manual "clip now".

## Phase 1: Backend pipeline + Expo app
Goal: a working server running the real pipeline, and an Expo app driving it, openable in web preview.
- [x] FastAPI backend with job API running the notebook's pipeline unchanged
- [x] Pipeline verified end-to-end with a real stream URL → 1080x1920 clip produced
- [x] Expo app: Setup, Monitor, Clips screens with real API wiring
- [x] App verified in browser preview at phone and desktop widths

Acceptance: opening the app in preview, pasting a real YouTube URL, and tapping Start
produces hype-log output and finished clips listed and downloadable from the Clips screen.

## Phase 2: Android APK
Goal: an installable APK built from the same Expo app.
- [ ] Install Android SDK cmdline-tools + platform tools locally
- [ ] `expo prebuild` android project, `gradlew assembleDebug` succeeds
- [ ] APK artifact present with install instructions

Acceptance: `mobile/android/app/build/outputs/apk/debug/app-debug.apk` exists and the
Gradle build of the real app passes.
