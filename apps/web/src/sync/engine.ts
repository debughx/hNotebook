import * as api from '../api/client'
import type { FolderDto, NoteDto } from '../api/types'
import {
  db,
  type LocalFolderRecord,
  type LocalNoteRecord,
  type OutboxPayload,
} from '../db/hnotebookDb'
import { getJwtSub } from '../lib/jwt'
import {
  fromServerNoteDto,
  shouldApplyServerOverLocal,
  toNoteDto,
} from './noteAdapter'

export function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

export type PullRemoteResult = {
  notesOverwrittenByServer: number
}

function toFolderDto(f: LocalFolderRecord): FolderDto {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    createdAt: f.createdAt,
  }
}

export async function ensureScopedUser(token: string | null): Promise<void> {
  if (!token) return
  const sub = getJwtSub(token)
  if (!sub) return
  const prev = await db.meta.get('userSub')
  if (prev && prev.value !== sub) {
    await db.transaction(
      'rw',
      [db.notes, db.folders, db.outbox, db.meta],
      async () => {
        await db.notes.clear()
        await db.folders.clear()
        await db.outbox.clear()
        await db.meta.put({ key: 'userSub', value: sub })
      },
    )
  } else if (!prev) {
    await db.meta.put({ key: 'userSub', value: sub })
  }
}

async function folderIdsPendingDeleteInOutbox(): Promise<Set<string>> {
  const s = new Set<string>()
  for (const row of await db.outbox.toArray()) {
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    if (p.kind === 'DELETE_FOLDER') s.add(p.folderId)
  }
  return s
}

async function mergeFoldersFromServer(server: FolderDto[]): Promise<void> {
  const skipServerIds = await folderIdsPendingDeleteInOutbox()
  const pendingCreates = await db.folders
    .filter((f) => f.pendingCreate === true)
    .toArray()
  const pendingDeleteRows = await db.folders
    .filter((f) => f.pendingDelete === true)
    .toArray()
  const preserve = new Set([
    ...pendingCreates.map((f) => f.id),
    ...pendingDeleteRows.map((f) => f.id),
  ])

  await db.transaction('rw', db.folders, async () => {
    const all = await db.folders.toArray()
    for (const row of all) {
      if (preserve.has(row.id)) continue
      await db.folders.delete(row.id)
    }
    for (const sf of server) {
      if (skipServerIds.has(sf.id)) continue
      await db.folders.put({
        ...sf,
        pendingCreate: false,
        pendingDelete: false,
      })
    }
    for (const pc of pendingCreates) {
      await db.folders.put(pc)
    }
    for (const pd of pendingDeleteRows) {
      await db.folders.put(pd)
    }
  })
}

export async function getFilteredNotes(
  folderFilterId: string | null,
): Promise<NoteDto[]> {
  const all = await db.notes.filter((n) => !n.deleted).toArray()
  let dtos = all.map(toNoteDto)
  if (folderFilterId) {
    dtos = dtos.filter((n) => n.folderId === folderFilterId)
  }
  return dtos.sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )
}

async function rewriteOutboxNoteId(oldId: string, newId: string): Promise<void> {
  const rows = await db.outbox.toArray()
  for (const row of rows) {
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    let next: OutboxPayload | null = p
    if (p.kind === 'PATCH_NOTE' && p.noteId === oldId) {
      next = { ...p, noteId: newId }
    } else if (p.kind === 'DELETE_NOTE' && p.noteId === oldId) {
      next = { ...p, noteId: newId }
    }
    if (next !== p) {
      await db.outbox.update(row.id, { payload: JSON.stringify(next) })
    }
  }
}

export async function rewriteOutboxFolderId(
  oldId: string,
  newId: string,
): Promise<void> {
  const rows = await db.outbox.toArray()
  for (const row of rows) {
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    let next: OutboxPayload | null = p
    if (p.kind === 'CREATE_NOTE' && p.folderId === oldId) {
      next = { ...p, folderId: newId }
    } else if (p.kind === 'CREATE_FOLDER' && p.parentId === oldId) {
      next = { ...p, parentId: newId }
    } else if (p.kind === 'PATCH_NOTE' && p.patch.folderId === oldId) {
      next = {
        ...p,
        patch: { ...p.patch, folderId: newId },
      }
    } else if (p.kind === 'UPDATE_FOLDER') {
      if (p.folderId === oldId) {
        next = { ...p, folderId: newId }
      } else if (p.patch.parentId === oldId) {
        next = {
          ...p,
          patch: { ...p.patch, parentId: newId },
        }
      }
    }
    if (next !== p) {
      await db.outbox.update(row.id, { payload: JSON.stringify(next) })
    }
  }
}

async function rewriteNotesFolderId(oldId: string, newId: string): Promise<void> {
  const notes = await db.notes.filter((n) => n.folderId === oldId).toArray()
  for (const n of notes) {
    await db.notes.update(n.id, { folderId: newId })
  }
}

export async function mergeOrAppendPatch(
  noteId: string,
  patch: NonNullable<
    Extract<OutboxPayload, { kind: 'PATCH_NOTE' }>['patch']
  >,
): Promise<void> {
  const all = await db.outbox.orderBy('id').toArray()
  for (let i = all.length - 1; i >= 0; i--) {
    const row = all[i]
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    if (p.kind === 'PATCH_NOTE' && p.noteId === noteId) {
      const merged = { ...p.patch, ...patch }
      await db.outbox.update(row.id, {
        payload: JSON.stringify({
          kind: 'PATCH_NOTE',
          noteId,
          patch: merged,
        } satisfies OutboxPayload),
      })
      return
    }
  }
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'PATCH_NOTE',
      noteId,
      patch,
    } satisfies OutboxPayload),
  })
}

async function mergeOrAppendUpdateFolder(
  folderId: string,
  patch: Extract<OutboxPayload, { kind: 'UPDATE_FOLDER' }>['patch'],
): Promise<void> {
  const all = await db.outbox.orderBy('id').toArray()
  for (let i = all.length - 1; i >= 0; i--) {
    const row = all[i]
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    if (p.kind === 'UPDATE_FOLDER' && p.folderId === folderId) {
      const merged = { ...p.patch, ...patch }
      await db.outbox.update(row.id, {
        payload: JSON.stringify({
          kind: 'UPDATE_FOLDER',
          folderId,
          patch: merged,
        } satisfies OutboxPayload),
      })
      return
    }
  }
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'UPDATE_FOLDER',
      folderId,
      patch,
    } satisfies OutboxPayload),
  })
}

async function unassignNotesFromFolder(folderId: string): Promise<void> {
  const notes = await db.notes
    .filter((n) => n.folderId === folderId && !n.deleted)
    .toArray()
  const now = Date.now()
  const iso = new Date(now).toISOString()
  for (const n of notes) {
    await db.notes.update(n.id, {
      folderId: null,
      dirty: true,
      updatedAtLocal: now,
      updatedAt: iso,
    })
    await mergeOrAppendPatch(n.id, { clearFolder: true })
  }
}

export async function createFolderLocal(
  name: string,
  parentId: string | null,
): Promise<string> {
  const id = `local-fold-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const rec: LocalFolderRecord = {
    id,
    name: name.trim(),
    parentId,
    createdAt: now,
    pendingCreate: true,
  }
  await db.folders.put(rec)
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'CREATE_FOLDER',
      localId: id,
      name: rec.name,
      parentId,
    } satisfies OutboxPayload),
  })
  return id
}

export async function deleteFolderLocal(folderId: string): Promise<void> {
  const rows = await db.outbox.toArray()
  for (const row of rows) {
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    if (p.kind === 'CREATE_FOLDER' && p.localId === folderId) {
      await db.outbox.delete(row.id)
    }
  }

  const f = await db.folders.get(folderId)
  if (!f) return

  await unassignNotesFromFolder(folderId)

  if (f.pendingCreate) {
    await db.folders.delete(folderId)
    return
  }

  await db.folders.update(folderId, { pendingDelete: true })
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'DELETE_FOLDER',
      folderId,
    } satisfies OutboxPayload),
  })
}

export async function updateFolderLocal(
  folderId: string,
  patch: { name?: string; parentId?: string | null; clearParent?: boolean },
): Promise<void> {
  const folder = await db.folders.get(folderId)
  if (!folder) return

  const patchName = patch.name?.trim()
  const nextName = patchName && patchName.length > 0 ? patchName : folder.name
  const nextParent =
    patch.clearParent === true
      ? null
      : patch.parentId !== undefined
        ? patch.parentId
        : folder.parentId

  await db.folders.update(folderId, {
    name: nextName,
    parentId: nextParent,
  })

  if (folder.pendingCreate) {
    const rows = await db.outbox.toArray()
    for (const row of rows) {
      if (row.id == null) continue
      const p = JSON.parse(row.payload) as OutboxPayload
      if (p.kind === 'CREATE_FOLDER' && p.localId === folderId) {
        await db.outbox.update(row.id, {
          payload: JSON.stringify({
            ...p,
            name: nextName,
            parentId: nextParent,
          } satisfies OutboxPayload),
        })
      }
    }
    return
  }

  const outPatch: Extract<OutboxPayload, { kind: 'UPDATE_FOLDER' }>['patch'] = {}
  if (patch.name !== undefined) outPatch.name = nextName
  if (patch.clearParent) outPatch.clearParent = true
  if (patch.parentId !== undefined) outPatch.parentId = patch.parentId
  if (!outPatch.clearParent && patch.parentId === null) {
    outPatch.clearParent = true
  }
  await mergeOrAppendUpdateFolder(folderId, outPatch)
}

export async function saveNoteContentLocal(
  noteId: string,
  title: string,
  body: string,
): Promise<void> {
  const now = Date.now()
  await db.notes.update(noteId, {
    title,
    body,
    dirty: true,
    updatedAtLocal: now,
    updatedAt: new Date(now).toISOString(),
  })
  await mergeOrAppendPatch(noteId, { title, body })
}

export async function saveNoteFolderLocal(
  noteId: string,
  folderId: string | null,
  clearFolder: boolean,
): Promise<void> {
  const now = Date.now()
  await db.notes.update(noteId, {
    folderId: clearFolder ? null : folderId,
    dirty: true,
    updatedAtLocal: now,
    updatedAt: new Date(now).toISOString(),
  })
  if (clearFolder) {
    await mergeOrAppendPatch(noteId, { clearFolder: true })
  } else if (folderId) {
    await mergeOrAppendPatch(noteId, { folderId })
  }
}

export async function createNoteLocal(folderId: string | null): Promise<string> {
  const id = `local-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const t = Date.now()
  const rec: LocalNoteRecord = {
    id,
    title: '',
    body: '',
    folderId,
    tagsJson: '[]',
    createdAt: now,
    updatedAt: now,
    updatedAtLocal: t,
    dirty: true,
    deleted: false,
    pendingCreate: true,
  }
  await db.notes.put(rec)
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'CREATE_NOTE',
      localId: id,
      folderId,
    } satisfies OutboxPayload),
  })
  return id
}

export async function deleteNoteLocal(noteId: string): Promise<void> {
  const rows = await db.outbox.toArray()
  for (const row of rows) {
    if (row.id == null) continue
    const p = JSON.parse(row.payload) as OutboxPayload
    const hit =
      (p.kind === 'PATCH_NOTE' && p.noteId === noteId) ||
      (p.kind === 'CREATE_NOTE' && p.localId === noteId) ||
      (p.kind === 'DELETE_NOTE' && p.noteId === noteId)
    if (hit) await db.outbox.delete(row.id)
  }

  await db.notes.update(noteId, {
    deleted: true,
    dirty: true,
    updatedAtLocal: Date.now(),
  })
  await db.outbox.add({
    payload: JSON.stringify({
      kind: 'DELETE_NOTE',
      noteId,
    } satisfies OutboxPayload),
  })
}

export async function pullRemoteToLocal(): Promise<PullRemoteResult> {
  let notesOverwrittenByServer = 0
  const [serverFolders, serverNotes] = await Promise.all([
    api.fetchFolders(),
    api.fetchNotes(),
  ])

  await mergeFoldersFromServer(serverFolders)

  await db.transaction('rw', db.notes, async () => {
    const serverIds = new Set(serverNotes.map((n) => n.id))

    for (const sn of serverNotes) {
      const local = await db.notes.get(sn.id)
      const apply = shouldApplyServerOverLocal(local, sn)
      if (apply && local?.dirty && !local.pendingCreate) {
        notesOverwrittenByServer += 1
      }
      if (apply) {
        await db.notes.put(fromServerNoteDto(sn))
      }
    }

    const locals = await db.notes.filter((n) => !n.deleted).toArray()
    for (const local of locals) {
      if (local.pendingCreate || local.dirty) continue
      if (!serverIds.has(local.id)) {
        await db.notes.delete(local.id)
      }
    }
  })

  return { notesOverwrittenByServer }
}

async function shouldDeferCreateNote(
  payload: Extract<OutboxPayload, { kind: 'CREATE_NOTE' }>,
): Promise<boolean> {
  if (payload.folderId) {
    const fo = await db.folders.get(payload.folderId)
    if (fo?.pendingCreate) return true
  }
  return false
}

async function shouldDeferUpdateFolder(
  payload: Extract<OutboxPayload, { kind: 'UPDATE_FOLDER' }>,
): Promise<boolean> {
  const targetParent =
    payload.patch.clearParent === true ? null : payload.patch.parentId
  if (!targetParent) return false
  const fo = await db.folders.get(targetParent)
  return fo?.pendingCreate === true
}

async function purgeLegacyTagOutbox(): Promise<void> {
  const rows = await db.outbox.toArray()
  for (const row of rows) {
    if (row.id == null) continue
    let kind: string | undefined
    try {
      kind = (JSON.parse(row.payload) as { kind?: string }).kind
    } catch {
      continue
    }
    if (kind === 'SET_TAGS' || kind === 'CREATE_TAG' || kind === 'DELETE_TAG') {
      await db.outbox.delete(row.id)
    }
  }
}

export async function flushOutbox(
  watchSelectedId?: string | null,
): Promise<string | null> {
  let remappedSelected: string | null = null
  if (!isBrowserOnline() || !api.getToken()) return remappedSelected

  await purgeLegacyTagOutbox()

  while (true) {
    const row = await db.outbox.orderBy('id').first()
    if (!row?.id) break

    const payload = JSON.parse(row.payload) as OutboxPayload

    try {
      if (payload.kind === 'CREATE_FOLDER') {
        const created = await api.createFolder(payload.name, payload.parentId)
        await db.transaction(
          'rw',
          [db.folders, db.notes, db.outbox],
          async () => {
            await db.folders.delete(payload.localId)
            await db.folders.put({ ...created, pendingCreate: false })
            await rewriteOutboxFolderId(payload.localId, created.id)
            await rewriteNotesFolderId(payload.localId, created.id)
            await db.outbox.delete(row.id)
          },
        )
        continue
      }

      if (payload.kind === 'UPDATE_FOLDER') {
        if (payload.folderId.startsWith('local-fold-')) {
          await db.outbox.delete(row.id)
          continue
        }
        if (await shouldDeferUpdateFolder(payload)) {
          break
        }
        const updated = await api.patchFolder(payload.folderId, payload.patch)
        await db.folders.put({ ...updated, pendingCreate: false, pendingDelete: false })
        await db.outbox.delete(row.id)
        continue
      }

      if (payload.kind === 'DELETE_FOLDER') {
        if (payload.folderId.startsWith('local-fold-')) {
          await db.folders.delete(payload.folderId)
          await db.outbox.delete(row.id)
          continue
        }
        await api.deleteFolder(payload.folderId)
        await db.folders.delete(payload.folderId)
        await db.outbox.delete(row.id)
        continue
      }

      if (payload.kind === 'CREATE_NOTE') {
        if (await shouldDeferCreateNote(payload)) {
          break
        }
        const local = await db.notes.get(payload.localId)
        if (!local) {
          await db.outbox.delete(row.id)
          continue
        }
        const created = await api.createNote({
          folderId: payload.folderId,
        })
        let dto = created
        if (local.title.trim() !== '' || local.body.trim() !== '') {
          dto = await api.patchNote(created.id, {
            title: local.title,
            body: local.body,
          })
        }
        if (watchSelectedId && payload.localId === watchSelectedId) {
          remappedSelected = dto.id
        }
        await db.transaction('rw', db.notes, db.outbox, async () => {
          await db.notes.delete(payload.localId)
          await db.notes.put(fromServerNoteDto(dto))
          await rewriteOutboxNoteId(payload.localId, dto.id)
          await db.outbox.delete(row.id)
        })
        continue
      }

      if (payload.kind === 'PATCH_NOTE') {
        if (payload.noteId.startsWith('local-')) {
          await db.outbox.delete(row.id)
          continue
        }
        const updated = await api.patchNote(payload.noteId, payload.patch)
        await db.notes.put(fromServerNoteDto(updated))
        await db.outbox.delete(row.id)
        continue
      }

      if (payload.kind === 'DELETE_NOTE') {
        if (payload.noteId.startsWith('local-')) {
          await db.notes.delete(payload.noteId)
          await db.outbox.delete(row.id)
          continue
        }
        await api.deleteNote(payload.noteId)
        await db.notes.delete(payload.noteId)
        await db.outbox.delete(row.id)
        continue
      }
    } catch {
      break
    }
  }
  return remappedSelected
}

export type SyncAllResult = {
  ok: boolean
  message?: string
  notesOverwrittenByServer?: number
}

export async function syncAll(): Promise<SyncAllResult> {
  if (!api.getToken()) return { ok: true }
  if (!isBrowserOnline()) {
    return { ok: false, message: '当前离线，已仅使用本地数据' }
  }
  try {
    await flushOutbox(null)
    const pull = await pullRemoteToLocal()
    await flushOutbox(null)
    return { ok: true, notesOverwrittenByServer: pull.notesOverwrittenByServer }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '同步失败',
    }
  }
}

/** @deprecated Prefer syncAll / pullRemoteToLocal merge */
export async function refreshFoldersFromRemote(): Promise<void> {
  if (!isBrowserOnline() || !api.getToken()) return
  const fd = await api.fetchFolders()
  await mergeFoldersFromServer(fd)
}

export async function loadCachedFolders(): Promise<{ folders: FolderDto[] }> {
  const folders = (await db.folders.toArray())
    .filter((f) => !f.pendingDelete)
    .map(toFolderDto)
  return { folders }
}

export async function getOutboxCount(): Promise<number> {
  return db.outbox.count()
}
