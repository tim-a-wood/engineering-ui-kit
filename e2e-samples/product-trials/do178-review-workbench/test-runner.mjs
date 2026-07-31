import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.experience-first/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.experience-first/ui/index.html")
const scenarios = [{"name":"Review requirement set","actionId":"review-requirement-set","result":"Requirement set opened","target":"artifacts"},{"name":"Record review finding","actionId":"record-review-finding","result":"Finding REV-218 recorded","target":"findings"},{"name":"Assign finding owner","actionId":"assign-finding-owner","result":"Finding assigned to Navigation team","target":"findings"},{"name":"Verify finding closure","actionId":"verify-finding-closure","result":"Closure evidence verified","target":"findings"},{"name":"Check objective coverage","actionId":"check-objective-coverage","result":"Objective coverage check passed","target":"artifacts"},{"name":"Approve review record","actionId":"approve-review-record","result":"Review record approved","target":"records"},{"name":"Export review evidence","actionId":"export-review-evidence","result":"Review evidence package exported","target":"records"},{"name":"Reject author approval","actionId":"reject-author-approval","result":"Author approval rejected","target":"records"}]
const moduleFiles = ["capabilities/modules/mod.review-control/operations.mjs","capabilities/modules/mod.evidence-index/operations.mjs","capabilities/modules/mod.finding-control/operations.mjs","capabilities/modules/mod.review-records/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-author-approval") {
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
  architecture: "layered review system",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
