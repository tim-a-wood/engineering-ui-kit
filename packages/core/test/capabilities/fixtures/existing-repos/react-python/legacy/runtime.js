// Pre-migration legacy runtime module: an ad-hoc script that directly
// invoked backend logic before the reference architecture existed.
//
// CAP-ERA-001 §14.2: this module remains readable and invocable through a
// compatibility adapter during migration. It is not reference-architecture
// conformant until it implements the generated contracts and is registered
// through a deployable composition root. Direct-invocation evidence from
// this file does not satisfy new real-connection verification.
export async function runLegacyDashboardRefresh({ dashboardUrl = 'http://localhost:8000/api/dashboard' } = {}) {
  const response = await fetch(dashboardUrl)
  return response.json()
}

// The operations map is the explicit compatibility surface consumed by the
// local runtime host while the generated contracts/composition root are being
// introduced. It is removed only after the conformance retirement gate passes.
export const operations = {
  'legacy.dashboard.refresh': runLegacyDashboardRefresh,
}
