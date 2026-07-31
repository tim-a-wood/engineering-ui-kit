import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.study-canvas/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.study-canvas/ui/index.html")
const scenarios = [{"name":"Define study case","actionId":"define-study-case","result":"Study case TS-CRZ-019 defined","target":"cases"},{"name":"Run performance analysis","actionId":"run-performance-analysis","result":"Performance analysis completed","target":"results"},{"name":"Compare design options","actionId":"compare-design-options","result":"Four design options compared","target":"results"},{"name":"Review sensitivity result","actionId":"review-sensitivity-result","result":"Sensitivity result opened","target":"results"},{"name":"Approve study baseline","actionId":"approve-study-baseline","result":"Study baseline B approved","target":"baselines"},{"name":"Reject stale assumption","actionId":"reject-stale-assumption","result":"Stale assumption rejected","target":"cases"}]
const moduleFiles = ["capabilities/modules/mod.study-canvas/operations.mjs","capabilities/modules/mod.case-control/operations.mjs","capabilities/modules/mod.model-runner/operations.mjs","capabilities/modules/mod.trade-engine/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-stale-assumption") {
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
  architecture: "analysis pipeline",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
