/** Typed API client — the only place the frontend talks to the server. */

import type { CaseInputs, PerformanceCase, Runway } from '../shared/model'

export interface CasePayload { label: string; sweepFamily?: string; inputs: CaseInputs }
export interface RunwayPayload { id: string; lengthFt: number; elevationFt: number; notes: string }

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
    throw new ApiError(0, 'Could not reach the AeroPlan server — you may be offline.')
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

export const loadData = () =>
  request<{ cases: PerformanceCase[]; runways: Runway[] }>('/api/data')

export const createCase = (payload: CasePayload) =>
  request<PerformanceCase>('/api/cases', { method: 'POST', body: JSON.stringify(payload) })

export const createCasesBulk = (cases: CasePayload[]) =>
  request<{ cases: PerformanceCase[] }>('/api/cases/bulk', { method: 'POST', body: JSON.stringify({ cases }) })

export const updateCase = (id: string, payload: CasePayload) =>
  request<PerformanceCase>(`/api/cases/${id}`, { method: 'PUT', body: JSON.stringify(payload) })

export const duplicateCase = (id: string) =>
  request<PerformanceCase>(`/api/cases/${id}/duplicate`, { method: 'POST' })

export const createRunway = (payload: RunwayPayload) =>
  request<Runway>('/api/runways', { method: 'POST', body: JSON.stringify(payload) })

export const updateRunway = (id: string, payload: RunwayPayload) =>
  request<Runway>(`/api/runways/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
