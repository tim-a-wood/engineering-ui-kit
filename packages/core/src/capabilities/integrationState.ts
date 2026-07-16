/**
 * Non-contract application state for the production reference-architecture
 * workflow. These records deliberately wrap the frozen CAP-CONTRACT-025/026/029
 * records instead of adding UI lifecycle fields to their canonical schemas.
 */

import type {
  CompositionOperationRoute,
  LifecycleKind,
  ConnectionVerificationRecord,
  GeneratedOwnershipManifest,
  GenerationPlan,
} from './types.js'
import type { GenerationApplyVirtualFile } from './generationApply.js'

export type IntegrationLifecycleStatus =
  | 'not-ready'
  | 'ready-to-generate'
  | 'plan-ready'
  | 'blocked'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'stale'
  | 'rolled-back'

export type PersistedGenerationBundle = {
  schemaVersion: '1.0'
  projectId: string
  deployableId: string
  plan: GenerationPlan
  virtualFiles: GenerationApplyVirtualFile[]
  inputHash: string
  createdAt: string
}

export type GenerationApplyRecord = {
  schemaVersion: '1.0'
  projectId: string
  deployableId: string
  planId: string
  planHash: string
  applyRunId: string
  status: 'applying' | 'applied' | 'failed' | 'rolled-back'
  rollbackId?: string
  ownershipManifests: GeneratedOwnershipManifest[]
  commands: string[]
  error?: string
  startedAt: string
  completedAt?: string
}

export type IntegrationCommandRun = {
  schemaVersion: '1.0'
  projectId: string
  deployableId: string
  planId: string
  planHash: string
  commandRunId: string
  status: 'running' | 'passed' | 'failed'
  results: {
    label: string
    command: string
    status: 'passed' | 'failed' | 'cancelled' | 'timed-out'
    exitCode: number | null
    startedAt: string
    endedAt: string
    outputArtifactRefs: string[]
  }[]
  startedAt: string
  completedAt?: string
}

export type CompositionRegistrationConfiguration = {
  contractId: string
  providerModuleId: string
  lifecycle: LifecycleKind
  dependencies: string[]
  implementationTarget?: string
  suggestedImplementationTarget?: string
}

export type CompositionConfigurationState = {
  deployableId: string
  compositionId: string
  compositionRootPath: string
  runtimeLanguage: 'typescript' | 'python'
  registrations: CompositionRegistrationConfiguration[]
  operationRoutes: CompositionOperationRoute[]
  ready: boolean
  attention: string[]
}

export type DeployableIntegrationState = {
  deployableId: string
  status: IntegrationLifecycleStatus
  attention: string[]
  currentPlan?: GenerationPlan
  latestApply?: GenerationApplyRecord
  latestCommandRun?: IntegrationCommandRun
  connectionVerifications: ConnectionVerificationRecord[]
  /** Evidence whose six source hashes still match the current applied integration. */
  currentConnectionVerificationIds: string[]
  compositionConfiguration?: CompositionConfigurationState
}

export type CapabilityIntegrationState = {
  schemaVersion: '1.0'
  projectId: string
  deployables: DeployableIntegrationState[]
  updatedAt: string
}
