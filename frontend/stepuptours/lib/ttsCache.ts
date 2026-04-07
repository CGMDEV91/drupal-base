// lib/ttsCache.ts
// Persistent TTS audio cache: IndexedDB on web, expo-file-system on native.

import { Platform } from 'react-native';

// ── Hash helper ──────────────────────────────────────────────────────────────
// Simple numeric hash → base-36 string. Avoids multi-KB cache keys.

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function ttsCacheKey(langcode: string, text: string): string {
  return `${langcode}-${simpleHash(text)}`;
}

// ── Web: IndexedDB ───────────────────────────────────────────────────────────

// Increment DB_NAME version suffix to invalidate old cached audio
const DB_NAME = 'stepuptours-tts-v2';
const STORE = 'audio';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function webGet(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function webSet(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(buffer, key);
  } catch {
    // Silent fail — cache miss on next read, no big deal
  }
}

// ── Native: expo-file-system ─────────────────────────────────────────────────

let FileSystem: typeof import('expo-file-system') | null = null;

async function ensureFS(): Promise<typeof import('expo-file-system')> {
  if (!FileSystem) FileSystem = await import('expo-file-system');
  return FileSystem;
}

function cacheDir(): string {
  // Lazy — FileSystem.cacheDirectory is a string constant, safe to access after import
  return `${FileSystem!.cacheDirectory}tts/`;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 1024;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...(chunk as unknown as number[]));
  }
  return btoa(binary);
}

async function nativeGet(key: string): Promise<ArrayBuffer | null> {
  try {
    const fs = await ensureFS();
    const path = `${cacheDir()}${key}.mp3`;
    const info = await fs.getInfoAsync(path);
    if (!info.exists) return null;
    const base64 = await fs.readAsStringAsync(path, {
      encoding: fs.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  } catch {
    return null;
  }
}

async function nativeSet(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const fs = await ensureFS();
    const dir = cacheDir();
    await fs.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const base64 = arrayBufferToBase64(buffer);
    await fs.writeAsStringAsync(`${dir}${key}.mp3`, base64, {
      encoding: fs.EncodingType.Base64,
    });
  } catch {
    // Silent fail
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getCachedAudio(key: string): Promise<ArrayBuffer | null> {
  if (Platform.OS === 'web') return webGet(key);
  return nativeGet(key);
}

export async function setCachedAudio(key: string, buffer: ArrayBuffer): Promise<void> {
  if (Platform.OS === 'web') return webSet(key, buffer);
  return nativeSet(key, buffer);
}
