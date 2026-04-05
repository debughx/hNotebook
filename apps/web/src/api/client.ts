import type {
  FolderDto,
  NoteDto,
  RagChatResponse,
  RagChatSessionDetail,
  RagChatSessionSummary,
  RagIngestResponse,
  RagIngestSourceDto,
  RagRuntimeConfig,
  RagRuntimeConfigSaved,
  TokenResponse,
} from './types'

const TOKEN_KEY = 'hnotebook_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: string }).message === 'string'
        ? (data as { message: string }).message
        : typeof data === 'object' &&
            data !== null &&
            'detail' in data
          ? String((data as { detail: unknown }).detail)
          : typeof data === 'string' && data.trim()
            ? data
            : res.statusText
    throw new Error(msg)
  }

  return data as T
}

export async function register(email: string, password: string) {
  return apiFetch<TokenResponse>('/api/auth/register', {
    method: 'POST',
    json: { email, password },
  })
}

export async function login(email: string, password: string) {
  return apiFetch<TokenResponse>('/api/auth/login', {
    method: 'POST',
    json: { email, password },
  })
}

export async function fetchNotes(filters?: { folderId?: string | null }) {
  const q = new URLSearchParams()
  if (filters?.folderId) q.set('folderId', filters.folderId)
  const qs = q.toString()
  return apiFetch<NoteDto[]>(`/api/notes${qs ? `?${qs}` : ''}`)
}

export async function createNote(payload?: { folderId?: string | null }) {
  return apiFetch<NoteDto>('/api/notes', {
    method: 'POST',
    json: {
      title: '',
      body: '',
      folderId: payload?.folderId ?? null,
      tagIds: [],
    },
  })
}

export async function patchNote(
  id: string,
  patch: {
    title?: string
    body?: string
    folderId?: string | null
    clearFolder?: boolean
  },
) {
  return apiFetch<NoteDto>(`/api/notes/${id}`, {
    method: 'PATCH',
    json: patch,
  })
}

export async function deleteNote(id: string) {
  return apiFetch<void>(`/api/notes/${id}`, { method: 'DELETE' })
}

export async function fetchFolders() {
  return apiFetch<FolderDto[]>('/api/folders')
}

export async function createFolder(name: string, parentId: string | null) {
  return apiFetch<FolderDto>('/api/folders', {
    method: 'POST',
    json: { name, parentId },
  })
}

export async function patchFolder(
  id: string,
  patch: { name?: string; parentId?: string | null; clearParent?: boolean },
) {
  return apiFetch<FolderDto>(`/api/folders/${id}`, {
    method: 'PATCH',
    json: patch,
  })
}

export async function deleteFolder(id: string) {
  return apiFetch<void>(`/api/folders/${id}`, { method: 'DELETE' })
}

async function ragFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (!token) throw new Error('请先登录')
  headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg =
      data &&
      typeof data === 'object' &&
      'detail' in data
        ? String((data as { detail: unknown }).detail)
        : typeof data === 'string' && data.trim()
          ? data
          : res.statusText
    throw new Error(msg)
  }

  return data as T
}

export async function ragListIngestSources() {
  return ragFetch<RagIngestSourceDto[]>('/rag/ingest/sources')
}

export async function ragIngest(
  sourceId: string,
  title: string,
  text: string,
  runtime?: RagRuntimeConfig,
) {
  return ragFetch<RagIngestResponse>('/rag/ingest', {
    method: 'POST',
    json: {
      source_id: sourceId,
      title,
      text,
      base_url: runtime?.baseUrl || undefined,
      api_key: runtime?.apiKey || undefined,
      embedding_model: runtime?.embeddingModel || undefined,
      chat_model: runtime?.chatModel || undefined,
    },
  })
}

export async function ragChat(message: string, runtime?: RagRuntimeConfig) {
  return ragFetch<RagChatResponse>('/rag/chat', {
    method: 'POST',
    json: {
      message,
      base_url: runtime?.baseUrl || undefined,
      api_key: runtime?.apiKey || undefined,
      embedding_model: runtime?.embeddingModel || undefined,
      chat_model: runtime?.chatModel || undefined,
    },
  })
}

export async function ragListChatSessions() {
  return ragFetch<RagChatSessionSummary[]>('/rag/chat/sessions')
}

export async function ragCreateChatSession(title?: string) {
  return ragFetch<RagChatSessionSummary>('/rag/chat/sessions', {
    method: 'POST',
    json: { title: title?.trim() ?? '' },
  })
}

export async function ragGetChatSession(sessionId: string) {
  return ragFetch<RagChatSessionDetail>(`/rag/chat/sessions/${sessionId}`)
}

export async function ragRenameChatSession(sessionId: string, title: string) {
  return ragFetch<RagChatSessionDetail>(`/rag/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    json: { title: title.trim() },
  })
}

export async function ragDeleteChatSession(sessionId: string) {
  return ragFetch<{ deleted: string }>(`/rag/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function ragClearChatSession(sessionId: string) {
  return ragFetch<{ cleared: string }>(
    `/rag/chat/sessions/${sessionId}/clear`,
    { method: 'POST' },
  )
}

export async function ragChatStream(
  message: string,
  runtime: RagRuntimeConfig | undefined,
  handlers: {
    onMeta?: (meta: { used_chunks: number; sources?: string[] }) => void
    onDelta: (text: string) => void
    onDone?: () => void
  },
  sessionId?: string,
) {
  const token = getToken()
  if (!token) throw new Error('请先登录')
  const res = await fetch('/rag/chat/stream', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      session_id: sessionId?.trim() || undefined,
      base_url: runtime?.baseUrl || undefined,
      api_key: runtime?.apiKey || undefined,
      embedding_model: runtime?.embeddingModel || undefined,
      chat_model: runtime?.chatModel || undefined,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    try {
      const j = JSON.parse(t) as { detail?: string }
      throw new Error(j.detail || '流式对话失败')
    } catch {
      throw new Error(t || '流式对话失败')
    }
  }
  if (!res.body) throw new Error('流式响应为空')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const events = buf.split('\n\n')
    buf = events.pop() ?? ''
    for (const evt of events) {
      const line = evt
        .split('\n')
        .find((ln) => ln.startsWith('data:'))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      let parsed: {
        type?: string
        text?: string
        used_chunks?: number
        sources?: string[]
        message?: string
      }
      try {
        parsed = JSON.parse(raw) as {
          type?: string
          text?: string
          used_chunks?: number
          sources?: string[]
          message?: string
        }
      } catch {
        continue
      }
      if (parsed.type === 'meta') {
        handlers.onMeta?.({
          used_chunks: parsed.used_chunks ?? 0,
          sources: parsed.sources,
        })
      } else if (parsed.type === 'delta') {
        handlers.onDelta(parsed.text ?? '')
      } else if (parsed.type === 'error') {
        throw new Error(parsed.message || '流式对话失败')
      } else if (parsed.type === 'done') {
        handlers.onDone?.()
      }
    }
  }
}

export async function ragStats() {
  return ragFetch<{ chunk_count: number }>('/rag/stats')
}

export async function ragGetConfig() {
  return ragFetch<RagRuntimeConfigSaved>('/rag/config')
}

export async function ragPutConfig(payload: {
  baseUrl: string
  apiKey: string
  embeddingModel: string
  chatModel: string
}) {
  return ragFetch<RagRuntimeConfigSaved>('/rag/config', {
    method: 'PUT',
    json: {
      base_url: payload.baseUrl,
      api_key: payload.apiKey,
      embedding_model: payload.embeddingModel,
      chat_model: payload.chatModel,
    },
  })
}
