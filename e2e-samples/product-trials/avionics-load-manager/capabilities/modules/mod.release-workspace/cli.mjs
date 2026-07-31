import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "register-software-load")
process.stdout.write(JSON.stringify({ ok: true, system: "Software Load Control", result: execution.result, state: execution.state }))
