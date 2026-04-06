export type MarkdownToolbarAction =
  | 'bold'
  | 'italic'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'quote'
  | 'codeInline'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'table'
  | 'hr'

export type MarkdownEditResult = {
  text: string
  selectionStart: number
  selectionEnd: number
}

function lineBounds(s: string, i: number): [number, number] {
  const lineStart = s.lastIndexOf('\n', Math.max(0, i - 1)) + 1
  const nextNl = s.indexOf('\n', i)
  const lineEnd = nextNl === -1 ? s.length : nextNl
  return [lineStart, lineEnd]
}

export function applyHeadingEdit(
  source: string,
  start: number,
  _end: number,
  level: 1 | 2 | 3 | 4 | 5 | 6,
): MarkdownEditResult {
  const [ls, le] = lineBounds(source, start)
  const line = source.slice(ls, le)
  const prefix = '#'.repeat(level) + ' '
  const pl = prefix.length
  let newLine: string
  if (/^#{1,6}\s/.test(line)) {
    newLine = prefix + line.replace(/^#+\s*/, '')
  } else {
    newLine = line === '' ? `${prefix}标题` : prefix + line
  }
  const text = source.slice(0, ls) + newLine + source.slice(le)
  if (line === '') {
    const idx = newLine.indexOf('标题')
    const a = ls + idx
    return { text, selectionStart: a, selectionEnd: a + 2 }
  }
  return {
    text,
    selectionStart: ls + pl,
    selectionEnd: ls + newLine.length,
  }
}

export function applyMarkdownEdit(
  source: string,
  start: number,
  end: number,
  action: MarkdownToolbarAction,
): MarkdownEditResult {
  const sel = source.slice(start, end)
  const clamp = (i: number) => Math.max(0, Math.min(source.length, i))

  switch (action) {
    case 'bold': {
      if (sel) {
        const w = `**${sel}**`
        const text = source.slice(0, start) + w + source.slice(end)
        return {
          text,
          selectionStart: start + 2,
          selectionEnd: start + 2 + sel.length,
        }
      }
      const w = '**粗体**'
      const text = source.slice(0, start) + w + source.slice(end)
      return { text, selectionStart: start + 2, selectionEnd: start + 4 }
    }
    case 'italic': {
      if (sel) {
        const w = `_${sel}_`
        const text = source.slice(0, start) + w + source.slice(end)
        return {
          text,
          selectionStart: start + 1,
          selectionEnd: start + 1 + sel.length,
        }
      }
      const w = '_斜体_'
      const text = source.slice(0, start) + w + source.slice(end)
      return { text, selectionStart: start + 1, selectionEnd: start + 3 }
    }
    case 'bulletList': {
      const [ls, le] = lineBounds(source, start)
      const line = source.slice(ls, le)
      if (line.trim() === '') {
        const newLine = '- '
        const text = source.slice(0, ls) + newLine + source.slice(le)
        const p = ls + 2
        return { text, selectionStart: p, selectionEnd: p }
      }
      const ins = '\n- '
      const at = clamp(start)
      const text = source.slice(0, at) + ins + source.slice(at)
      const p = at + ins.length
      return { text, selectionStart: p, selectionEnd: p }
    }
    case 'orderedList': {
      const [ls, le] = lineBounds(source, start)
      const line = source.slice(ls, le)
      if (line.trim() === '') {
        const newLine = '1. '
        const text = source.slice(0, ls) + newLine + source.slice(le)
        const p = ls + 3
        return { text, selectionStart: p, selectionEnd: p }
      }
      const ins = '\n1. '
      const at = clamp(start)
      const text = source.slice(0, at) + ins + source.slice(at)
      const p = at + ins.length
      return { text, selectionStart: p, selectionEnd: p }
    }
    case 'taskList': {
      const [ls, le] = lineBounds(source, start)
      const line = source.slice(ls, le)
      if (line.trim() === '') {
        const newLine = '- [ ] '
        const text = source.slice(0, ls) + newLine + source.slice(le)
        const p = ls + newLine.length
        return { text, selectionStart: p, selectionEnd: p }
      }
      const ins = '\n- [ ] '
      const at = clamp(start)
      const text = source.slice(0, at) + ins + source.slice(at)
      const p = at + ins.length
      return { text, selectionStart: p, selectionEnd: p }
    }
    case 'quote': {
      const [ls, le] = lineBounds(source, start)
      const line = source.slice(ls, le)
      const newLine = line.startsWith('> ') ? line : `> ${line}`
      const text = source.slice(0, ls) + newLine + source.slice(le)
      const p = Math.min(ls + newLine.length, text.length)
      return { text, selectionStart: p, selectionEnd: p }
    }
    case 'codeInline': {
      if (sel) {
        const w = `\`${sel}\``
        const text = source.slice(0, start) + w + source.slice(end)
        return {
          text,
          selectionStart: start + 1,
          selectionEnd: start + 1 + sel.length,
        }
      }
      const w = '`代码`'
      const text = source.slice(0, start) + w + source.slice(end)
      return { text, selectionStart: start + 1, selectionEnd: start + 3 }
    }
    case 'codeBlock': {
      if (sel) {
        const w = '```\n' + sel + '\n```'
        const text = source.slice(0, start) + w + source.slice(end)
        const innerStart = start + 4
        return {
          text,
          selectionStart: innerStart,
          selectionEnd: innerStart + sel.length,
        }
      }
      const w = '```\n\n```'
      const text = source.slice(0, start) + w + source.slice(end)
      const p = start + 4
      return { text, selectionStart: p, selectionEnd: p }
    }
    case 'link': {
      const w = '[链接文字](https://)'
      const text = source.slice(0, start) + w + source.slice(end)
      return { text, selectionStart: start + 1, selectionEnd: start + 5 }
    }
    case 'image': {
      const w = '![说明](https://)'
      const text = source.slice(0, start) + w + source.slice(end)
      return { text, selectionStart: start + 2, selectionEnd: start + 4 }
    }
    case 'table': {
      const w =
        '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|     |     |     |\n'
      const at = clamp(start)
      const text = source.slice(0, at) + w + source.slice(at)
      const row3 = '|     |     |     |'
      const idx = w.indexOf(row3)
      const p = at + idx + 2
      return { text, selectionStart: p, selectionEnd: p + 3 }
    }
    case 'hr': {
      const ins = '\n\n---\n\n'
      const at = clamp(start)
      const text = source.slice(0, at) + ins + source.slice(at)
      const p = at + ins.length
      return { text, selectionStart: p, selectionEnd: p }
    }
    default:
      return { text: source, selectionStart: start, selectionEnd: end }
  }
}
