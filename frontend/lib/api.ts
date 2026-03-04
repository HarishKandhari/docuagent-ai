import type {
  ActionRequest,
  ActionResponse,
  ClassifyResponse,
  DocumentListItem,
  QueryRequest,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Documents library ────────────────────────────────────────────────────────

export async function listDocuments(): Promise<DocumentListItem[]> {
  try {
    const res = await fetch(`${API_URL}/documents`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ─── Classify ─────────────────────────────────────────────────────────────────

export async function classifyDocument(
  file: File
): Promise<ClassifyResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/classify`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Classification failed: ${text}`);
  }

  return res.json();
}

// ─── Streaming query ──────────────────────────────────────────────────────────

export async function* streamQuery(
  request: QueryRequest
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_URL}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) yield parsed.token as string;
        if (parsed.error) throw new Error(parsed.error);
      } catch {
        // skip malformed lines
      }
    }
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function logAction(
  request: ActionRequest
): Promise<ActionResponse> {
  const res = await fetch(`${API_URL}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Action failed: ${text}`);
  }

  return res.json();
}
