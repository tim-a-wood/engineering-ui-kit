import {
  moduleInterviewOpeningGuidance,
  type InterviewPacket,
} from '@engineering-ui-kit/core'

/**
 * Builds the operator-facing Copilot prompt for a capability definition handoff.
 * Kept pure so the conversation contract can be verified without loading Electron.
 */
export function interactiveInterviewPrompt(packet: InterviewPacket): string {
  const completionRule = packet.outputSchemaRef === 'CAP-CONTRACT-003'
    ? 'Every required answer must contain a concrete answer and no answer may have status "unresolved". Every provided operation must have one matching operationContracts entry at the same version, and its inputSchemaRef and outputSchemaRef must resolve to concrete dataSchemas entries.'
    : packet.outputSchemaRef === 'CAP-CONTRACT-002'
      ? 'The final response must assign every module a name, moduleType, and responsibility; give every dependency edge a concrete reason; cover every module in a workflow trace and moduleNeedTrace; and contain an empty unresolvedQuestions array.'
      : 'The final response must contain an empty unresolvedQuestions array. Do not leave proposals or assumptions awaiting confirmation.'
  const moduleOpeningGuidance = moduleInterviewOpeningGuidance(packet)
  return `Run the bounded definition task in the embedded capability packet as a fast, draft-first review with the user.

Interview protocol:
1. Review every supplied fact first. Build a complete proposed response internally from confirmed context, repository clues, architecture allocations, connected modules, and reasonable reversible defaults.
2. In your first message, present a concise plain-language draft and the few material assumptions that need human confirmation. Ask the user to reply “accept” or list corrections. Do not ask them to restate known facts and do not walk through schema fields one by one.
3. When context is genuinely too sparse for a useful draft, ask one compact kickoff batch of no more than five decision-rich prompts. Make it possible to answer the whole batch in one message and include a recommended default or example for each prompt.
4. After the user responds, update the entire draft. Ask at most one follow-up batch, and only for a material contradiction, irreversible choice, safety boundary, or business rule that cannot be safely defaulted. Group every remaining gap into that one batch.
5. A user who accepts the proposed brief has explicitly accepted its visible defaults. Never silently approve a hidden assumption; label material assumptions in the review.
6. Before emitting JSON, silently audit the response against the completion rule and repair mechanical omissions. Never return a response that merely records unanswered questions.
7. ${completionRule}
${moduleOpeningGuidance}

After the review is genuinely complete, return only a new ${packet.outputFileName} using the exact template below. Do not design beyond the definition boundary, implement source code, or approve the application's separate in-app review gate.`
}
