// Hand-written HTTP client calling the existing Python API (backend/app/main.py).
// A migration plan must generate a typed client/composition boundary
// additively alongside this file, not collapse it into the backend's
// generated Python composition root (CAP-ERA-001 §14.3).
export async function fetchDashboard(): Promise<unknown> {
  const response = await fetch('/api/dashboard')
  return response.json()
}
