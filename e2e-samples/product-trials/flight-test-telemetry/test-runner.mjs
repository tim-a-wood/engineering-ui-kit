import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.telemetry-console/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.telemetry-console/ui/index.html")
const scenarios = [{"name":"Load telemetry run","actionId":"load-telemetry-run","result":"Flight FT-284 loaded","target":"runs"},{"name":"Review exceedance event","actionId":"review-exceedance-event","result":"Exceedance EVT-391 opened","target":"events"},{"name":"Mark analysis interval","actionId":"mark-analysis-interval","result":"Analysis interval marked","target":"events"},{"name":"Compare sensor source","actionId":"compare-sensor-source","result":"Sensor source comparison opened","target":"events"},{"name":"Annotate data dropout","actionId":"annotate-data-dropout","result":"Data dropout annotation recorded","target":"runs"},{"name":"Record engineering note","actionId":"record-engineering-note","result":"Engineering note linked to EVT-391","target":"investigations"},{"name":"Export investigation package","actionId":"export-investigation-package","result":"Investigation package exported","target":"investigations"},{"name":"Reject unverified exceedance","actionId":"reject-unverified-exceedance","result":"Unverified exceedance withheld","target":"events"}]
const moduleFiles = ["capabilities/modules/mod.telemetry-console/operations.mjs","capabilities/modules/mod.run-ingest/operations.mjs","capabilities/modules/mod.signal-analysis/operations.mjs","capabilities/modules/mod.investigation/operations.mjs","capabilities/modules/mod.flight-archive/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-unverified-exceedance") {
    const after = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
    if (before !== after || execution.mutatedApprovedState) failures.push('The protected action changed approved state.')
  }
}

try { validateProductState(state) } catch (error) { failures.push(error.message) }

const missingModules = moduleFiles.filter((file) => !fs.existsSync(path.resolve(file)))
const passed = fs.existsSync(appPath)
  && fs.statSync(appPath).size > 0
  && missingModules.length === 0
  && failures.length === 0

if (passed && screenshotPath && fs.existsSync(proofPath)) {
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
  fs.copyFileSync(proofPath, screenshotPath)
}

process.stdout.write(JSON.stringify({
  passed,
  module: process.argv[2] ?? 'all',
  artifact: appPath,
  architecture: "stream-processing investigation system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
