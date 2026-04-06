/** Two spaces — common for Markdown lists / nesting */
const INDENT = '  '

export type TextareaTabResult = {
  text: string
  selectionStart: number
  selectionEnd: number
}

function lineStart(s: string, pos: number): number {
  return s.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
}

function lineEnd(s: string, pos: number): number {
  const n = s.indexOf('\n', pos)
  return n === -1 ? s.length : n
}

function stripLeadingIndent(line: string): { line: string; removed: number } {
  if (line.startsWith(INDENT)) return { line: line.slice(INDENT.length), removed: 2 }
  if (line.startsWith('\t')) return { line: line.slice(1), removed: 1 }
  return { line, removed: 0 }
}

/**
 * Tab / Shift+Tab in a note body textarea: insert spaces or indent/unindent lines.
 */
export function applyTextareaTab(
  value: string,
  start: number,
  end: number,
  shiftKey: boolean,
): TextareaTabResult {
  if (shiftKey) return unindent(value, start, end)
  return indent(value, start, end)
}

function indent(value: string, start: number, end: number): TextareaTabResult {
  if (start === end) {
    const text = value.slice(0, start) + INDENT + value.slice(end)
    const p = start + INDENT.length
    return { text, selectionStart: p, selectionEnd: p }
  }
  const ls = lineStart(value, start)
  const lastPos = Math.max(start, end - 1)
  const le = lineEnd(value, lastPos)
  const block = value.slice(ls, le)
  const lines = block.split('\n')
  const k = lines.length
  const newBlock = lines.map((l) => INDENT + l).join('\n')
  const text = value.slice(0, ls) + newBlock + value.slice(le)
  return {
    text,
    selectionStart: start + INDENT.length,
    selectionEnd: end + INDENT.length * k,
  }
}

/** Map absolute position in `value` after unindenting `lines` block at `ls`..`le` */
function mapPosAfterUnindent(
  abs: number,
  ls: number,
  le: number,
  lines: string[],
  removed: number[],
): number {
  if (abs < ls) return abs
  if (abs > le) {
    const total = removed.reduce((a, b) => a + b, 0)
    return abs - total
  }
  let p = ls
  let removedBefore = 0
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]!.length
    const r = removed[i]!
    const lineStartAbs = p
    const lineEndAbs = p + L
    if (abs < lineStartAbs) return abs - removedBefore
    if (abs < lineEndAbs) {
      const col = abs - lineStartAbs
      const shrink = Math.min(col, r)
      return abs - removedBefore - shrink
    }
    if (abs === lineEndAbs) {
      return abs - removedBefore - r
    }
    removedBefore += r
    p = lineEndAbs + 1
  }
  return abs - removedBefore
}

function unindent(value: string, start: number, end: number): TextareaTabResult {
  if (start === end) {
    const ls = lineStart(value, start)
    const le = lineEnd(value, start)
    const line = value.slice(ls, le)
    const { line: nl, removed } = stripLeadingIndent(line)
    const text = value.slice(0, ls) + nl + value.slice(le)
    const newPos = Math.max(ls, start - Math.min(start - ls, removed))
    return { text, selectionStart: newPos, selectionEnd: newPos }
  }
  const ls = lineStart(value, start)
  const lastPos = Math.max(start, end - 1)
  const le = lineEnd(value, lastPos)
  const block = value.slice(ls, le)
  const lines = block.split('\n')
  const stripped = lines.map((l) => stripLeadingIndent(l))
  const removed = stripped.map((x) => x.removed)
  const newBlock = stripped.map((x) => x.line).join('\n')
  const text = value.slice(0, ls) + newBlock + value.slice(le)
  if (removed.every((r) => r === 0)) {
    return { text: value, selectionStart: start, selectionEnd: end }
  }
  return {
    text,
    selectionStart: mapPosAfterUnindent(start, ls, le, lines, removed),
    selectionEnd: mapPosAfterUnindent(end, ls, le, lines, removed),
  }
}
