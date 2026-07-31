import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? "receive-supplier-package")
process.stdout.write(JSON.stringify({ ok: true, system: "Supplier Deliveries", result: execution.result, state: execution.state }))
