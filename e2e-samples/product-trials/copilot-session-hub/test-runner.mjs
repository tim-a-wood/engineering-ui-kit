import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.session-workspace/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.session-workspace/ui/index.html")
const scenarios = [{"name":"Start Copilot session","actionId":"start-copilot-session","result":"Session started with packet PKT-204","target":"active"},{"name":"Update session progress","actionId":"update-session-progress","result":"Progress updated to 68 percent","target":"active"},{"name":"Record session issue","actionId":"record-session-issue","result":"Issue linked to the active session","target":"issues"},{"name":"Link branch output","actionId":"link-branch-output","result":"Branch output linked to the session","target":"active"},{"name":"Record next action","actionId":"record-next-action","result":"Next action added to the session","target":"active"},{"name":"Review active sessions","actionId":"review-active-sessions","result":"Twelve active sessions shown","target":"active"},{"name":"Close completed session","actionId":"close-completed-session","result":"Session closed with evidence","target":"history"},{"name":"Reopen paused session","actionId":"reopen-paused-session","result":"Paused session returned to active work","target":"active"},{"name":"Reject unresolved session","actionId":"reject-unresolved-session","result":"Unresolved session kept open","target":"issues"}]
const moduleFiles = ["capabilities/modules/mod.session-workspace/operations.mjs","capabilities/modules/mod.session-ledger/operations.mjs","capabilities/modules/mod.issue-queue/operations.mjs","capabilities/modules/mod.evidence-store/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-unresolved-session") {
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
  architecture: "event-driven work tracker",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
