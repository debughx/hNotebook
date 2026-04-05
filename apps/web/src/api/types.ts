export type TokenResponse = {
  accessToken: string
  tokenType: string
}

export type FolderDto = {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

export type NoteDto = {
  id: string
  title: string
  body: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export type RagChatResponse = {
  reply: string
  used_chunks: number
  sources?: string[]
}

export type RagIngestResponse = {
  ingested: number
  sourceId: string
}

export type RagIngestSourceDto = {
  source_id: string
  chunk_count: number
  content_hash: string
  ingested_at: string
}

export type RagRuntimeConfig = {
  baseUrl?: string
  apiKey?: string
  embeddingModel?: string
  chatModel?: string
}

export type RagRuntimeConfigSaved = {
  base_url: string
  api_key: string
  embedding_model: string
  chat_model: string
}

export type RagChatSessionSummary = {
  id: string
  title: string
  updated_at: string
  message_count: number
}

export type RagChatSessionMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type RagChatSessionDetail = RagChatSessionSummary & {
  messages: RagChatSessionMessage[]
}
