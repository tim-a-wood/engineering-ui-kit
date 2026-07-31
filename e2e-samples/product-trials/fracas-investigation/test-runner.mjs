import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.case-workspace/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.case-workspace/ui/index.html")
const scenarios = [{"name":"Record failure report","actionId":"record-failure-report","result":"Failure report FR-2026-118 recorded","target":"reports"},{"name":"Classify failure mode","actionId":"classify-failure-mode","result":"Failure mode classified","target":"reports"},{"name":"Record containment action","actionId":"record-containment-action","result":"Containment action recorded","target":"actions"},{"name":"Analyze root cause","actionId":"analyze-root-cause","result":"Root cause analysis opened","target":"investigations"},{"name":"Link causal evidence","actionId":"link-causal-evidence","result":"Causal evidence linked","target":"investigations"},{"name":"Assign corrective action","actionId":"assign-corrective-action","result":"Corrective action assigned","target":"actions"},{"name":"Verify action closure","actionId":"verify-action-closure","result":"Action closure verified","target":"actions"},{"name":"Monitor failure recurrence","actionId":"monitor-failure-recurrence","result":"Recurrence monitor started","target":"reports"},{"name":"Reject open corrective action","actionId":"reject-open-corrective-action","result":"Open corrective action retained","target":"actions"}]
const moduleFiles = ["capabilities/modules/mod.case-workspace/operations.mjs","capabilities/modules/mod.failure-ledger/operations.mjs","capabilities/modules/mod.cause-analysis/operations.mjs","capabilities/modules/mod.action-control/operations.mjs","capabilities/modules/mod.trend-service/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-open-corrective-action") {
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
  architecture: "closed-loop reliability system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
