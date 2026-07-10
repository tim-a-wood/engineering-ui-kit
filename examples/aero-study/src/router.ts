/**
 * Hand-rolled hash router.
 *   #/                  studies list
 *   #/new               study builder (create)
 *   #/studies/:id       study detail (chart + analysis)
 *   #/studies/:id/edit  study builder (edit)
 *   #/compare?ids=a,b   multi-study comparison
 */

import { useEffect, useState } from 'react'

export type Route =
  | { view: 'list' }
  | { view: 'new' }
  | { view: 'detail'; id: string }
  | { view: 'edit'; id: string }
  | { view: 'compare'; ids: string[] }

export function parseRoute(hash: string): Route {
  const [pathPart, queryPart] = hash.replace(/^#\/?/, '').split('?')
  const segments = (pathPart ?? '').split('/').filter(Boolean)
  if (segments.length === 0) return { view: 'list' }
  if (segments[0] === 'new') return { view: 'new' }
  if (segments[0] === 'compare') {
    const ids = (new URLSearchParams(queryPart ?? '').get('ids') ?? '').split(',').filter(Boolean)
    return { view: 'compare', ids }
  }
  if (segments[0] === 'studies' && segments[1]) {
    if (segments[2] === 'edit') return { view: 'edit', id: segments[1] }
    return { view: 'detail', id: segments[1] }
  }
  return { view: 'list' }
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
  list: '#/',
  create: '#/new',
  detail: (id: string) => `#/studies/${id}`,
  edit: (id: string) => `#/studies/${id}/edit`,
  compare: (ids: string[]) => `#/compare?ids=${ids.join(',')}`,
}
