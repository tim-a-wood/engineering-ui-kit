import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.experience-first/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.experience-first/ui/index.html")
const scenarios = [{"name":"Draft technical note","actionId":"draft-technical-note","result":"Technical note draft saved","target":"documents"},{"name":"Check STE wording","actionId":"check-ste-wording","result":"STE check completed with four items","target":"terminology"},{"name":"Compare document revision","actionId":"compare-document-revision","result":"Revision comparison opened","target":"documents"},{"name":"Record review comment","actionId":"record-review-comment","result":"Review comment recorded","target":"comments"},{"name":"Approve controlled revision","actionId":"approve-controlled-revision","result":"Controlled revision approved","target":"documents"},{"name":"Export approved document","actionId":"export-approved-document","result":"Approved document package exported","target":"documents"},{"name":"Reject prohibited term","actionId":"reject-prohibited-term","result":"Prohibited term rejected","target":"terminology"}]
const moduleFiles = ["capabilities/modules/mod.document-control/operations.mjs","capabilities/modules/mod.ste-checker/operations.mjs","capabilities/modules/mod.comment-service/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-prohibited-term") {
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
  architecture: "document-centered authoring system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
