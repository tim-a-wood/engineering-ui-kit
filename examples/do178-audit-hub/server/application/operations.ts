import type { Operation } from '@engineering-ui-kit/capabilities-runtime'
import { Outcome } from '@engineering-ui-kit/capabilities-runtime'
import type {
  OpAccessExternalArtifactsV1_0_0Operation,
  OpBuildAuditPackageV1_0_0Operation,
  OpManageFindingV1_0_0Operation,
  OpOpenSampleV1_0_0Operation,
  OpPersistEvidenceStateV1_0_0Operation,
  OpProjectLifecycleAreaV1_0_0Operation,
  OpQueryDossierV1_0_0Operation,
  OpRecordReviewV1_0_0Operation,
  OpRenderAuditHubV1_0_0Operation,
  OpResetSampleOverlayV1_0_0Operation,
  OpRunRefreshV1_0_0Operation,
  OpSearchEvidenceV1_0_0Operation,
  OpSelectWorkspaceBaselineV1_0_0Operation,
  OpTraverseEvidenceChainV1_0_0Operation,
} from '../../src/capabilities/generated/operations.g.js'
import type {
  OpAccessExternalArtifactsInput,
  OpAccessExternalArtifactsOutput,
  OpBuildAuditPackageInput,
  OpBuildAuditPackageOutput,
  OpManageFindingInput,
  OpManageFindingOutput,
  OpOpenSampleInput,
  OpOpenSampleOutput,
  OpPersistEvidenceStateInput,
  OpPersistEvidenceStateOutput,
  OpProjectLifecycleAreaInput,
  OpProjectLifecycleAreaOutput,
  OpQueryDossierInput,
  OpQueryDossierOutput,
  OpRecordReviewInput,
  OpRecordReviewOutput,
  OpRenderAuditHubInput,
  OpRenderAuditHubOutput,
  OpResetSampleOverlayInput,
  OpResetSampleOverlayOutput,
  OpRunRefreshInput,
  OpRunRefreshOutput,
  OpSearchEvidenceInput,
  OpSearchEvidenceOutput,
  OpSelectWorkspaceBaselineInput,
  OpSelectWorkspaceBaselineOutput,
  OpTraverseEvidenceChainInput,
  OpTraverseEvidenceChainOutput,
} from '../../src/capabilities/generated/types.g.js'
import { DomainRuleError, EvidenceHubService } from './evidence-hub-service.js'

type AnyOperation = Operation<unknown, unknown, unknown, unknown>

function createOperation<Input, Output>(
  code: string,
  rejectedDetail: string,
  execute: (input: Input) => Promise<Output>,
): AnyOperation {
  return {
    code,
    async execute(input) {
      try {
        return Outcome.success(await execute(input as Input))
      } catch (error) {
        if (error instanceof DomainRuleError) {
          return Outcome.rejected(error.code, error.message || rejectedDetail)
        }
        return Outcome.failed(
          `${code}.technical-failure`,
          error instanceof Error ? error.message : 'The operation failed unexpectedly.',
          true,
        )
      }
    },
  }
}

export interface AuditHubOperations {
  searchEvidence: OpSearchEvidenceV1_0_0Operation
  traverseEvidenceChain: OpTraverseEvidenceChainV1_0_0Operation
  accessExternalArtifacts: OpAccessExternalArtifactsV1_0_0Operation
  buildAuditPackage: OpBuildAuditPackageV1_0_0Operation
  manageFinding: OpManageFindingV1_0_0Operation
  openSample: OpOpenSampleV1_0_0Operation
  persistEvidenceState: OpPersistEvidenceStateV1_0_0Operation
  projectLifecycleArea: OpProjectLifecycleAreaV1_0_0Operation
  queryDossier: OpQueryDossierV1_0_0Operation
  recordReview: OpRecordReviewV1_0_0Operation
  renderAuditHub: OpRenderAuditHubV1_0_0Operation
  resetSampleOverlay: OpResetSampleOverlayV1_0_0Operation
  runRefresh: OpRunRefreshV1_0_0Operation
  selectWorkspaceBaseline: OpSelectWorkspaceBaselineV1_0_0Operation
}

export function createAuditHubOperations(service: EvidenceHubService): AuditHubOperations {
  return {
    searchEvidence: createOperation<OpSearchEvidenceInput, OpSearchEvidenceOutput>(
      'op-search-evidence',
      'A filter value is not supported.',
      async (input) => service.search({
        workspaceId: input.workspaceId,
        snapshotId: input.snapshotId,
        ...(input.query !== undefined ? { query: input.query } : {}),
        ...(input.filters && typeof input.filters === 'object' ? { filters: input.filters as Record<string, unknown> } : {}),
      }) as Promise<unknown> as Promise<OpSearchEvidenceOutput>,
    ) as OpSearchEvidenceV1_0_0Operation,

    traverseEvidenceChain: createOperation<OpTraverseEvidenceChainInput, OpTraverseEvidenceChainOutput>(
      'op-traverse-evidence-chain',
      'Traversal origin is unknown.',
      async (input) => service.traverse({
        workspaceId: input.workspaceId,
        snapshotId: input.snapshotId,
        startEvidenceId: input.startEvidenceId,
        direction: input.direction,
      }) as Promise<unknown> as Promise<OpTraverseEvidenceChainOutput>,
    ) as OpTraverseEvidenceChainV1_0_0Operation,

    accessExternalArtifacts: createOperation<OpAccessExternalArtifactsInput, OpAccessExternalArtifactsOutput>(
      'op.access-external-artifacts',
      'Configured path is not readable.',
      async (input) => service.accessExternalArtifacts(input.source) as Promise<unknown> as Promise<OpAccessExternalArtifactsOutput>,
    ) as OpAccessExternalArtifactsV1_0_0Operation,

    buildAuditPackage: createOperation<OpBuildAuditPackageInput, OpBuildAuditPackageOutput>(
      'op.build-audit-package',
      'Selected evidence is unresolved.',
      async (input) => service.buildPackage({
        workspaceId: input.workspaceId,
        snapshotId: input.snapshotId,
        ...(input.selection && typeof input.selection === 'object'
          ? { selection: input.selection as Record<string, unknown> }
          : {}),
      }) as Promise<unknown> as Promise<OpBuildAuditPackageOutput>,
    ) as OpBuildAuditPackageV1_0_0Operation,

    manageFinding: createOperation<OpManageFindingInput, OpManageFindingOutput>(
      'op.manage-finding',
      'Transition is invalid.',
      async (input) => service.manageFinding({
        workspaceId: input.workspaceId,
        action: input.action,
        ...(input.findingId !== undefined ? { findingId: input.findingId } : {}),
        ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}),
        ...(input.payload && typeof input.payload === 'object' ? { payload: input.payload as Record<string, unknown> } : {}),
      }) as Promise<unknown> as Promise<OpManageFindingOutput>,
    ) as OpManageFindingV1_0_0Operation,

    openSample: createOperation<OpOpenSampleInput, OpOpenSampleOutput>(
      'op.open-sample',
      'A configured real project must not be replaced implicitly.',
      async (input) => {
        const snapshot = await service.openSample(input.configuredProjectCount)
        return {
          baselines: snapshot.baselines,
          sampleManifest: {
            snapshotId: snapshot.snapshotId,
            contentHash: snapshot.contentHash,
            counts: snapshot.counts,
            watermark: snapshot.workspace.watermark,
          },
          workspace: snapshot.workspace,
        }
      },
    ) as OpOpenSampleV1_0_0Operation,

    persistEvidenceState: createOperation<OpPersistEvidenceStateInput, OpPersistEvidenceStateOutput>(
      'op.persist-evidence-state',
      'Staged records fail integrity validation.',
      async (input) => service.persist({
        workspaceId: input.workspaceId,
        mode: input.mode,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      }) as Promise<unknown> as Promise<OpPersistEvidenceStateOutput>,
    ) as OpPersistEvidenceStateV1_0_0Operation,

    projectLifecycleArea: createOperation<OpProjectLifecycleAreaInput, OpProjectLifecycleAreaOutput>(
      'op.project-lifecycle-area',
      'Unknown lifecycle phase or subview.',
      async (input) => service.lifecycle({
        workspaceId: input.workspaceId,
        baselineId: input.baselineId,
        ...(input.compareBaselineId !== undefined ? { compareBaselineId: input.compareBaselineId } : {}),
        phase: input.phase,
        ...(input.subview !== undefined ? { subview: input.subview } : {}),
        ...(input.filters && typeof input.filters === 'object' ? { filters: input.filters as Record<string, unknown> } : {}),
      }) as Promise<unknown> as Promise<OpProjectLifecycleAreaOutput>,
    ) as OpProjectLifecycleAreaV1_0_0Operation,

    queryDossier: createOperation<OpQueryDossierInput, OpQueryDossierOutput>(
      'op.query-dossier',
      'Evidence identity is unknown in the selected snapshot.',
      async (input) => {
        const value = await service.dossier(input.workspaceId, input.evidenceId, input.snapshotId)
        return value as unknown as OpQueryDossierOutput
      },
    ) as OpQueryDossierV1_0_0Operation,

    recordReview: createOperation<OpRecordReviewInput, OpRecordReviewOutput>(
      'op.record-review',
      'Evidence selection is empty.',
      async (input) => service.recordReview({
        workspaceId: input.workspaceId,
        evidenceIds: input.evidenceIds,
        review: input.review && typeof input.review === 'object' ? input.review as Record<string, unknown> : {},
      }) as Promise<unknown> as Promise<OpRecordReviewOutput>,
    ) as OpRecordReviewV1_0_0Operation,

    renderAuditHub: createOperation<OpRenderAuditHubInput, OpRenderAuditHubOutput>(
      'op.render-audit-hub',
      'The requested route or baseline does not exist.',
      async (input) => service.render({
        workspaceId: input.workspaceId,
        baselineId: input.baselineId,
        route: input.route,
        ...(input.selectedEvidenceId !== undefined ? { selectedEvidenceId: input.selectedEvidenceId } : {}),
      }) as Promise<unknown> as Promise<OpRenderAuditHubOutput>,
    ) as OpRenderAuditHubV1_0_0Operation,

    resetSampleOverlay: createOperation<OpResetSampleOverlayInput, OpResetSampleOverlayOutput>(
      'op.reset-sample-overlay',
      'Reset is requested for a real project.',
      async (input) => service.resetSample(input.workspaceId) as Promise<unknown> as Promise<OpResetSampleOverlayOutput>,
    ) as OpResetSampleOverlayV1_0_0Operation,

    runRefresh: createOperation<OpRunRefreshInput, OpRunRefreshOutput>(
      'op.run-refresh',
      'Normalized evidence violates graph invariants.',
      async (input) => {
        const value = await service.refresh(input.workspaceId, input.requestedBy)
        return value as unknown as OpRunRefreshOutput
      },
    ) as OpRunRefreshV1_0_0Operation,

    selectWorkspaceBaseline: createOperation<OpSelectWorkspaceBaselineInput, OpSelectWorkspaceBaselineOutput>(
      'op.select-workspace-baseline',
      'Requested workspace is unknown.',
      async (input) => service.selectWorkspace({
        ...(input.requestedWorkspaceId !== undefined ? { requestedWorkspaceId: input.requestedWorkspaceId } : {}),
        ...(input.requestedBaselineId !== undefined ? { requestedBaselineId: input.requestedBaselineId } : {}),
        ...(input.lastRealWorkspaceId !== undefined ? { lastRealWorkspaceId: input.lastRealWorkspaceId } : {}),
        realProjectCount: input.realProjectCount,
      }),
    ) as OpSelectWorkspaceBaselineV1_0_0Operation,
  }
}
