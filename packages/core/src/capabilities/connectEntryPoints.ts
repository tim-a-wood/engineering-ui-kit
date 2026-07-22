import type { DeployableKind, ExposureLevel } from './types.js'

/** Default exposure for new inbound bindings; elevation is always explicit. */
export const DEFAULT_INBOUND_EXPOSURE: ExposureLevel = 'private'

export function withDefaultExposure<T extends { exposure?: ExposureLevel }>(
  binding: T,
): T & { exposure: ExposureLevel } {
  return { ...binding, exposure: binding.exposure ?? DEFAULT_INBOUND_EXPOSURE }
}

export type DeployableEntryPointInput = { deployableId: string; kind: DeployableKind }
export type InboundBindingEntryPointInput = {
  bindingId: string
  deployableId: string
  operationId?: string
  operationVersion?: string
  approved: boolean
  exposure?: ExposureLevel
}
export type DeployableConnectStatus = {
  deployableId: string
  requiresEntryPoint: boolean
  bindingCount: number
  validBindingCount: number
  hasValidEntryPoint: boolean
  exposureElevated: boolean
  satisfied: boolean
}
export type ConnectEntryPointModel = {
  deployables: DeployableConnectStatus[]
  requiredDeployableIds: string[]
  allRequiredSatisfied: boolean
  anyExposureElevated: boolean
}

/** Pure browser-safe Build entry-point completeness projection over canonical records. */
export function evaluateConnectEntryPoints(
  deployables: DeployableEntryPointInput[],
  bindings: InboundBindingEntryPointInput[],
): ConnectEntryPointModel {
  const byDeployable = new Map<string, InboundBindingEntryPointInput[]>()
  for (const binding of bindings) {
    const list = byDeployable.get(binding.deployableId) ?? []
    list.push(binding)
    byDeployable.set(binding.deployableId, list)
  }
  const statuses = deployables.map((deployable): DeployableConnectStatus => {
    const requiresEntryPoint = deployable.kind !== 'embedded-library'
    const candidates = byDeployable.get(deployable.deployableId) ?? []
    const validBindingCount = candidates.filter((binding) => binding.approved).length
    const exposureElevated = candidates.some(
      (binding) => (binding.exposure ?? DEFAULT_INBOUND_EXPOSURE) !== DEFAULT_INBOUND_EXPOSURE,
    )
    return {
      deployableId: deployable.deployableId,
      requiresEntryPoint,
      bindingCount: candidates.length,
      validBindingCount,
      hasValidEntryPoint: validBindingCount > 0,
      exposureElevated,
      satisfied: !requiresEntryPoint || validBindingCount > 0,
    }
  })
  const required = statuses.filter((status) => status.requiresEntryPoint)
  return {
    deployables: statuses,
    requiredDeployableIds: required.map((status) => status.deployableId),
    allRequiredSatisfied: required.every((status) => status.satisfied),
    anyExposureElevated: statuses.some((status) => status.exposureElevated),
  }
}
