import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { ImgHTMLAttributes, MouseEvent as ReactMouseEvent } from 'react'
import type {
  FolderDto,
  NoteDto,
  RagChatSessionSummary,
  RagIngestSourceDto,
} from './api/types'
import * as api from './api/client'
import * as sync from './sync/engine'
import { ingestContentHashHex } from './util/hash'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconColumns,
  IconDatabase,
  IconFolder,
  IconInfo,
  IconLogOut,
  IconNoteGlyph,
  IconPalette,
  IconPencil,
  IconPlus,
  IconRobot,
  IconRefresh,
  IconSend,
  IconSidebarClosed,
  IconSidebarOpen,
  IconTrash,
  IconUser,
  IconX,
} from './ui-icons'
import {
  THEME_PRESET_IDS,
  THEME_PRESET_LABELS,
  isThemePresetId,
  type ThemePresetId,
} from './themePresets'
import './App.css'

type RagMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

type RagKbUiState = 'none' | 'unknown' | 'synced' | 'stale'

/** ~2.7rem; used to clamp saved FAB position into the viewport. */
const CHAT_FAB_BOX = 44

const SIDEBAR_WIDTH_KEY = 'hnotebook_sidebar_width'
const SIDEBAR_WIDTH_MIN = 200
const SIDEBAR_WIDTH_MAX = 560
const SPLITTER_W = 6

function readSidebarWidth(): number {
  if (typeof window === 'undefined') return 300
  const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
  const v = raw ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(v)) return 300
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, v))
}

const MD_PREVIEW_OPEN_KEY = 'hnotebook_md_preview_open'
const MD_PREVIEW_WIDTH_KEY = 'hnotebook_md_preview_width'
const MD_PREVIEW_WIDTH_MIN = 240
const MD_PREVIEW_WIDTH_MAX = 720

function readMdPreviewOpen(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(MD_PREVIEW_OPEN_KEY) === '1'
}

function readMdPreviewWidth(): number {
  if (typeof window === 'undefined') return 400
  const raw = localStorage.getItem(MD_PREVIEW_WIDTH_KEY)
  const v = raw ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(v)) return 400
  return Math.min(MD_PREVIEW_WIDTH_MAX, Math.max(MD_PREVIEW_WIDTH_MIN, v))
}

/**
 * Image URLs that a normal http(s) page cannot load (browser security):
 * file://, Windows drive paths, UNC, or backslash paths pasted from Explorer.
 */
function isNonWebImageSrc(src: string): boolean {
  const s = src.trim()
  if (!s) return true
  const lower = s.toLowerCase()
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return false
  if (lower.startsWith('http://') || lower.startsWith('https://')) return false
  if (lower.startsWith('//')) return false
  if (s.startsWith('/')) return false
  if (lower.startsWith('file:')) return true
  if (/^[a-zA-Z]:[\\/]/.test(s)) return true
  if (s.startsWith('\\\\')) return true
  if (s.includes('\\')) return true
  return false
}

function MdPreviewImg(
  props: ImgHTMLAttributes<HTMLImageElement> & { node?: unknown },
) {
  const { src = '', alt = '', className, node: _node, ...rest } = props
  const [remoteLoadError, setRemoteLoadError] = useState(false)

  useEffect(() => {
    setRemoteLoadError(false)
  }, [src])

  const srcStr = String(src)

  if (isNonWebImageSrc(srcStr)) {
    const shown = srcStr.trim() || '（无地址）'
    return (
      <figure className="md-preview-img-fallback">
        <figcaption className="md-preview-img-fallback-cap">
          {alt || '图片'}
        </figcaption>
        <div className="md-preview-img-fallback-src" dir="ltr">
          {shown}
        </div>
        <p className="md-preview-img-fallback-hint">
          浏览器禁止网页读取本机磁盘，因此无法预览此类地址。可改用：HTTPS
          图床链接；将文件放到站点 <code>public</code> 后用{' '}
          <code>/文件名.jpg</code>；或 <code>data:image/jpeg;base64,…</code>{' '}
          内嵌。
        </p>
      </figure>
    )
  }

  if (remoteLoadError) {
    return (
      <figure className="md-preview-img-fallback md-preview-img-fallback--remote">
        <figcaption className="md-preview-img-fallback-cap">
          {alt || '图片'}
        </figcaption>
        <div className="md-preview-img-fallback-src" dir="ltr">
          {srcStr.trim() || '（无地址）'}
        </div>
        <p className="md-preview-img-fallback-hint">
          该地址未能加载。不少图床会按来源站（Referer）防盗链；预览已使用{' '}
          <code>no-referrer</code> 请求。若仍失败，多为源站策略、需登录或链接失效，可换图床或把图片放到本站{' '}
          <code>public</code> 目录。
        </p>
      </figure>
    )
  }

  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setRemoteLoadError(true)}
      referrerPolicy="no-referrer"
    />
  )
}

const MARKDOWN_PREVIEW_COMPONENTS = { img: MdPreviewImg }

function clampChatFabPos(x: number, y: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const maxX = Math.max(0, window.innerWidth - CHAT_FAB_BOX)
  const maxY = Math.max(0, window.innerHeight - CHAT_FAB_BOX)
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  }
}

function loadChatFabPos(): { x: number; y: number } {
  const raw = localStorage.getItem('chat_fab_pos')
  if (!raw) return { x: -1, y: -1 }
  try {
    const p = JSON.parse(raw) as { x?: number; y?: number }
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { x: -1, y: -1 }
    if (p.x! < 0 || p.y! < 0) return { x: -1, y: -1 }
    return clampChatFabPos(p.x!, p.y!)
  } catch {
    return { x: -1, y: -1 }
  }
}

const CHAT_PANEL_EDGE = 10

function getChatPanelSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 920, h: 760 }
  const gutter = 20
  const w = Math.min(920, Math.max(280, window.innerWidth - gutter))
  const h = Math.min(Math.floor(window.innerHeight * 0.8), 760)
  return { w, h }
}

function clampChatPanelPos(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const m = CHAT_PANEL_EDGE
  const maxX = Math.max(m, window.innerWidth - w - m)
  const maxY = Math.max(m, window.innerHeight - h - m)
  return {
    x: Math.min(maxX, Math.max(m, x)),
    y: Math.min(maxY, Math.max(m, y)),
  }
}

/** 面板左上角：优先在气泡上方，右缘对齐气泡右缘；放不下则改到气泡下方 */
function chatPanelPosNearFab(fab: DOMRect | undefined): { x: number; y: number } {
  const { w, h } = getChatPanelSize()
  const m = CHAT_PANEL_EDGE
  const gap = 10
  if (!fab || fab.width < 2 || fab.height < 2) {
    return clampChatPanelPos(
      window.innerWidth - w - m,
      window.innerHeight - h - m,
      w,
      h,
    )
  }
  let x = fab.right - w
  let y = fab.top - h - gap
  if (y < m) y = fab.bottom + gap
  return clampChatPanelPos(x, y, w, h)
}

function ragKbPillText(s: RagKbUiState | undefined): string | null {
  if (s === undefined) return null
  if (s === 'none') return '未索引'
  if (s === 'unknown') return '已索引'
  if (s === 'synced') return '已同步'
  return '有更新'
}

function ragKbTitle(s: RagKbUiState): string {
  const label = ragKbPillText(s) ?? ''
  return `相对知识库上次同步的内容（标题+正文）：${label}`
}

function formatEditorUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function orderedFolders(folders: FolderDto[]): FolderDto[] {
  const byParent = new Map<string, FolderDto[]>()
  for (const f of folders) {
    const p = f.parentId ?? '__root__'
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(f)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  const out: FolderDto[] = []
  const walk = (pid: string | null) => {
    const key = pid === null ? '__root__' : pid
    for (const f of byParent.get(key) ?? []) {
      out.push(f)
      walk(f.id)
    }
  }
  walk(null)
  return out
}

/** Drag-and-drop payload prefixes (avoid id collisions between notes and folders). */
const DND_FOLDER = 'folder:'
const DND_NOTE = 'note:'

function App() {
  const [token, setTokenState] = useState<string | null>(() => api.getToken())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [folders, setFolders] = useState<FolderDto[]>([])
  const [notes, setNotes] = useState<NoteDto[]>([])
  const [noteQuery, setNoteQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [listError, setListError] = useState<string | null>(null)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [lwwHint, setLwwHint] = useState<string | null>(null)

  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [narrowLayout, setNarrowLayout] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 980px)').matches,
  )
  const [mdPreviewOpen, setMdPreviewOpen] = useState(readMdPreviewOpen)
  const [previewPaneWidth, setPreviewPaneWidth] = useState(readMdPreviewWidth)
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [treeMenu, setTreeMenu] = useState<
    | { kind: 'folder'; folderId: string; x: number; y: number }
    | { kind: 'note'; noteId: string; x: number; y: number }
    | null
  >(null)
  const [folderDialog, setFolderDialog] = useState<
    null | { mode: 'create'; parentId: string | null } | { mode: 'rename'; folderId: string }
  >(null)
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<
    null | { kind: 'note'; id: string } | { kind: 'folder'; id: string }
  >(null)
  const folderNameInputRef = useRef<HTMLInputElement>(null)
  const sessionTitleComposingRef = useRef(false)
  const noteTitleComposingRef = useRef(false)
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [noteRename, setNoteRename] = useState<{ id: string; text: string } | null>(
    null,
  )
  const [ragQ, setRagQ] = useState('')
  const [ragMessages, setRagMessages] = useState<RagMessage[]>([])
  const [ragSessions, setRagSessions] = useState<RagChatSessionSummary[]>([])
  const [activeRagSessionId, setActiveRagSessionId] = useState<string | null>(null)
  const [ragSessionsBusy, setRagSessionsBusy] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameTitleDraft, setRenameTitleDraft] = useState('')
  const activeRagSessionRef = useRef<string | null>(null)
  const [ragChunks, setRagChunks] = useState<number | null>(null)
  const [ragIngestSources, setRagIngestSources] = useState<RagIngestSourceDto[]>([])
  const [ragKbNoteState, setRagKbNoteState] = useState<Record<string, RagKbUiState>>({})
  const [ragBulkProgress, setRagBulkProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [ragBusy, setRagBusy] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatFabPos, setChatFabPos] = useState<{ x: number; y: number }>(loadChatFabPos)
  const [chatPanelPos, setChatPanelPos] = useState({ x: 0, y: 0 })
  const chatFabRef = useRef<HTMLButtonElement | null>(null)
  const chatPanelPosRef = useRef(chatPanelPos)
  chatPanelPosRef.current = chatPanelPos
  const [ragBaseUrl, setRagBaseUrl] = useState('')
  const [ragApiKey, setRagApiKey] = useState('')
  const [ragEmbeddingModel, setRagEmbeddingModel] = useState('')
  const [ragChatModel, setRagChatModel] = useState('')
  const [ragApiKeyVisible, setRagApiKeyVisible] = useState(false)
  const [ragConfigBusy, setRagConfigBusy] = useState(false)
  const [ragConfigHint, setRagConfigHint] = useState<string | null>(null)
  const [ragConfigOpen, setRagConfigOpen] = useState(false)
  const [pendingOutbox, setPendingOutbox] = useState(0)

  const autosaveOk = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesRef = useRef(notes)
  const chatThreadRef = useRef<HTMLDivElement | null>(null)
  const chatFabDraggingRef = useRef(false)
  const chatFabMovedRef = useRef(false)
  const chatFabOffsetRef = useRef({ dx: 0, dy: 0 })
  const onChatPanelDragStart = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const { w, h } = getChatPanelSize()
    const sx = chatPanelPosRef.current.x
    const sy = chatPanelPosRef.current.y
    const ox = e.clientX
    const oy = e.clientY
    const onMove = (ev: MouseEvent) => {
      setChatPanelPos(
        clampChatPanelPos(sx + ev.clientX - ox, sy + ev.clientY - oy, w, h),
      )
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])
  notesRef.current = notes
  activeRagSessionRef.current = activeRagSessionId

  const [themePreset, setThemePreset] = useState<ThemePresetId>(() => {
    const d = document.documentElement.dataset.themePreset
    return isThemePresetId(d) ? d : 'white-gray'
  })
  const [themePresetOpen, setThemePresetOpen] = useState(false)
  const themePresetWrapRef = useRef<HTMLDivElement | null>(null)

  const ragRuntime = useMemo(() => {
    const baseUrl = ragBaseUrl.trim()
    const apiKey = ragApiKey.trim()
    const embeddingModel = ragEmbeddingModel.trim()
    const chatModel = ragChatModel.trim()
    return {
      baseUrl: baseUrl || undefined,
      apiKey: apiKey || undefined,
      embeddingModel: embeddingModel || undefined,
      chatModel: chatModel || undefined,
    }
  }, [ragBaseUrl, ragApiKey, ragEmbeddingModel, ragChatModel])

  const refreshUiFromDb = useCallback(async () => {
    const { folders: fd } = await sync.loadCachedFolders()
    setFolders(orderedFolders(fd))
    const nt = await sync.getFilteredNotes(null)
    setNotes(nt)
    setSelectedId((sid) => {
      if (nt.length === 0) return null
      if (sid && nt.some((n) => n.id === sid)) return sid
      return nt[0].id
    })
    setPendingOutbox(await sync.getOutboxCount())
  }, [])

  const applyLwwHint = useCallback((count: number | undefined) => {
    if (count != null && count > 0) {
      setLwwHint(`已按服务端覆盖 ${count} 条笔记（LWW）`)
      window.setTimeout(() => setLwwHint(null), 8000)
    }
  }, [])

  const doSyncWithLww = useCallback(async () => {
    const r = await sync.syncAll()
    applyLwwHint(r.notesOverwrittenByServer)
    return r
  }, [applyLwwHint])

  const runRemoteSync = useCallback(async () => {
    setListError(null)
    try {
      await sync.ensureScopedUser(api.getToken())
      if (sync.isBrowserOnline()) {
        const r = await doSyncWithLww()
        if (!r.ok && r.message) setListError(r.message)
        else setListError(null)
      } else {
        setListError(
          '离线：内容已写入本机 IndexedDB，联网后将自动与服务端同步（LWW）。',
        )
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : '同步失败')
    }
  }, [doSyncWithLww])

  const loadData = useCallback(async () => {
    await runRemoteSync()
    await refreshUiFromDb()
  }, [runRemoteSync, refreshUiFromDb])

  const refreshUiRef = useRef(refreshUiFromDb)
  refreshUiRef.current = refreshUiFromDb

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      await runRemoteSync()
      if (!cancelled) await refreshUiRef.current()
    })()
    return () => {
      cancelled = true
    }
  }, [token, runRemoteSync])

  useEffect(() => {
    if (!token) return
    void refreshUiFromDb()
  }, [token, refreshUiFromDb])

  useEffect(() => {
    const onOnline = () => {
      void loadData()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [loadData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 980px)')
    const apply = () => setNarrowLayout(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    autosaveOk.current = false
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (!selectedId) {
      setTitle('')
      setBody('')
      requestAnimationFrame(() => {
        autosaveOk.current = true
      })
      return
    }
    const n = notesRef.current.find((x) => x.id === selectedId)
    if (!n) {
      setTitle('')
      setBody('')
      requestAnimationFrame(() => {
        autosaveOk.current = true
      })
      return
    }
    setTitle(n.title ?? '')
    setBody(n.body ?? '')
    requestAnimationFrame(() => {
      autosaveOk.current = true
    })
  }, [selectedId])

  useEffect(() => {
    if (!token || !selectedId || !autosaveOk.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const cur = notes.find((x) => x.id === selectedId)
          if (!cur || (cur.title === title && cur.body === body)) return
          await sync.saveNoteContentLocal(selectedId, title, body)
          await refreshUiFromDb()
          const nid = await sync.flushOutbox(selectedId)
          if (nid) setSelectedId(nid)
          await refreshUiFromDb()
          setSaveHint(sync.isBrowserOnline() ? '已自动保存' : '已保存到本机')
          setTimeout(() => setSaveHint(null), 1800)
        } catch {
          setSaveHint('自动保存失败')
        }
      })()
    }, 750)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [title, body, selectedId, token, notes, refreshUiFromDb])

  const applyThemePreset = useCallback((id: ThemePresetId) => {
    document.documentElement.dataset.themePreset = id
    localStorage.setItem('hnotebook_theme_preset', id)
    setThemePreset(id)
    setThemePresetOpen(false)
  }, [])

  useEffect(() => {
    if (!themePresetOpen) return
    const onDoc = (e: MouseEvent) => {
      if (themePresetWrapRef.current?.contains(e.target as Node)) return
      setThemePresetOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [themePresetOpen])

  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthError(null)
    setBusy(true)
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password)
      api.setToken(res.accessToken)
      await sync.ensureScopedUser(res.accessToken)
      setTokenState(res.accessToken)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Auth failed')
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    api.setToken(null)
    setTokenState(null)
    setFolders([])
    setNotes([])
    setSelectedId(null)
    setTitle('')
    setBody('')
    setRagSessions([])
    setActiveRagSessionId(null)
    setRagMessages([])
    setChatOpen(false)
    setRagConfigOpen(false)
    setRenamingSessionId(null)
    setRagIngestSources([])
    setRagKbNoteState({})
    setRagBulkProgress(null)
  }

  const selectNote = (n: NoteDto) => {
    setSelectedId(n.id)
    setSaveHint(null)
  }

  const handleNewNote = async (targetFolderId: string | null = null) => {
    setBusy(true)
    setListError(null)
    try {
      const id = await sync.createNoteLocal(targetFolderId)
      setTitle('')
      setBody('')
      setSelectedId(id)
      await refreshUiFromDb()
      const nid = await sync.flushOutbox(id)
      if (nid) setSelectedId(nid)
      await refreshUiFromDb()
      if (sync.isBrowserOnline()) {
        const sr = await doSyncWithLww()
        if (!sr.ok && sr.message) setListError(sr.message)
        await refreshUiFromDb()
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const deleteNoteById = (id: string) => {
    setConfirmDialog({ kind: 'note', id })
  }

  const runConfirmDelete = async () => {
    if (!confirmDialog) return
    const d = confirmDialog
    setConfirmDialog(null)
    setBusy(true)
    try {
      if (d.kind === 'note') {
        await sync.deleteNoteLocal(d.id)
        await refreshUiFromDb()
        await sync.flushOutbox(null)
        await refreshUiFromDb()
        if (sync.isBrowserOnline()) {
          const sr = await doSyncWithLww()
          if (!sr.ok && sr.message) setListError(sr.message)
          await refreshUiFromDb()
        }
      } else {
        await sync.deleteFolderLocal(d.id)
        await refreshUiFromDb()
        if (sync.isBrowserOnline()) {
          await sync.flushOutbox(null)
          const sr = await doSyncWithLww()
          if (!sr.ok && sr.message) setListError(sr.message)
        }
        await refreshUiFromDb()
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const moveNoteToFolder = async (noteId: string, targetFolderId: string | null) => {
    const n = notes.find((x) => x.id === noteId)
    if (!n || n.folderId === targetFolderId) return
    setBusy(true)
    try {
      await sync.saveNoteFolderLocal(noteId, targetFolderId, targetFolderId === null)
      await refreshUiFromDb()
      const nid = await sync.flushOutbox(noteId)
      if (nid && noteId === selectedId) setSelectedId(nid)
      await refreshUiFromDb()
      if (sync.isBrowserOnline()) await doSyncWithLww()
      await refreshUiFromDb()
    } catch (e) {
      setListError(e instanceof Error ? e.message : '移动笔记失败')
    } finally {
      setBusy(false)
    }
  }

  const commitNoteRename = async () => {
    if (!noteRename) return
    const { id, text } = noteRename
    const n = notes.find((x) => x.id === id)
    setNoteRename(null)
    if (!n) return
    const nextTitle = text.trim()
    if (nextTitle === (n.title ?? '').trim()) return
    const bodyForSave = id === selectedId ? body : n.body
    setBusy(true)
    try {
      await sync.saveNoteContentLocal(id, nextTitle, bodyForSave)
      if (id === selectedId) setTitle(nextTitle)
      await refreshUiFromDb()
      const nid = await sync.flushOutbox(id)
      if (nid && id === selectedId) setSelectedId(nid)
      await refreshUiFromDb()
      if (sync.isBrowserOnline()) await doSyncWithLww()
      await refreshUiFromDb()
    } catch (e) {
      setListError(e instanceof Error ? e.message : '重命名失败')
    } finally {
      setBusy(false)
    }
  }

  const startNoteRename = (n: NoteDto) => {
    setNoteRename({ id: n.id, text: n.title ?? '' })
  }

  const newFolder = (parentId: string | null = null) => {
    setFolderNameDraft('')
    setFolderDialog({ mode: 'create', parentId })
  }

  const submitFolderDialog = async () => {
    if (!folderDialog) return
    const name = folderNameDraft.trim()
    if (!name) return
    if (folderDialog.mode === 'rename') {
      const folderId = folderDialog.folderId
      setFolderDialog(null)
      await applyFolderPatch(folderId, { name }, '重命名失败')
      return
    }
    const parentId = folderDialog.parentId
    setFolderDialog(null)
    setBusy(true)
    try {
      await sync.createFolderLocal(name, parentId)
      await refreshUiFromDb()
      if (sync.isBrowserOnline()) {
        await sync.flushOutbox(null)
        const sr = await doSyncWithLww()
        if (!sr.ok && sr.message) setListError(sr.message)
      }
      await refreshUiFromDb()
    } catch (e) {
      setListError(e instanceof Error ? e.message : '创建文件夹失败')
    } finally {
      setBusy(false)
    }
  }

  const removeFolder = (id: string) => {
    if (folders.some((f) => f.parentId === id)) {
      setListError('请先删除或移动子文件夹')
      return
    }
    setConfirmDialog({ kind: 'folder', id })
  }

  const runRagIngestQueue = async (list: NoteDto[], confirmThreshold = 10) => {
    if (list.length === 0) return
    if (
      list.length > confirmThreshold &&
      !window.confirm(
        `将依次同步 ${list.length} 篇笔记到知识库（调用 embedding，可能较慢且消耗额度）。继续？`,
      )
    ) {
      return
    }
    setRagBusy(true)
    setRagBulkProgress({ done: 0, total: list.length })
    try {
      for (let i = 0; i < list.length; i++) {
        const n = list[i]!
        await api.ragIngest(
          n.id,
          n.title.trim() || '(无标题)',
          n.body ?? '',
          ragRuntime,
        )
        setRagBulkProgress({ done: i + 1, total: list.length })
      }
      await refreshRagIndex()
      setRagMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: `已同步 ${list.length} 篇笔记到知识库。`,
        },
      ])
    } catch (e) {
      setListError(e instanceof Error ? e.message : '批量同步失败')
    } finally {
      setRagBulkProgress(null)
      setRagBusy(false)
    }
  }

  const syncKnowledgeBase = async () => {
    if (notes.length === 0) return
    await runRagIngestQueue(notes)
  }

  const loadRagSessionMessages = useCallback(async (sessionId: string) => {
    const d = await api.ragGetChatSession(sessionId)
    setRagMessages(
      d.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
    )
  }, [])

  const selectRagSession = async (id: string) => {
    setActiveRagSessionId(id)
    setRenamingSessionId(null)
    try {
      await loadRagSessionMessages(id)
    } catch {
      setRagMessages([])
    }
  }

  const newRagSession = async () => {
    try {
      const c = await api.ragCreateChatSession()
      const list = await api.ragListChatSessions()
      setRagSessions(list)
      setActiveRagSessionId(c.id)
      setRagMessages([])
      setRenamingSessionId(null)
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: e instanceof Error ? e.message : '新建会话失败',
        },
      ])
    }
  }

  const deleteRagSession = async (id: string, ev?: ReactMouseEvent) => {
    ev?.stopPropagation()
    try {
      await api.ragDeleteChatSession(id)
      let list = await api.ragListChatSessions()
      if (list.length === 0) list = [await api.ragCreateChatSession()]
      setRagSessions(list)
      const cur = activeRagSessionRef.current
      const needSwitch = cur === id || !cur || !list.some((s) => s.id === cur)
      const nextId = needSwitch ? list[0]!.id : cur!
      setActiveRagSessionId(nextId)
      await loadRagSessionMessages(nextId)
      if (renamingSessionId === id) setRenamingSessionId(null)
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: e instanceof Error ? e.message : '删除会话失败',
        },
      ])
    }
  }

  const startRenameSession = (s: RagChatSessionSummary, ev: ReactMouseEvent) => {
    ev.stopPropagation()
    setRenamingSessionId(s.id)
    setRenameTitleDraft(s.title)
  }

  const commitRenameSession = async () => {
    if (!renamingSessionId) return
    const t = renameTitleDraft.trim()
    if (!t) return
    try {
      await api.ragRenameChatSession(renamingSessionId, t)
      setRenamingSessionId(null)
      setRagSessions(await api.ragListChatSessions())
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: e instanceof Error ? e.message : '重命名失败',
        },
      ])
    }
  }

  const clearRagChatMessages = async () => {
    if (!activeRagSessionId) return
    try {
      await api.ragClearChatSession(activeRagSessionId)
      setRagMessages([])
      setRagSessions(await api.ragListChatSessions())
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'system',
          content: e instanceof Error ? e.message : '清空失败',
        },
      ])
    }
  }

  const sendRag = async () => {
    const q = ragQ.trim()
    if (!q) return
    const sid = activeRagSessionId
    if (!sid) return
    setRagBusy(true)
    setRagQ('')
    setChatOpen(true)
    const aid = crypto.randomUUID()
    setRagMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: q },
      { id: aid, role: 'assistant', content: '' },
    ])
    try {
      await api.ragChatStream(
        q,
        ragRuntime,
        {
          onMeta: (meta) => setRagChunks(meta.used_chunks),
          onDelta: (text) =>
            setRagMessages((prev) =>
              prev.map((m) => (m.id === aid ? { ...m, content: m.content + text } : m)),
            ),
          onDone: async () => {
            try {
              setRagSessions(await api.ragListChatSessions())
            } catch {
              /* ignore */
            }
          },
        },
        sid,
      )
    } catch (e) {
      setRagMessages((prev) => [
        ...prev.filter((m) => m.id !== aid),
        {
          id: aid,
          role: 'assistant',
          content: e instanceof Error ? e.message : '问答失败',
        },
      ])
    } finally {
      setRagBusy(false)
    }
  }

  const refreshRagIndex = useCallback(async () => {
    try {
      const [s, src] = await Promise.all([
        api.ragStats(),
        api.ragListIngestSources(),
      ])
      setRagChunks(s.chunk_count)
      setRagIngestSources(src)
    } catch {
      setRagChunks(null)
      setRagIngestSources([])
    }
  }, [])

  const loadRagConfig = useCallback(async () => {
    try {
      const c = await api.ragGetConfig()
      setRagBaseUrl(c.base_url || '')
      setRagApiKey(c.api_key || '')
      setRagEmbeddingModel(c.embedding_model || '')
      setRagChatModel(c.chat_model || '')
      setRagConfigHint(null)
    } catch {
      // Keep local input if loading fails.
    }
  }, [])

  const saveRagConfig = async () => {
    setRagConfigBusy(true)
    try {
      await api.ragPutConfig({
        baseUrl: ragBaseUrl.trim(),
        apiKey: ragApiKey.trim(),
        embeddingModel: ragEmbeddingModel.trim(),
        chatModel: ragChatModel.trim(),
      })
      setRagConfigHint('模型配置已保存（绑定当前账号）')
      window.setTimeout(() => setRagConfigHint(null), 2200)
    } catch (e) {
      setRagConfigHint(e instanceof Error ? e.message : '保存失败')
    } finally {
      setRagConfigBusy(false)
    }
  }

  useEffect(() => {
    if (!token) return
    void refreshRagIndex()
  }, [token, refreshRagIndex])

  const ragKbByNoteId = useMemo(() => {
    const m = new Map<string, RagIngestSourceDto>()
    for (const s of ragIngestSources) m.set(s.source_id, s)
    return m
  }, [ragIngestSources])

  useEffect(() => {
    if (!token) {
      setRagKbNoteState({})
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      ;(async () => {
        const out: Record<string, RagKbUiState> = {}
        for (const n of notes) {
          if (cancelled) return
          const meta = ragKbByNoteId.get(n.id)
          const t = n.id === selectedId ? title : (n.title ?? '')
          const b = n.id === selectedId ? body : (n.body ?? '')
          if (!meta) {
            out[n.id] = 'none'
            continue
          }
          if (!meta.content_hash) {
            out[n.id] = 'unknown'
            continue
          }
          const h = await ingestContentHashHex(t, b)
          if (cancelled) return
          out[n.id] = h === meta.content_hash ? 'synced' : 'stale'
        }
        if (!cancelled) setRagKbNoteState(out)
      })().catch(() => {
        if (!cancelled) setRagKbNoteState({})
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [token, notes, ragKbByNoteId, selectedId, title, body])

  useEffect(() => {
    if (!token) return
    void loadRagConfig()
  }, [token, loadRagConfig])

  useEffect(() => {
    if (!chatOpen || !token) return
    let cancelled = false
    ;(async () => {
      setRagSessionsBusy(true)
      try {
        let list = await api.ragListChatSessions()
        if (list.length === 0) list = [await api.ragCreateChatSession()]
        if (cancelled) return
        setRagSessions(list)
        const prefer = activeRagSessionRef.current
        const id =
          prefer && list.some((s) => s.id === prefer) ? prefer : list[0]!.id
        setActiveRagSessionId(id)
        await loadRagSessionMessages(id)
      } catch {
        if (!cancelled) {
          setRagSessions([])
          setActiveRagSessionId(null)
          setRagMessages([])
        }
      } finally {
        if (!cancelled) setRagSessionsBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatOpen, token, loadRagSessionMessages])

  useEffect(() => {
    if (!chatThreadRef.current) return
    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight
  }, [ragMessages])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === '[') {
        e.preventDefault()
        setLeftDrawerOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!ragConfigOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRagConfigOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [ragConfigOpen])

  useEffect(() => {
    if (!folderDialog && !confirmDialog) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFolderDialog(null)
        setConfirmDialog(null)
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [folderDialog, confirmDialog])

  useEffect(() => {
    if (!mdPreviewOpen || !narrowLayout) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMdPreviewOpen(false)
        if (typeof window !== 'undefined') {
          localStorage.setItem(MD_PREVIEW_OPEN_KEY, '0')
        }
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [mdPreviewOpen, narrowLayout])

  useEffect(() => {
    if (!folderDialog) return
    const id = requestAnimationFrame(() => {
      const el = folderNameInputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
    return () => cancelAnimationFrame(id)
  }, [folderDialog])

  useEffect(() => {
    if (!folderDialog) setFolderNameDraft('')
  }, [folderDialog])

  useEffect(() => {
    if (!renamingSessionId) sessionTitleComposingRef.current = false
  }, [renamingSessionId])

  useEffect(() => {
    if (!noteRename) noteTitleComposingRef.current = false
  }, [noteRename])

  useEffect(() => {
    const close = () => setTreeMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    localStorage.setItem('chat_fab_pos', JSON.stringify(chatFabPos))
  }, [chatFabPos])

  useLayoutEffect(() => {
    if (!chatOpen) return
    const r = chatFabRef.current?.getBoundingClientRect()
    setChatPanelPos(chatPanelPosNearFab(r && r.width > 0 ? r : undefined))
  }, [chatOpen])

  useEffect(() => {
    if (!chatOpen) return
    const onResize = () => {
      const { w, h } = getChatPanelSize()
      setChatPanelPos((p) => clampChatPanelPos(p.x, p.y, w, h))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [chatOpen])

  useEffect(() => {
    const onResize = () => {
      setChatFabPos((cur) => {
        if (cur.x < 0 || cur.y < 0) return cur
        return clampChatFabPos(cur.x, cur.y)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fo = orderedFolders(folders)
  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  )
  const foldersByParent = useMemo(() => {
    const m = new Map<string | null, FolderDto[]>()
    for (const f of fo) {
      const pid = f.parentId ?? null
      if (!m.has(pid)) m.set(pid, [])
      m.get(pid)!.push(f)
    }
    return m
  }, [fo])
  const displayedNotes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase()
    const base = [...notes].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    if (!q) return base
    return base.filter((n) => {
      const t = (n.title || '').toLowerCase()
      const b = (n.body || '').toLowerCase()
      return t.includes(q) || b.includes(q)
    })
  }, [notes, noteQuery])

  const notesByFolder = useMemo(() => {
    const m = new Map<string | null, NoteDto[]>()
    for (const n of notes) {
      const k = n.folderId ?? null
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(n)
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const ta = (a.title || '').trim() || '(无标题)'
        const tb = (b.title || '').trim() || '(无标题)'
        const cmp = ta.localeCompare(tb, 'zh-CN')
        if (cmp !== 0) return cmp
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
    }
    return m
  }, [notes])

  const selectedNote = useMemo(
    () => (selectedId ? (notes.find((n) => n.id === selectedId) ?? null) : null),
    [notes, selectedId],
  )

  const noteMatchesQuery = (n: NoteDto) => {
    const q = noteQuery.trim().toLowerCase()
    if (!q) return true
    return (
      (n.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q)
    )
  }

  const toggleFolderCollapse = (id: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const layoutGridColumns = useMemo(() => {
    if (narrowLayout) return 'minmax(0, 1fr)'
    if (!leftDrawerOpen) return '0px minmax(0, 1fr)'
    return `${sidebarWidth}px ${SPLITTER_W}px minmax(0, 1fr)`
  }, [narrowLayout, leftDrawerOpen, sidebarWidth])

  const onLayoutSplitterDown = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (narrowLayout || !leftDrawerOpen) return
      const startX = e.clientX
      const startW = sidebarWidth
      let lastW = startW
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        lastW = Math.min(
          SIDEBAR_WIDTH_MAX,
          Math.max(SIDEBAR_WIDTH_MIN, startW + dx),
        )
        setSidebarWidth(lastW)
      }
      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(lastW))
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [narrowLayout, leftDrawerOpen, sidebarWidth],
  )

  const toggleMdPreview = useCallback(() => {
    setMdPreviewOpen((v) => {
      const next = !v
      if (typeof window !== 'undefined') {
        localStorage.setItem(MD_PREVIEW_OPEN_KEY, next ? '1' : '0')
      }
      return next
    })
  }, [])

  const onPreviewSplitterDown = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (narrowLayout || !mdPreviewOpen) return
      const startX = e.clientX
      const startW = previewPaneWidth
      let lastW = startW
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        lastW = Math.min(
          MD_PREVIEW_WIDTH_MAX,
          Math.max(MD_PREVIEW_WIDTH_MIN, startW - dx),
        )
        setPreviewPaneWidth(lastW)
      }
      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem(MD_PREVIEW_WIDTH_KEY, String(lastW))
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [narrowLayout, mdPreviewOpen, previewPaneWidth],
  )

  const markdownPreviewDoc = useMemo(() => {
    if (!mdPreviewOpen || !selectedId) return null
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_PREVIEW_COMPONENTS}
      >
        {body}
      </ReactMarkdown>
    )
  }, [body, mdPreviewOpen, selectedId])

  const isDescendantTarget = useCallback(
    (candidateParentId: string | null, folderId: string): boolean => {
      let cur = candidateParentId
      while (cur) {
        if (cur === folderId) return true
        cur = folderById.get(cur)?.parentId ?? null
      }
      return false
    },
    [folderById],
  )

  const applyFolderPatch = async (
    folderId: string,
    patch: { name?: string; parentId?: string | null; clearParent?: boolean },
    failHint: string,
  ) => {
    setBusy(true)
    setTreeMenu(null)
    try {
      await sync.updateFolderLocal(folderId, patch)
      await refreshUiFromDb()
      if (sync.isBrowserOnline()) {
        await sync.flushOutbox(null)
        const sr = await doSyncWithLww()
        if (!sr.ok && sr.message) setListError(sr.message)
      }
      await refreshUiFromDb()
    } catch (e) {
      setListError(e instanceof Error ? e.message : failHint)
    } finally {
      setBusy(false)
    }
  }

  const renameFolder = (folderId: string) => {
    const cur = folderById.get(folderId)
    setFolderNameDraft(cur?.name ?? '')
    setFolderDialog({ mode: 'rename', folderId })
  }

  const moveFolder = async (folderId: string, newParentId: string | null) => {
    const cur = folderById.get(folderId)
    if (!cur) return
    if (cur.parentId === newParentId) return
    if (isDescendantTarget(newParentId, folderId)) {
      setListError('不能把文件夹拖到其自身或子目录下')
      return
    }
    if (newParentId === null) {
      await applyFolderPatch(
        folderId,
        { parentId: null, clearParent: true },
        '移动文件夹失败',
      )
      return
    }
    await applyFolderPatch(folderId, { parentId: newParentId }, '移动文件夹失败')
  }

  const renderNoteRow = (n: NoteDto, depth: number) => {
    const kb = ragKbNoteState[n.id]
    return (
      <div
        key={n.id}
        className={`tree-note-row ${selectedId === n.id ? 'active' : ''}`}
        style={{ paddingLeft: `${0.55 + depth * 0.72}rem` }}
        draggable
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setTreeMenu({ kind: 'note', noteId: n.id, x: e.clientX, y: e.clientY })
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', DND_NOTE + n.id)
          e.dataTransfer.effectAllowed = 'move'
          setDraggingNoteId(n.id)
        }}
        onDragEnd={() => {
          setDraggingNoteId(null)
          setDropTargetFolderId(null)
        }}
      >
        <button type="button" className="tree-note-main" onClick={() => selectNote(n)}>
          <span className="tree-note-icon" aria-hidden>
            <IconNoteGlyph size={14} />
          </span>
          {noteRename?.id === n.id ? (
            <input
              className="tree-note-rename-input"
              value={noteRename.text}
              onCompositionStart={() => {
                noteTitleComposingRef.current = true
              }}
              onCompositionEnd={(e) => {
                noteTitleComposingRef.current = false
                setNoteRename({ id: n.id, text: e.currentTarget.value })
              }}
              onChange={(e) => {
                if (noteTitleComposingRef.current) return
                setNoteRename({ id: n.id, text: e.target.value })
              }}
              onBlur={() => void commitNoteRename()}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !(e.nativeEvent as KeyboardEvent).isComposing
                ) {
                  e.preventDefault()
                  void commitNoteRename()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setNoteRename(null)
                }
              }}
              autoFocus
              onClick={(ev) => ev.stopPropagation()}
            />
          ) : (
            <span className="tree-note-title">
              {(n.title || '').trim() || '(无标题)'}
            </span>
          )}
          {kb != null && (
            <span className={`note-kb-dot note-kb-${kb}`} title={ragKbTitle(kb)} />
          )}
        </button>
      </div>
    )
  }

  const renderNotesInFolder = (folderId: string | null, depth: number) =>
    (notesByFolder.get(folderId) ?? [])
      .filter((n) => noteMatchesQuery(n))
      .map((n) => renderNoteRow(n, depth))

  const renderFolderTree = (parentId: string | null, depth = 0) => {
    const nodes = foldersByParent.get(parentId) ?? []
    return nodes.map((f) => {
      const children = foldersByParent.get(f.id) ?? []
      const hasChildren = children.length > 0
      const collapsed = collapsedFolderIds.has(f.id)
      const showSubtree = !collapsed
      return (
        <div key={f.id} className="folder-tree-node">
          <div
            className="folder-row folder-row--minimal"
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setTreeMenu({
                kind: 'folder',
                folderId: f.id,
                x: e.clientX,
                y: e.clientY,
              })
            }}
          >
            <button
              type="button"
              className={`filter-row tree-folder-name tree-folder-row-btn ${
                dropTargetFolderId === f.id ? 'drop-target' : ''
              }`}
              style={{ paddingLeft: `${0.35 + depth * 0.5}rem` }}
              title={
                collapsed ? '单击展开 · 右键菜单' : '单击折叠 · 右键菜单'
              }
              onClick={() => toggleFolderCollapse(f.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', DND_FOLDER + f.id)
                e.dataTransfer.effectAllowed = 'move'
                setDraggingFolderId(f.id)
              }}
              onDragEnd={() => {
                setDraggingFolderId(null)
                setDraggingNoteId(null)
                setDropTargetFolderId(null)
              }}
              onDragOver={(e) => {
                if (draggingNoteId) {
                  const nn = notes.find((x) => x.id === draggingNoteId)
                  if (nn?.folderId === f.id) return
                  e.preventDefault()
                  setDropTargetFolderId(f.id)
                  return
                }
                if (!draggingFolderId || draggingFolderId === f.id) return
                if (isDescendantTarget(f.id, draggingFolderId)) return
                e.preventDefault()
                setDropTargetFolderId(f.id)
              }}
              onDrop={(e) => {
                const raw = e.dataTransfer.getData('text/plain')
                setDropTargetFolderId(null)
                if (raw.startsWith(DND_NOTE)) {
                  const nid = raw.slice(DND_NOTE.length)
                  void moveNoteToFolder(nid, f.id)
                  setDraggingNoteId(null)
                  return
                }
                if (raw.startsWith(DND_FOLDER)) {
                  const dragged = raw.slice(DND_FOLDER.length)
                  if (!dragged || dragged === f.id) return
                  if (isDescendantTarget(f.id, dragged)) return
                  void moveFolder(dragged, f.id)
                }
              }}
            >
              <span className="tree-folder-chevron" aria-hidden>
                {collapsed ? <IconChevronRight /> : <IconChevronDown />}
              </span>
              <span className="tree-folder-label">
                <IconFolder size={15} className="tree-folder-glyph" aria-hidden />
                <span>{f.name}</span>
              </span>
            </button>
          </div>
          {showSubtree && (
            <div className="folder-children">
              {hasChildren && renderFolderTree(f.id, depth + 1)}
              {renderNotesInFolder(f.id, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  if (!token) {
    return (
      <main className="app auth">
        <h1>hNotebook</h1>
        <p className="lede">
          登录或注册。本地开发：先启动 Java API 与 RAG，再运行 Vite；或一条命令{' '}
          <code>docker compose</code> 访问 8080。
        </p>
        <div className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            密码（至少 8 位）
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="auth-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAuth('login')}
            >
              登录
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAuth('register')}
            >
              注册
            </button>
          </div>
          {authError && <p className="err">{authError}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="app workspace">
      {folderDialog && (
        <div
          className="rag-config-overlay"
          role="presentation"
          onClick={() => setFolderDialog(null)}
        >
          <div
            className="rag-config-dialog shell-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shell-folder-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="rag-config-dialog-head">
              <h2 id="shell-folder-dialog-title">
                {folderDialog.mode === 'rename'
                  ? '重命名文件夹'
                  : folderDialog.parentId == null
                    ? '新建根文件夹'
                    : `在「${
                        folders.find((f) => f.id === folderDialog.parentId)
                          ?.name ?? ''
                      }」下新建文件夹`}
              </h2>
            </header>
            <div className="rag-config-dialog-body">
              <label className="shell-dialog-field">
                <span className="shell-dialog-label">名称</span>
                <input
                  ref={folderNameInputRef}
                  className="note-search shell-dialog-name-input"
                  type="text"
                  value={folderNameDraft}
                  onChange={(e) => setFolderNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void submitFolderDialog()
                    }
                  }}
                  placeholder="文件夹名称"
                  autoComplete="off"
                />
              </label>
              <div className="shell-dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFolderDialog(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy || !folderNameDraft.trim()}
                  onClick={() => void submitFolderDialog()}
                >
                  {folderDialog.mode === 'rename' ? '保存' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div
          className="rag-config-overlay"
          role="presentation"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="rag-config-dialog shell-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shell-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="rag-config-dialog-head">
              <h2 id="shell-confirm-title">
                {confirmDialog.kind === 'note' ? '删除笔记' : '删除文件夹'}
              </h2>
            </header>
            <div className="rag-config-dialog-body">
              <p className="shell-dialog-message">
                {confirmDialog.kind === 'note'
                  ? `确定删除「${
                      (notes.find((n) => n.id === confirmDialog.id)?.title || '')
                        .trim() || '(无标题)'
                    }」？此操作不可撤销。`
                  : '确定删除该文件夹？其中的笔记会保留并变为未归类。'}
              </p>
              <div className="shell-dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setConfirmDialog(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => void runConfirmDelete()}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="top">
        <div className="top-title">
          <h1>hNotebook</h1>
          <span className="sync-badges">
            {!sync.isBrowserOnline() && (
              <span className="badge offline">离线</span>
            )}
            {pendingOutbox > 0 && (
              <span className="badge pending">待同步 {pendingOutbox}</span>
            )}
          </span>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            title="切换左侧抽屉（Alt+[）"
            aria-label={leftDrawerOpen ? '收起侧栏' : '展开侧栏'}
            onClick={() => setLeftDrawerOpen((v) => !v)}
          >
            {leftDrawerOpen ? <IconSidebarOpen /> : <IconSidebarClosed />}
          </button>
          <div className="theme-preset-wrap" ref={themePresetWrapRef}>
            <button
              type="button"
              className="icon-btn"
              title="主题外观"
              aria-label="主题外观"
              aria-expanded={themePresetOpen}
              aria-haspopup="listbox"
              onClick={() => setThemePresetOpen((v) => !v)}
            >
              <IconPalette />
            </button>
            {themePresetOpen && (
              <div
                className="theme-preset-menu"
                role="listbox"
                aria-label="选择主题"
              >
                {THEME_PRESET_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={themePreset === id}
                    className={
                      themePreset === id ? 'theme-preset-option active' : 'theme-preset-option'
                    }
                    onClick={() => applyThemePreset(id)}
                  >
                    <span>{THEME_PRESET_LABELS[id]}</span>
                    {themePreset === id ? (
                      <IconCheck className="theme-preset-check" size={16} />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="top-sync-kb top-sync-kb--icon-only"
            disabled={ragBusy || notes.length === 0}
            title={
              ragBulkProgress
                ? `同步知识库：${ragBulkProgress.done}/${ragBulkProgress.total}…`
                : ragChunks != null
                  ? `同步知识库 — 当前约 ${ragChunks} 个向量块；已入库 ${ragIngestSources.length} 篇。点击将侧栏已加载笔记重新写入索引（embedding）。`
                  : '同步知识库：将侧栏已加载的全部笔记写入向量索引（调用 embedding）'
            }
            aria-label={
              ragBulkProgress
                ? `同步知识库进度 ${ragBulkProgress.done}/${ragBulkProgress.total}`
                : '同步知识库'
            }
            onClick={() => void syncKnowledgeBase()}
          >
            <IconRefresh className="top-sync-kb-icon" size={19} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="知识库配置（模型与 API）"
            aria-label="知识库配置"
            onClick={() => {
              setRagConfigOpen(true)
              void loadRagConfig()
            }}
          >
            <IconDatabase size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="退出登录"
            aria-label="退出登录"
            onClick={logout}
          >
            <IconLogOut />
          </button>
        </div>
      </header>

      <div
        className={`layout ${leftDrawerOpen ? '' : 'left-collapsed'}`}
        style={{ gridTemplateColumns: layoutGridColumns }}
      >
        <aside className={`sidebar drawer left ${leftDrawerOpen ? 'open' : 'closed'}`}>
          <section className="side-block tree-explorer-block">
            <div className="side-head">
              <span>笔记库</span>
              <button
                type="button"
                className="linkish linkish-with-icon"
                onClick={() => void newFolder(null)}
              >
                <IconPlus size={14} />
                <span>根文件夹</span>
              </button>
            </div>
            <input
              className="note-search"
              type="search"
              value={noteQuery}
              onChange={(e) => setNoteQuery(e.target.value)}
              placeholder="搜索笔记标题或正文…"
            />
            {listError && <p className="err small">{listError}</p>}
            {lwwHint && <p className="hint small lww-banner">{lwwHint}</p>}
            {noteQuery.trim() ? (
              <div className="folder-tree note-search-tree">
                <p className="tree-search-caption">匹配的笔记</p>
                {displayedNotes.length === 0 ? (
                  <p className="note-empty">没有匹配的笔记</p>
                ) : (
                  displayedNotes.map((n) => renderNoteRow(n, 0))
                )}
              </div>
            ) : (
              <div className="folder-tree explorer-tree">
                {renderNotesInFolder(null, 0)}
                {renderFolderTree(null)}
              </div>
            )}
            {treeMenu?.kind === 'folder' && (
              <div
                className="folder-menu"
                style={{ left: treeMenu.x, top: treeMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    const id = treeMenu.folderId
                    setTreeMenu(null)
                    void handleNewNote(id)
                  }}
                >
                  新建笔记
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = treeMenu.folderId
                    setTreeMenu(null)
                    void newFolder(id)
                  }}
                >
                  新建子文件夹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = treeMenu.folderId
                    setTreeMenu(null)
                    void renameFolder(id)
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const id = treeMenu.folderId
                    setTreeMenu(null)
                    void removeFolder(id)
                  }}
                >
                  删除
                </button>
              </div>
            )}
            {treeMenu?.kind === 'note' && (
              <div
                className="folder-menu"
                style={{ left: treeMenu.x, top: treeMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    const nid = treeMenu.noteId
                    setTreeMenu(null)
                    const n = notes.find((x) => x.id === nid)
                    if (n) startNoteRename(n)
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const nid = treeMenu.noteId
                    setTreeMenu(null)
                    void deleteNoteById(nid)
                  }}
                >
                  删除
                </button>
              </div>
            )}
          </section>
        </aside>

        {!narrowLayout && leftDrawerOpen && (
          <button
            type="button"
            className="layout-splitter"
            aria-label="拖动调节目录与编辑区宽度"
            onMouseDown={onLayoutSplitterDown}
          />
        )}

        <section className="editor drawer center">
          <div className="editor-body editor-body--content-only">
            {selectedId ? (
              <>
                <div className="editor-meta-row">
                  <div className="editor-meta-actions">
                    {selectedNote && (
                      <span
                        className="editor-updated-readonly"
                        title="当前笔记最近保存/同步时间"
                      >
                        更新 {formatEditorUpdatedAt(selectedNote.updatedAt)}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`icon-btn md-preview-toggle${mdPreviewOpen ? ' md-preview-toggle--on' : ''}`}
                      title={
                        mdPreviewOpen
                          ? '关闭 Markdown 预览'
                          : '打开 Markdown 预览（可拖动分隔条调宽度）'
                      }
                      aria-pressed={mdPreviewOpen}
                      aria-label="Markdown 预览"
                      onClick={toggleMdPreview}
                    >
                      <IconColumns active={mdPreviewOpen} size={18} />
                    </button>
                  </div>
                </div>
                {narrowLayout && mdPreviewOpen ? (
                  <>
                    <textarea
                      className="body-input body-input--solo"
                      value={body}
                      onChange={(e) => {
                        autosaveOk.current = true
                        setBody(e.target.value)
                      }}
                      placeholder="Markdown 正文（标题、文件夹与保存请在左侧目录树中操作）"
                      spellCheck={false}
                    />
                    <div
                      className="md-preview-drawer-backdrop"
                      role="presentation"
                      onClick={() => {
                        setMdPreviewOpen(false)
                        if (typeof window !== 'undefined') {
                          localStorage.setItem(MD_PREVIEW_OPEN_KEY, '0')
                        }
                      }}
                    >
                      <aside
                        className="md-preview-drawer-panel"
                        role="complementary"
                        aria-label="Markdown 预览"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <header className="md-preview-drawer-head">
                          <span>Markdown 预览</span>
                          <button
                            type="button"
                            className="secondary icon-text-btn"
                            onClick={() => {
                              setMdPreviewOpen(false)
                              if (typeof window !== 'undefined') {
                                localStorage.setItem(MD_PREVIEW_OPEN_KEY, '0')
                              }
                            }}
                          >
                            <IconX size={16} />
                            <span>关闭</span>
                          </button>
                        </header>
                        <div className="md-preview-pane md-preview-pane--drawer">
                          {markdownPreviewDoc}
                        </div>
                      </aside>
                    </div>
                  </>
                ) : mdPreviewOpen ? (
                  <div
                    className="editor-split"
                    style={{
                      gridTemplateColumns: `minmax(0,1fr) ${SPLITTER_W}px ${previewPaneWidth}px`,
                    }}
                  >
                    <textarea
                      className="body-input body-input--split"
                      value={body}
                      onChange={(e) => {
                        autosaveOk.current = true
                        setBody(e.target.value)
                      }}
                      placeholder="Markdown 正文（标题、文件夹与保存请在左侧目录树中操作）"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="layout-splitter editor-preview-splitter"
                      aria-label="拖动调节编辑区与预览区宽度"
                      onMouseDown={onPreviewSplitterDown}
                    />
                    <div className="md-preview-pane">{markdownPreviewDoc}</div>
                  </div>
                ) : (
                  <textarea
                    className="body-input body-input--solo"
                    value={body}
                    onChange={(e) => {
                      autosaveOk.current = true
                      setBody(e.target.value)
                    }}
                    placeholder="Markdown 正文（标题、文件夹与保存请在左侧目录树中操作）"
                    spellCheck={false}
                  />
                )}
                {saveHint && <p className="hint editor-save-hint">{saveHint}</p>}
              </>
            ) : (
              <p className="empty">在左侧目录中选择笔记以编辑正文。</p>
            )}
          </div>
        </section>
      </div>
      {createPortal(
        <>
          <button
            ref={chatFabRef}
            type="button"
            className="chat-fab"
        style={
          chatFabPos.x >= 0 && chatFabPos.y >= 0
            ? { left: `${chatFabPos.x}px`, top: `${chatFabPos.y}px`, right: 'auto', bottom: 'auto' }
            : undefined
        }
        onMouseDown={(e) => {
          const btn = e.currentTarget.getBoundingClientRect()
          chatFabDraggingRef.current = true
          chatFabMovedRef.current = false
          chatFabOffsetRef.current = { dx: e.clientX - btn.left, dy: e.clientY - btn.top }
          const onMove = (ev: MouseEvent) => {
            if (!chatFabDraggingRef.current) return
            chatFabMovedRef.current = true
            const x = Math.min(
              window.innerWidth - btn.width,
              Math.max(0, ev.clientX - chatFabOffsetRef.current.dx),
            )
            const y = Math.min(
              window.innerHeight - btn.height,
              Math.max(0, ev.clientY - chatFabOffsetRef.current.dy),
            )
            setChatFabPos(clampChatFabPos(x, y))
          }
          const onUp = () => {
            chatFabDraggingRef.current = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
        onClick={() => {
          if (chatFabMovedRef.current) {
            chatFabMovedRef.current = false
            return
          }
          setChatOpen(true)
        }}
            title="打开知识库聊天"
            aria-label="打开知识库聊天"
          >
            <IconRobot size={22} />
          </button>
          {ragConfigOpen && (
            <div
              className="rag-config-overlay"
              role="presentation"
              onClick={() => setRagConfigOpen(false)}
            >
              <div
                className="rag-config-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rag-config-dialog-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="rag-config-dialog-head">
                  <h2 id="rag-config-dialog-title">知识库配置</h2>
                  <button
                    type="button"
                    className="secondary icon-text-btn"
                    onClick={() => setRagConfigOpen(false)}
                  >
                    <IconX size={16} />
                    <span>关闭</span>
                  </button>
                </header>
                <div className="rag-config-dialog-body">
                  <p className="rag-config-lede">
                    绑定当前账号；留空 API Key 时使用服务端演示模式。
                  </p>
                  <div className="rag-config">
                    <label>
                      Base URL
                      <input
                        value={ragBaseUrl}
                        onChange={(e) => setRagBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                      />
                    </label>
                    <label>
                      API Key
                      <div className="api-key-line">
                        <input
                          type={ragApiKeyVisible ? 'text' : 'password'}
                          value={ragApiKey}
                          onChange={(e) => setRagApiKey(e.target.value)}
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setRagApiKeyVisible((v) => !v)}
                        >
                          {ragApiKeyVisible ? '隐藏' : '显示'}
                        </button>
                      </div>
                    </label>
                    <label>
                      Embedding Model
                      <input
                        value={ragEmbeddingModel}
                        onChange={(e) => setRagEmbeddingModel(e.target.value)}
                        placeholder="text-embedding-3-small"
                      />
                    </label>
                    <label>
                      Chat Model
                      <input
                        value={ragChatModel}
                        onChange={(e) => setRagChatModel(e.target.value)}
                        placeholder="gpt-4o-mini"
                      />
                    </label>
                    <div className="rag-config-actions">
                      <button
                        type="button"
                        disabled={ragConfigBusy}
                        onClick={() => void saveRagConfig()}
                      >
                        保存模型配置
                      </button>
                      {ragConfigHint && <span className="hint">{ragConfigHint}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {chatOpen && (
        <div className="chat-overlay" onClick={() => setChatOpen(false)}>
          <section
            className="chat-panel"
            style={{ left: chatPanelPos.x, top: chatPanelPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="chat-panel-head">
              <div
                className="chat-panel-head-main"
                onMouseDown={onChatPanelDragStart}
              >
                <strong className="chat-panel-title">
                  <IconRobot size={18} className="chat-panel-title-icon" />
                  知识库聊天
                </strong>
              </div>
              <button
                type="button"
                className="secondary icon-text-btn"
                onClick={() => setChatOpen(false)}
              >
                <IconX size={16} />
                <span>关闭</span>
              </button>
            </header>
            <div className="chat-panel-body">
              <aside className="chat-sessions" aria-label="历史会话">
                <div className="chat-sessions-toolbar">
                  <button
                    type="button"
                    className="secondary icon-text-btn chat-toolbar-new"
                    disabled={ragSessionsBusy || ragBusy}
                    onClick={() => void newRagSession()}
                  >
                    <IconPlus size={16} />
                    <span>新对话</span>
                  </button>
                </div>
                <ul className="chat-session-list">
                  {ragSessionsBusy && ragSessions.length === 0 && (
                    <li className="chat-session-placeholder">加载会话…</li>
                  )}
                  {ragSessions.map((s) => (
                    <li key={s.id}>
                      <div
                        className={`chat-session-row ${s.id === activeRagSessionId ? 'active' : ''}`}
                        onClick={() => void selectRagSession(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            void selectRagSession(s.id)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {renamingSessionId === s.id ? (
                          <input
                            className="chat-session-rename-input"
                            value={renameTitleDraft}
                            onCompositionStart={() => {
                              sessionTitleComposingRef.current = true
                            }}
                            onCompositionEnd={(e) => {
                              sessionTitleComposingRef.current = false
                              setRenameTitleDraft(e.currentTarget.value)
                            }}
                            onChange={(e) => {
                              if (sessionTitleComposingRef.current) return
                              setRenameTitleDraft(e.target.value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                !(e.nativeEvent as KeyboardEvent).isComposing
                              ) {
                                e.preventDefault()
                                void commitRenameSession()
                              }
                              if (e.key === 'Escape') setRenamingSessionId(null)
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="chat-session-title" title={s.title}>
                            {s.title}
                          </span>
                        )}
                        <div className="chat-session-meta">
                          <span className="chat-session-count">{s.message_count}</span>
                          {renamingSessionId !== s.id && (
                            <>
                              <button
                                type="button"
                                className="chat-session-icon"
                                title="重命名"
                                aria-label="重命名会话"
                                onClick={(e) => startRenameSession(s, e)}
                              >
                                <IconPencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="chat-session-icon danger"
                                title="删除"
                                aria-label="删除会话"
                                onClick={(e) => void deleteRagSession(s.id, e)}
                              >
                                <IconTrash size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {renamingSessionId === s.id && (
                        <div className="chat-session-rename-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              void commitRenameSession()
                            }}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenamingSessionId(null)
                            }}
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </aside>
              <div className="chat-main">
                <div className="rag-thread" ref={chatThreadRef}>
                  {ragMessages.length === 0 && (
                    <p className="rag-empty">
                      {ragSessionsBusy
                        ? '加载中…'
                        : '还没有消息。请先在顶部「同步知识库」写入索引，再在此提问。'}
                    </p>
                  )}
                  {ragMessages.map((m) => (
                    <div key={m.id} className={`rag-msg ${m.role}`}>
                      <span className="rag-msg-role">
                        {m.role === 'user' ? (
                          <IconUser size={14} className="rag-msg-role-icon" />
                        ) : m.role === 'assistant' ? (
                          <IconRobot size={14} className="rag-msg-role-icon" />
                        ) : (
                          <IconInfo size={14} className="rag-msg-role-icon" />
                        )}
                        <span className="rag-msg-role-text">
                          {m.role === 'user'
                            ? '你'
                            : m.role === 'assistant'
                              ? '知识库'
                              : '系统'}
                        </span>
                      </span>
                      <pre className="rag-reply">
                        {m.content || (m.role === 'assistant' ? '...' : '')}
                      </pre>
                    </div>
                  ))}
                </div>
                <div className="rag-chat">
                  <textarea
                    value={ragQ}
                    onChange={(e) => setRagQ(e.target.value)}
                    placeholder="向知识库提问…"
                    rows={3}
                    disabled={!activeRagSessionId || ragSessionsBusy}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !(e.nativeEvent as KeyboardEvent).isComposing
                      ) {
                        e.preventDefault()
                        if (!ragBusy) void sendRag()
                      }
                    }}
                  />
                  <div className="rag-chat-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        ragBusy ||
                        !activeRagSessionId ||
                        ragMessages.length === 0 ||
                        ragSessionsBusy
                      }
                      onClick={() => void clearRagChatMessages()}
                    >
                      清空当前对话
                    </button>
                    <button
                      type="button"
                      className="rag-send-btn"
                      disabled={ragBusy || !activeRagSessionId || ragSessionsBusy}
                      onClick={() => void sendRag()}
                    >
                      {ragBusy ? (
                        '生成中…'
                      ) : (
                        <>
                          <IconSend size={17} />
                          <span>发送</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
          )}
        </>,
        document.body,
      )}
    </main>
  )
}

export default App
