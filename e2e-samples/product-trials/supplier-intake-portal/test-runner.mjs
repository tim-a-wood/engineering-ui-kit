import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/mod.experience-first/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve("capabilities/modules/mod.experience-first/ui/index.html")
const scenarios = [{"name":"Receive supplier package","actionId":"receive-supplier-package","result":"Supplier package SUP-ACU-241 received","target":"deliveries"},{"name":"Validate package manifest","actionId":"validate-package-manifest","result":"Package manifest validated","target":"deliveries"},{"name":"Review compliance gap","actionId":"review-compliance-gap","result":"Compliance gap GAP-ACU-018 opened","target":"gaps"},{"name":"Request supplier correction","actionId":"request-supplier-correction","result":"Correction request sent to supplier queue","target":"gaps"},{"name":"Verify corrected package","actionId":"verify-corrected-package","result":"Corrected package verification passed","target":"deliveries"},{"name":"Accept supplier delivery","actionId":"accept-supplier-delivery","result":"Supplier delivery accepted","target":"deliveries"},{"name":"Reject unsigned package","actionId":"reject-unsigned-package","result":"Unsigned package quarantined","target":"deliveries"}]
const moduleFiles = ["capabilities/modules/mod.intake-flow/operations.mjs","capabilities/modules/mod.package-validator/operations.mjs","capabilities/modules/mod.gap-control/operations.mjs","capabilities/modules/mod.acceptance-records/operations.mjs"]
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(`Unexpected result for ${scenario.name}`)
  if (scenario.actionId === "reject-unsigned-package") {
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
  architecture: "case-management portal",
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
