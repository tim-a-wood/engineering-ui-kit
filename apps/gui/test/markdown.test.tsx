import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from '../src/markdown'

const render = (text: string) => renderToStaticMarkup(<Markdown text={text} />)

describe('Markdown renderer (PRD §13.4 preview subset)', () => {
  it('renders headings by level', () => {
    const html = render('# Title\n\n## Section\n\n### Sub')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<h2>Section</h2>')
    expect(html).toContain('<h3>Sub</h3>')
  })

  it('renders unordered and ordered lists', () => {
    const html = render('- one\n- two\n\n1. first\n2. second')
    expect(html).toMatch(/<ul>.*<li>one<\/li>.*<li>two<\/li>.*<\/ul>/s)
    expect(html).toMatch(/<ol>.*<li>first<\/li>.*<li>second<\/li>.*<\/ol>/s)
  })

  it('renders tables with headers and body rows', () => {
    const html = render('| Token | Value |\n|---|---|\n| canvas | #07111f |')
    expect(html).toContain('<th scope="col">Token</th>')
    expect(html).toContain('<td>canvas</td>')
    expect(html).toContain('<td>#07111f</td>')
  })

  it('renders fenced code without interpreting its content', () => {
    const html = render('```bash\nnpm run typecheck\n# not a heading\n```')
    expect(html).toContain('npm run typecheck')
    expect(html).toContain('# not a heading')
    expect(html).not.toContain('<h1>not a heading</h1>')
  })

  it('renders inline code and bold', () => {
    const html = render('Return only `ui-overlay.zip` with **changed files**.')
    expect(html).toContain('<code>ui-overlay.zip</code>')
    expect(html).toContain('<strong>changed files</strong>')
  })

  it('does not pass raw HTML through', () => {
    const html = render('hello <script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('joins consecutive lines into one paragraph', () => {
    const html = render('line one\nline two')
    expect(html).toMatch(/<p>line one line two<\/p>/)
  })
})
