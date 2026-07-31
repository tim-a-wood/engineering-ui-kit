import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.impact-workspace/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.impact-workspace/ui/index.html")
const scenarios = [{"name":"Import requirement change","actionId":"import-requirement-change","result":"Requirement change CR-1187 imported","target":"changes"},{"name":"Trace affected design","actionId":"trace-affected-design","result":"Seventeen affected artifacts traced","target":"artifacts"},{"name":"Compare trace revision","actionId":"compare-trace-revision","result":"Trace revision comparison opened","target":"artifacts"},{"name":"Review module impact","actionId":"review-module-impact","result":"Four module impacts opened","target":"artifacts"},{"name":"Assign rework action","actionId":"assign-rework-action","result":"Rework action assigned","target":"artifacts"},{"name":"Estimate change effort","actionId":"estimate-change-effort","result":"Change effort estimate recorded","target":"decisions"},{"name":"Approve impact decision","actionId":"approve-impact-decision","result":"Impact decision approved","target":"decisions"},{"name":"Reject unreviewed impact","actionId":"reject-unreviewed-impact","result":"Unreviewed impact kept open","target":"decisions"}]
const moduleFiles = ["capabilities/modules/mod.impact-workspace/operations.mjs","capabilities/modules/mod.trace-index/operations.mjs","capabilities/modules/mod.impact-engine/operations.mjs","capabilities/modules/mod.decision-control/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-unreviewed-impact") {
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
  architecture: "graph-analysis decision system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
