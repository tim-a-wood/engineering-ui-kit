/**
 * Shared prop types for the consolidated Build view and its panels.
 */

import type { AppliedFiles, OverlayInspectionSummary, Project, HandoffRun, TaskPacketDiagnostic } from '@engineering-ui-kit/core'
import type { BuildPacketResult, EuikBridge, PrepareContextResult, TaskPacketFields, TaskPacketTextKey } from '../../bridge'
import type { BuildWorkspaceState, RecipePrefill, ViewId } from '../../appState'
import type { GuideTopicId } from '../../guides'
import type { Status } from '../../components'

export type BuildStepProps = {
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  refreshRun: () => Promise<void>
  refreshProjects: () => Promise<void>
  onNavigate: (view: ViewId) => void
  onOpenGuide: (topic: GuideTopicId) => void
}

export type BuildViewProps = BuildStepProps & {
  recipe?: RecipePrefill | null
  onRecipeConsumed?: () => void
  preferredTemplate?: string
  packet: BuildPacketResult | null
  onPacket: (p: BuildPacketResult | null) => void
  initialWorkspace?: BuildWorkspaceState
}

export type ReadinessState = 'ready' | 'stale' | 'missing'

export type BuildTaskPanelProps = {
  project: Project
  recipe?: RecipePrefill | null
  preferredTemplate?: string
  fields: TaskPacketFields
  setFields: (updater: TaskPacketFields | ((prev: TaskPacketFields) => TaskPacketFields)) => void
  editing: TaskPacketTextKey | null
  setEditing: (key: TaskPacketTextKey | null) => void
  draft: string
  setDraft: (value: string) => void
  showValidation: boolean
  templateId: string
  setTemplateId: (id: string) => void
  confirmTemplate: boolean
  setConfirmTemplate: (v: boolean) => void
  status: Status
  setStatus: (s: Status) => void
  onUseTemplate: () => void
  onNavigate: (view: ViewId) => void
  packetStale: boolean
}

export type ProjectContextPanelProps = {
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  onNavigate: (view: ViewId) => void
  contextResult: PrepareContextResult | null
  contextBusy: boolean
  onGenerateContext: () => void
  uploadSlotCount: number
  packetReady: boolean
}

export type BuildWorkspaceProps = {
  workspace: BuildWorkspaceState
  setWorkspace: (w: BuildWorkspaceState) => void
  bridge: EuikBridge
  project: Project
  run: HandoffRun
  refreshRun: () => Promise<void>
  packet: BuildPacketResult | null
  fields: TaskPacketFields
  setFields: BuildTaskPanelProps['setFields']
  templateId: string
  setTemplateId: (id: string) => void
  onUseTemplate: () => void
  contextResult: PrepareContextResult | null
  contextBusy: boolean
  packetBusy: boolean
  packetStale: boolean
  packetDiagnostics: TaskPacketDiagnostic[]
  contextStale: boolean
  status: Status
  setStatus: (s: Status) => void
  onGenerateContext: () => void
  onBuildPacket: () => void
  onGenerate: () => void
  onPreviewPacket: () => void
  onAddReference: (sourcePath?: string) => Promise<void>
  onNavigate: (view: ViewId) => void
  inspection: OverlayInspectionSummary | null
  setInspection: (s: OverlayInspectionSummary | null) => void
  warningsAccepted: boolean
  setWarningsAccepted: (v: boolean) => void
  applied: AppliedFiles | null
  setApplied: (a: AppliedFiles | null) => void
  overlayBusy: boolean
  onPickAndInspect: () => void
  onInspectOverlayPath: (path: string) => Promise<void>
  onApplyOverlay: () => void
}
