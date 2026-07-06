/**
 * Minimal markdown renderer for packet previews (PRD §13.4). Supports the
 * subset our generated artifacts use: headings, lists, tables, fenced code,
 * inline code, and bold. No external dependency, no raw HTML pass-through.
 */

import type { ReactNode } from 'react'

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('`')) parts.push(<code key={`${keyBase}-c${i}`}>{token.slice(1, -1)}</code>)
    else parts.push(<strong key={`${keyBase}-b${i}`}>{token.slice(2, -2)}</strong>)
    last = match.index + token.length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function Markdown(props: { text: string }) {
  const lines = props.text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        code.push(lines[i] ?? '')
        i++
      }
      i++
      blocks.push(<pre key={key++} className="md-code">{code.join('\n')}</pre>)
      continue
    }

    if (/^#{1,4} /.test(line)) {
      const level = line.match(/^#+/)![0].length
      const content = renderInline(line.replace(/^#+ /, ''), `h${key}`)
      blocks.push(
        level === 1 ? <h1 key={key++}>{content}</h1>
          : level === 2 ? <h2 key={key++}>{content}</h2>
            : level === 3 ? <h3 key={key++}>{content}</h3>
              : <h4 key={key++}>{content}</h4>,
      )
      i++
      continue
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('|')) {
        tableLines.push(lines[i] ?? '')
        i++
      }
      const rows = tableLines
        .filter((l) => !/^\|[\s-|]+\|$/.test(l))
        .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
      const [head, ...body] = rows
      blocks.push(
        <table key={key++} className="data-table md-table">
          {head && (
            <thead><tr>{head.map((c, ci) => <th key={ci} scope="col">{renderInline(c, `th${key}-${ci}`)}</th>)}</tr></thead>
          )}
          <tbody>
            {body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, `td${ri}-${ci}`)}</td>)}</tr>)}
          </tbody>
        </table>,
      )
      continue
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*] /, ''))
        i++
      }
      blocks.push(<ul key={key++}>{items.map((item, ii) => <li key={ii}>{renderInline(item, `li${key}-${ii}`)}</li>)}</ul>)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\. /, ''))
        i++
      }
      blocks.push(<ol key={key++}>{items.map((item, ii) => <li key={ii}>{renderInline(item, `oli${key}-${ii}`)}</li>)}</ol>)
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const para: string[] = [line]
    i++
    while (i < lines.length && (lines[i] ?? '').trim() !== '' && !/^([#|`]|[-*] |\d+\. )/.test(lines[i] ?? '')) {
      para.push(lines[i] ?? '')
      i++
    }
    blocks.push(<p key={key++}>{renderInline(para.join(' '), `p${key}`)}</p>)
  }

  return <div className="markdown-body">{blocks}</div>
}
