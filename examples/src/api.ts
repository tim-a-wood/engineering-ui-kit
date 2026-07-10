import type { CaseCollection, CaseInput, PerformanceCase, PerformanceOutput } from '../shared/types'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Request failed with ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export function listCases(): Promise<CaseCollection> {
  return requestJson<CaseCollection>('/api/cases')
}

export function calculateCase(input: CaseInput): Promise<PerformanceOutput> {
  return requestJson<PerformanceOutput>('/api/calculate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createCase(input: CaseInput): Promise<PerformanceCase> {
  return requestJson<PerformanceCase>('/api/cases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCase(id: string, input: CaseInput): Promise<PerformanceCase> {
  return requestJson<PerformanceCase>(`/api/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
