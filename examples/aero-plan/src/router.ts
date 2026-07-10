/**
 * Hand-rolled hash router.
 *   #/                    fleet dashboard
 *   #/calculator          new case (wizard)
 *   #/calculator/:id      edit case (wizard)
 *   #/cases               registry (table + chart)
 *   #/compare?a=&b=       two-case diff
 *   #/runways             runway library
 */

import { useEffect, useState } from 'react'

export type Route =
  | { view: 'dashboard' }
  | { view: 'calculator'; id?: string }
  | { view: 'cases' }
  | { view: 'compare'; a?: string; b?: string }
  | { view: 'runways' }

export function parseRoute(hash: string): Route {
  const [pathPart, queryPart] = hash.replace(/^#\/?/, '').split('?')
  const seg = (pathPart ?? '').split('/').filter(Boolean)
  if (seg.length === 0) return { view: 'dashboard' }
  if (seg[0] === 'calculator') return seg[1] ? { view: 'calculator', id: seg[1] } : { view: 'calculator' }
  if (seg[0] === 'cases') return { view: 'cases' }
  if (seg[0] === 'compare') {
    const params = new URLSearchParams(queryPart ?? '')
    return { view: 'compare', a: params.get('a') ?? undefined, b: params.get('b') ?? undefined }
  }
  if (seg[0] === 'runways') return { view: 'runways' }
  return { view: 'dashboard' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const navigate = (hash: string): void => { window.location.hash = hash }

export const href = {
  dashboard: '#/',
  calculator: '#/calculator',
  editCase: (id: string) => `#/calculator/${id}`,
  cases: '#/cases',
  compare: (a: string, b: string) => `#/compare?a=${a}&b=${b}`,
  runways: '#/runways',
}
