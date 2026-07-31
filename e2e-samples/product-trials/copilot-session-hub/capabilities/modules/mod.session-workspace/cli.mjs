import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "start-copilot-session")
process.stdout.write(JSON.stringify({ ok: true, system: "Copilot Session Operations Hub", result: execution.result, state: execution.state }))
