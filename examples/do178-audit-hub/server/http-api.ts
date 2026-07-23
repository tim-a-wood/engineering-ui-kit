import { createNodeHttpHost, type HttpRoute, type NodeHttpHost } from '@engineering-ui-kit/capabilities-runtime/node'
import type { CompositionRoot } from './composition-root.js'

function route(
  method: string,
  path: string,
  operation: HttpRoute['operation'],
  outboundAdapters: string[],
): HttpRoute {
  return {
    method,
    path,
    operation,
    observedPath: {
      inboundAdapter: 'adapter.http-api',
      compositionRoot: 'do178-audit-hub',
      operation: operation.code,
      outboundAdapters,
    },
  }
}

export function createAuditHubHttpApi(root: CompositionRoot): NodeHttpHost {
  const operations = root.operations
  const routes: HttpRoute[] = [
    route('POST', '/api/workspace/select', operations.selectWorkspaceBaseline, [
      'adapter.json-snapshot-store',
      'adapter.sample-snapshot',
    ]),
    route('POST', '/api/hub/render', operations.renderAuditHub, ['adapter.json-snapshot-store']),
    route('POST', '/api/lifecycle/project', operations.projectLifecycleArea, ['adapter.json-snapshot-store']),
    route('POST', '/api/evidence/dossier', operations.queryDossier, ['adapter.json-snapshot-store']),
    route('POST', '/api/evidence/search', operations.searchEvidence, ['adapter.json-snapshot-store']),
    route('POST', '/api/evidence/traverse', operations.traverseEvidenceChain, ['adapter.json-snapshot-store']),
    route('POST', '/api/findings/manage', operations.manageFinding, ['adapter.json-snapshot-store']),
    route('POST', '/api/reviews/record', operations.recordReview, ['adapter.json-snapshot-store']),
    route('POST', '/api/packages/build', operations.buildAuditPackage, [
      'adapter.json-snapshot-store',
      'adapter.audit-package-zip',
    ]),
    route('POST', '/api/refresh/run', operations.runRefresh, [
      'adapter.filesystem',
      'adapter.git',
      'adapter.matlab-simulink',
      'adapter.spreadsheet',
      'adapter.c-source',
      'adapter.review-evidence',
      'adapter.coverage',
      'adapter.objective-profile',
      'adapter.json-snapshot-store',
    ]),
    route('POST', '/api/sample/open', operations.openSample, ['adapter.sample-snapshot']),
    route('POST', '/api/sample/reset', operations.resetSampleOverlay, ['adapter.json-snapshot-store']),
    route('POST', '/api/artifacts/access', operations.accessExternalArtifacts, ['adapter.filesystem']),
    route('POST', '/api/evidence/persist', operations.persistEvidenceState, ['adapter.json-snapshot-store']),
  ]
  return createNodeHttpHost({
    routes,
    configuration: root.configuration,
    secretResolver: root.secretResolver,
    healthPath: '/api/health',
    readinessPath: '/api/ready',
    requestBodyLimitBytes: 10 * 1024 * 1024,
    drainTimeoutMs: 10_000,
    readiness: {
      async check() {
        try {
          const snapshot = await root.service.ensureSample()
          return {
            ready: snapshot.evidence.length > 0,
            checks: [{
              name: 'sample-snapshot',
              ready: snapshot.evidence.length > 0,
              detail: `${snapshot.evidence.length} normalized evidence records`,
            }],
          }
        } catch (error) {
          return {
            ready: false,
            checks: [{
              name: 'sample-snapshot',
              ready: false,
              detail: error instanceof Error ? error.message : String(error),
            }],
          }
        }
      },
    },
  })
}
