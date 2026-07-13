# Capability interview packet contract

MVP uses the existing external Copilot file export/import workflow (CAP-DEC-002).

## Output

- Filename: `capability-interview-response.json`
- Upload budget: at most three files (reuse existing budget rules)

## Required packet control

- packetId, packetVersion, projectId, interviewKind, generatedAt
- Input context: record IDs, revisions, hashes, facts, glossary
- Interview boundary and state labels: confirmed / proposed / unresolved
- outputSchemaRef, outputFileName, gateId
- Safety: no credentials, no silent approval, no source implementation in the response

## Gates

- Product interview → CAP-GATE-001
- Architecture interview → CAP-GATE-002
- Module interview → CAP-GATE-003
