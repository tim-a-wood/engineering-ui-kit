import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "record-failure-report")
process.stdout.write(JSON.stringify({ ok: true, system: "FRACAS Investigations", result: execution.result, state: execution.state }))
