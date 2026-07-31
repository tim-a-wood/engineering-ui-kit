const input = JSON.parse(process.argv.at(-1) || '{}')
process.stdout.write(JSON.stringify({ ok: true, system: "Reliability and FRACAS Investigation System", input }))
