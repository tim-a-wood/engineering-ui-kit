/**
 * Isolated preload for the local target-application WebView.
 *
 * The host can only start or cancel a picker session. The guest returns one
 * serializable description of an element the user actually clicked; it has no
 * access to the Engineering UI Kit bridge, filesystem, processes, or secrets.
 */
import { ipcRenderer } from 'electron'

const START_CHANNEL = 'euik-preview-picker:start'
const CANCEL_CHANNEL = 'euik-preview-picker:cancel'
const RESULT_CHANNEL = 'euik-preview-picker:result'

let cancelActive: (() => void) | undefined

function attachPicker(): void {
  cancelActive?.()

  const highlight = document.createElement('div')
  highlight.setAttribute('data-euik-picker-ready', 'true')
  highlight.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2a5a8c;background:rgba(42,90,140,0.14);border-radius:4px;left:0;top:0;width:0;height:0'
  document.body.append(highlight)

  const marker = (element: Element): string | undefined => {
    for (const attr of ['data-cap-id', 'data-testid']) {
      const value = element.getAttribute(attr)?.trim()
      if (value) return `${attr}=${value}`
    }
    return undefined
  }

  const selector = (element: Element): string => {
    const parts: string[] = []
    let node: Element | null = element
    for (let depth = 0; node && node !== document.body && depth < 4; depth += 1) {
      let part = node.tagName.toLowerCase()
      if (node.id) {
        parts.unshift(`${part}#${node.id}`)
        break
      }
      const stable = marker(node)
      if (stable) {
        const separator = stable.indexOf('=')
        parts.unshift(`[${stable.slice(0, separator)}="${stable.slice(separator + 1)}"]`)
        break
      }
      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).filter((item) => item.tagName === node!.tagName)
        : []
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  let finished = false
  const cleanup = (): void => {
    document.removeEventListener('mousemove', move, true)
    document.removeEventListener('click', click, true)
    document.removeEventListener('keydown', key, true)
    window.removeEventListener('beforeunload', cancel)
    highlight.remove()
    cancelActive = undefined
  }
  const finish = (value: unknown): void => {
    if (finished) return
    finished = true
    cleanup()
    ipcRenderer.sendToHost(RESULT_CHANNEL, value)
  }
  const cancel = (): void => finish(null)
  const move = (event: MouseEvent): void => {
    if (!(event.target instanceof Element) || event.target === highlight) return
    const box = event.target.getBoundingClientRect()
    highlight.style.left = `${box.left}px`
    highlight.style.top = `${box.top}px`
    highlight.style.width = `${box.width}px`
    highlight.style.height = `${box.height}px`
  }
  const click = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const element = event.target
    if (!(element instanceof Element)) {
      finish(null)
      return
    }
    finish({
      route: location.hash || location.pathname || '/',
      documentTitle: document.title || '',
      selector: selector(element),
      visibleText: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      elementTag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || undefined,
      name: element.getAttribute('aria-label') || element.getAttribute('title') || undefined,
      stableMarker: marker(element),
      captureTime: new Date().toISOString(),
    })
  }
  const key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') cancel()
  }

  cancelActive = cancel
  document.addEventListener('mousemove', move, true)
  document.addEventListener('click', click, true)
  document.addEventListener('keydown', key, true)
  window.addEventListener('beforeunload', cancel)
}

ipcRenderer.on(START_CHANNEL, attachPicker)
ipcRenderer.on(CANCEL_CHANNEL, () => cancelActive?.())
