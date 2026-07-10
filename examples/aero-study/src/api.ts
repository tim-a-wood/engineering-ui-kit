/** Typed API client — the only place the frontend talks to the server. */

import type { Study, StudyDef } from '../shared/model'

export type StudyInput = StudyDef & { name: string; notes: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the AeroStudy server — you may be offline.')
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch { /* non-JSON body */ }
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as T
}

export const listStudies = () =>
  request<{ studies: Study[] }>('/api/studies').then((r) => r.studies)

export const createStudy = (input: StudyInput) =>
  request<Study>('/api/studies', { method: 'POST', body: JSON.stringify(input) })

export const updateStudy = (id: string, input: StudyInput) =>
  request<Study>(`/api/studies/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const duplicateStudy = (id: string) =>
  request<Study>(`/api/studies/${id}/duplicate`, { method: 'POST' })
