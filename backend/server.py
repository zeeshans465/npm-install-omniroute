"""GTA 6 Live Auto-Clipper API server."""
import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from pipeline import ClipperJob

app = FastAPI(title="GTA6 Live Auto-Clipper")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, ClipperJob] = {}


class JobIn(BaseModel):
    url: str
    credit: str = "@CarryisLive"
    spike_multiplier: float = 2.5
    min_messages_per_5sec: int = 15
    cooldown_seconds: int = 90


@app.post("/api/jobs")
def create_job(job: JobIn):
    if not job.url.startswith("http"):
        raise HTTPException(400, "Paste a full URL (YouTube live or any yt-dlp source).")
    job_id = uuid.uuid4().hex[:8]
    cj = ClipperJob(job_id, job.url, job.credit, job.spike_multiplier,
                    job.min_messages_per_5sec, job.cooldown_seconds)
    JOBS[job_id] = cj
    cj.start()
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    cj = JOBS.get(job_id)
    if not cj:
        raise HTTPException(404, "Unknown job")
    return {
        "job_id": job_id,
        "status": cj.status,
        "credit": cj.credit,
        "url": cj.url,
        "clips": cj.clips,
        "log": list(cj.log),
    }


@app.post("/api/jobs/{job_id}/stop")
def stop_job(job_id: str):
    cj = JOBS.get(job_id)
    if not cj:
        raise HTTPException(404, "Unknown job")
    cj.stop()
    return {"ok": True}


@app.post("/api/jobs/{job_id}/clip_now")
def clip_now(job_id: str):
    cj = JOBS.get(job_id)
    if not cj:
        raise HTTPException(404, "Unknown job")
    if not cj.clip_now():
        raise HTTPException(409, "Job is stopped")
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True}


CLIPS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_clips")
os.makedirs(CLIPS_DIR, exist_ok=True)
app.mount("/api/clips/files", StaticFiles(directory=CLIPS_DIR), name="clips")

# Serve the exported Expo web app from the same origin (preview on port 3000).
# Registered last: it's a catch-all, so all API routes above take precedence.
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mobile", "dist")
if os.path.isdir(os.path.join(DIST, "_expo")):
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
