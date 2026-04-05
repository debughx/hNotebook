/** SHA-256 hex of UTF-8 bytes. */
export async function utf8Sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text ?? '')
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Matches RAG ingest: sha256((title.trim() + "\\n---\\n" + body).utf8).hex */
export async function ingestContentHashHex(
  title: string,
  body: string,
): Promise<string> {
  const raw = `${(title ?? '').trim()}\n---\n${body ?? ''}`
  return utf8Sha256Hex(raw)
}
