// A call recording is fetched through the authenticated request client and handled as bytes:
// played from the blob, saved from the blob (change `cdr-list-reads-its-envelope`, design W5/W6,
// spec `recording-playback`). No URL the console builds, renders or hands to a media element or a
// download ever names the stream path, so no credential has to travel in one.

import { customFetch } from './client';

/** Fetches a recording's bytes from its stream path, with the client's auth and 401 recovery. */
export function fetchRecording(streamPath: string): Promise<Blob> {
  return customFetch<Blob>({ url: streamPath, method: 'GET', responseType: 'blob' });
}

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/x-gsm': 'gsm',
  'audio/gsm': 'gsm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
};

/**
 * The saved file's name: the detail's `recordingName` when known, else the session id plus the
 * extension the blob's type implies (no extension for a type it does not name).
 */
export function recordingFileName(
  blobType: string,
  sessionId: string,
  recordingName?: string | null,
): string {
  if (recordingName) return recordingName;
  const mime = blobType.split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = EXTENSION_BY_TYPE[mime];
  return extension ? `${sessionId}.${extension}` : sessionId;
}

/** Hands a blob to the browser as a download through a short-lived object URL. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/** Fetches a recording through the authenticated client and saves it. */
export async function downloadRecording(
  streamPath: string,
  sessionId: string,
  recordingName?: string | null,
): Promise<void> {
  const blob = await fetchRecording(streamPath);
  saveBlob(blob, recordingFileName(blob.type, sessionId, recordingName));
}
