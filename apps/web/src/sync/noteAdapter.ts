import type { NoteDto } from '../api/types'
import type { LocalNoteRecord } from '../db/hnotebookDb'

/** API may still return `tags`; we ignore them in the client. */
type NoteFromApi = NoteDto & { tags?: unknown }

export function toNoteDto(r: LocalNoteRecord): NoteDto {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    folderId: r.folderId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export function fromServerNoteDto(
  n: NoteFromApi,
  extra?: Partial<Pick<LocalNoteRecord, 'dirty' | 'pendingCreate' | 'updatedAtLocal' | 'deleted'>>,
): LocalNoteRecord {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    folderId: n.folderId,
    tagsJson: '[]',
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    updatedAtLocal:
      extra?.updatedAtLocal ??
      (Number.isNaN(Date.parse(n.updatedAt))
        ? Date.now()
        : Date.parse(n.updatedAt)),
    dirty: extra?.dirty ?? false,
    deleted: extra?.deleted ?? false,
    pendingCreate: extra?.pendingCreate ?? false,
  }
}

/** LWW: if server.updatedAt is newer than last local edit, server wins. */
export function shouldApplyServerOverLocal(
  local: LocalNoteRecord | undefined,
  server: NoteFromApi,
): boolean {
  if (!local || local.deleted) return true
  if (!local.dirty && !local.pendingCreate) return true
  const serverTs = Date.parse(server.updatedAt)
  if (Number.isNaN(serverTs)) return false
  return serverTs > local.updatedAtLocal
}
