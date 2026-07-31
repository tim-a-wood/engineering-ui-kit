import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "import-requirement-change")
process.stdout.write(JSON.stringify({ ok: true, system: "Requirement Change Impact", result: execution.result, state: execution.state }))
