import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.release-workspace/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.release-workspace/ui/index.html")
const scenarios = [{"name":"Register software load","actionId":"register-software-load","result":"Software load FCS-24.8.3 registered","target":"loads"},{"name":"Check hardware compatibility","actionId":"check-hardware-compatibility","result":"Hardware compatibility checked","target":"fleet"},{"name":"Authorize load release","actionId":"authorize-load-release","result":"Load release authorized","target":"loads"},{"name":"Schedule aircraft load","actionId":"schedule-aircraft-load","result":"Aircraft load scheduled","target":"fleet"},{"name":"Record aircraft installation","actionId":"record-aircraft-installation","result":"Aircraft installation recorded","target":"install"},{"name":"Verify loaded configuration","actionId":"verify-loaded-configuration","result":"Loaded configuration verified","target":"install"},{"name":"Reject incompatible load","actionId":"reject-incompatible-load","result":"Incompatible load rejected","target":"fleet"}]
const moduleFiles = ["capabilities/modules/mod.release-workspace/operations.mjs","capabilities/modules/mod.compatibility/operations.mjs","capabilities/modules/mod.load-control/operations.mjs","capabilities/modules/mod.target-adapter/operations.mjs","capabilities/modules/mod.release-ledger/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-incompatible-load") {
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
  architecture: "transactional release system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
