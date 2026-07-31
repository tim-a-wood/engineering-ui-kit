const input = JSON.parse(process.argv.at(-1) || '{}')
process.stdout.write(JSON.stringify({ ok: true, system: "Copilot Session Operations Hub", input }))
