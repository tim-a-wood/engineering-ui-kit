import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "review-requirement-set")
process.stdout.write(JSON.stringify({ ok: true, system: "DO-178C Review Workbench", result: execution.result, state: execution.state }))
