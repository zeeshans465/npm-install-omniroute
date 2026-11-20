import AsyncStorage from "@react-native-async-storage/async-storage";

export type JobStatus = {
  job_id: string;
  status: string;
  credit: string;
  url: string;
  clips: string[];
  log: string[];
};

const BASE_KEY = "clipper.base_url";

function defaultBase(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    // The backend serves the web app itself, so same origin works everywhere.
    return window.location.origin;
  }
  return "http://10.0.2.2:8000"; // Android emulator → host machine
}

export const DEFAULT_BASE = defaultBase();

export async function getBase(): Promise<string> {
  return (await AsyncStorage.getItem(BASE_KEY)) || DEFAULT_BASE;
}

export async function setBase(url: string) {
  await AsyncStorage.setItem(BASE_KEY, url.replace(/\/+$/, ""));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 300) || `HTTP ${res.status}`);
  }
  return res.json();
}

export const createJob = (body: {
  url: string;
  credit: string;
  spike_multiplier: number;
  min_messages_per_5sec: number;
  cooldown_seconds: number;
}) => api<{ job_id: string }>("/api/jobs", { method: "POST", body: JSON.stringify(body) });

export const getJob = (id: string) => api<JobStatus>(`/api/jobs/${id}`);
export const stopJob = (id: string) => api<{ ok: boolean }>(`/api/jobs/${id}/stop`, { method: "POST" });
export const clipNow = (id: string) => api<{ ok: boolean }>(`/api/jobs/${id}/clip_now`, { method: "POST" });
export const clipUrl = async (jobId: string, clip: string) => `${await getBase()}/api/clips/files/${jobId}/${encodeURIComponent(clip)}`;
