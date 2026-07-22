import type { DeployableSpecification, FoundationPlan, InboundBinding } from '@engineering-ui-kit/core'

/**
 * Project the deployables that belong to the current approved foundation.
 * Persisted deployable records are append-only, so returning all of them would
 * let Build entry-point configuration target a retired host from an earlier architecture revision.
 */
export function projectActiveDeployables(
  persisted: readonly DeployableSpecification[],
  foundation: FoundationPlan | undefined,
): DeployableSpecification[] {
  if (!foundation) return [...persisted]
  const activeIds = new Set(foundation.deployables.map((deployable) => deployable.deployableId))
  return persisted.filter((deployable) => activeIds.has(deployable.deployableId))
}

export function projectActiveBindings(
  bindings: readonly InboundBinding[],
  foundation: FoundationPlan,
): InboundBinding[] {
  const activeIds = new Set(foundation.deployables.map((deployable) => deployable.deployableId))
  return bindings.filter((binding) => activeIds.has(binding.deployableId))
}

/**
 * Refresh the remote binding references derived into a deployable composition.
 * Persisted binding records are append-only. References to any known binding
 * therefore must be replaced from the active foundation projection, while
 * genuinely user-authored adapter references remain untouched.
 */
export function projectDerivedOutboundBindingRefs(
  currentRefs: readonly string[],
  persistedBindings: readonly InboundBinding[],
  foundation: FoundationPlan,
  deployableId: string,
  requiredOperationIds: ReadonlySet<string>,
): string[] {
  const knownBindingIds = new Set(persistedBindings.map((binding) => binding.bindingId))
  const customRefs = currentRefs.filter((reference) => !knownBindingIds.has(reference))
  const remoteHttpRefs = projectActiveBindings(persistedBindings, foundation)
    .filter((binding) => binding.kind === 'http'
      && binding.deployableId !== deployableId
      && requiredOperationIds.has(binding.operationId))
    .map((binding) => binding.bindingId)
  return [...new Set([...customRefs, ...remoteHttpRefs])].sort()
}

export function projectActiveBindingRecords<T extends {
  draft?: InboundBinding
  approved?: InboundBinding
}>(records: readonly T[], foundation: FoundationPlan | undefined): T[] {
  if (!foundation) return [...records]
  const activeIds = new Set(foundation.deployables.map((deployable) => deployable.deployableId))
  return records.filter((record) => {
    const binding = record.approved ?? record.draft
    return Boolean(binding && activeIds.has(binding.deployableId))
  })
}

export function promoteRemoteUiBindings(
  bindings: readonly InboundBinding[],
  remoteHttpBindings: readonly Extract<InboundBinding, { kind: 'http' }>[],
): InboundBinding[] {
  return bindings.map((binding): InboundBinding => {
    if (binding.kind !== 'ui' || binding.transport !== 'browser-local') return binding
    const hasRemoteRoute = remoteHttpBindings.some((remote) =>
      remote.operationId === binding.operationId && remote.operationVersion === binding.operationVersion)
    return hasRemoteRoute ? { ...binding, transport: 'generated-http-client' } : binding
  })
}

/**
 * Promotion to a generated HTTP client changes a browser UI's invocation
 * transport, not its real verification surface. Electron IPC is the only UI
 * transport verified through a generated process host instead of the
 * configured application URL.
 */
export function isBrowserUiVerificationBinding(binding: InboundBinding): boolean {
  return binding.kind === 'ui' && binding.transport !== 'electron-ipc'
}
