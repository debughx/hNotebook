/** Decode JWT payload (no signature verification; client-side scope only). */
export function getJwtSub(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = JSON.parse(atob(padded)) as { sub?: string }
    return json.sub ?? null
  } catch {
    return null
  }
}
