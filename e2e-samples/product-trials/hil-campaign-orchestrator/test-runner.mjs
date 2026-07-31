import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.campaign-console/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.campaign-console/ui/index.html")
const scenarios = [{"name":"Reserve test bench","actionId":"reserve-test-bench","result":"Bench 04 reserved","target":"schedule"},{"name":"Load test configuration","actionId":"load-test-configuration","result":"Configuration FCS-24.8 loaded","target":"campaign"},{"name":"Start test campaign","actionId":"start-test-campaign","result":"Campaign HIL-FCS-088 started","target":"campaign"},{"name":"Pause test campaign","actionId":"pause-test-campaign","result":"Campaign paused at a safe procedure boundary","target":"campaign"},{"name":"Review failed procedure","actionId":"review-failed-procedure","result":"Failed procedure TC-FCS-104 opened","target":"procedures"},{"name":"Retry failed procedure","actionId":"retry-failed-procedure","result":"Failed procedure queued for retry","target":"procedures"},{"name":"Approve campaign evidence","actionId":"approve-campaign-evidence","result":"Campaign evidence approved","target":"evidence"},{"name":"Release test bench","actionId":"release-test-bench","result":"Bench 04 released with a clean state","target":"schedule"},{"name":"Reject unreserved bench","actionId":"reject-unreserved-bench","result":"Unreserved bench request rejected","target":"schedule"}]
const moduleFiles = ["capabilities/modules/mod.campaign-console/operations.mjs","capabilities/modules/mod.bench-scheduler/operations.mjs","capabilities/modules/mod.test-executor/operations.mjs","capabilities/modules/mod.rig-adapter/operations.mjs","capabilities/modules/mod.campaign-evidence/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-unreserved-bench") {
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
  architecture: "distributed execution control",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
