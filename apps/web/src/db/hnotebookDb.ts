import Dexie, { type EntityTable } from 'dexie'

import type { FolderDto } from '../api/types'

export type LocalNoteRecord = {
  id: string
  title: string
  body: string
  folderId: string | null
  tagsJson: string
  createdAt: string
  /** Last server `updatedAt` we accepted (ISO). */
  updatedAt: string
  /** Last local edit time (ms since epoch) for LWW vs server.updatedAt. */
  updatedAtLocal: number
  dirty: boolean
  deleted: boolean
  /** True until first successful POST /notes. */
  pendingCreate: boolean
}

export type LocalFolderRecord = FolderDto & {
  pendingCreate?: boolean
  /** Awaiting DELETE sync; hidden in UI. */
  pendingDelete?: boolean
}

export type OutboxPayload =
  | { kind: 'CREATE_NOTE'; localId: string; folderId: string | null; tagIds?: string[] }
  | {
      kind: 'PATCH_NOTE'
      noteId: string
      patch: {
        title?: string
        body?: string
        folderId?: string | null
        clearFolder?: boolean
      }
    }
  | { kind: 'DELETE_NOTE'; noteId: string }
  | { kind: 'CREATE_FOLDER'; localId: string; name: string; parentId: string | null }
  | {
      kind: 'UPDATE_FOLDER'
      folderId: string
      patch: { name?: string; parentId?: string | null; clearParent?: boolean }
    }
  | { kind: 'DELETE_FOLDER'; folderId: string }

export type OutboxRow = {
  id?: number
  payload: string
}

export class HNotebookDB extends Dexie {
  notes!: EntityTable<LocalNoteRecord, 'id'>
  folders!: EntityTable<LocalFolderRecord, 'id'>
  outbox!: EntityTable<OutboxRow, 'id'>
  meta!: EntityTable<{ key: string; value: string }, 'key'>

  constructor() {
    super('hnotebook')
    this.version(1).stores({
      notes: 'id, deleted, dirty, pendingCreate',
      folders: 'id',
      tags: 'id',
      outbox: '++id',
      meta: 'key',
    })
    this.version(2).stores({
      notes: 'id, deleted, dirty, pendingCreate',
      folders: 'id',
      tags: 'id',
      outbox: '++id',
      meta: 'key',
    })
    this.version(3).stores({
      notes: 'id, deleted, dirty, pendingCreate',
      folders: 'id',
      outbox: '++id',
      meta: 'key',
    })
  }
}

export const db = new HNotebookDB()
