import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  LifecycleContainer,
  MapConfigurationReader,
  createToken,
  type ConfigurationReader,
  type Scope,
  type SecretResolver,
} from '@engineering-ui-kit/capabilities-runtime'
import { AuditPackageAdapter } from './adapters/audit-package-adapter.js'
import { CSourceAdapter } from './adapters/c-source-adapter.js'
import { CoverageAdapter } from './adapters/coverage-adapter.js'
import { FilesystemAdapter } from './adapters/filesystem-adapter.js'
import { GitAdapter } from './adapters/git-adapter.js'
import { JsonSnapshotStore } from './adapters/json-snapshot-store.js'
import { MatlabSimulinkAdapter } from './adapters/matlab-simulink-adapter.js'
import { ObjectiveProfileAdapter } from './adapters/objective-profile-adapter.js'
import { ReviewEvidenceAdapter } from './adapters/review-evidence-adapter.js'
import { SampleSnapshotAdapter } from './adapters/sample-snapshot-adapter.js'
import { SpreadsheetAdapter } from './adapters/spreadsheet-adapter.js'
import { EvidenceHubService } from './application/evidence-hub-service.js'
import { createAuditHubOperations, type AuditHubOperations } from './application/operations.js'
import type {
  ArtifactCatalogPort,
  AuditPackageWriterPort,
  EvidenceSourcePort,
  RevisionSourcePort,
  SampleSnapshotPort,
  SnapshotStorePort,
} from './ports/outbound.js'

export const CONFIGURATION_TOKEN = createToken<ConfigurationReader>('do178-audit-hub/configuration')
export const SECRET_RESOLVER_TOKEN = createToken<SecretResolver>('do178-audit-hub/secret-resolver')
export const SNAPSHOT_STORE_TOKEN = createToken<SnapshotStorePort>('do178-audit-hub/port.snapshot-store')
export const SAMPLE_SNAPSHOT_TOKEN = createToken<SampleSnapshotPort>('do178-audit-hub/adapter.sample-snapshot')
export const ARTIFACT_CATALOG_TOKEN = createToken<ArtifactCatalogPort>('do178-audit-hub/port.artifact-catalog')
export const REVISION_SOURCE_TOKEN = createToken<RevisionSourcePort>('do178-audit-hub/port.revision-source')
export const EVIDENCE_SOURCE_PORTS_TOKEN = createToken<EvidenceSourcePort[]>('do178-audit-hub/ports.evidence-sources')
export const PACKAGE_WRITER_TOKEN = createToken<AuditPackageWriterPort>('do178-audit-hub/audit-package-writer')
export const HUB_SERVICE_TOKEN = createToken<EvidenceHubService>('do178-audit-hub/application-service')
export const OPERATIONS_TOKEN = createToken<AuditHubOperations>('do178-audit-hub/operations')

export interface CompositionRoot {
  container: LifecycleContainer
  rootScope: Scope
  service: EvidenceHubService
  operations: AuditHubOperations
  configuration: ConfigurationReader
  secretResolver: SecretResolver
  dataDirectory: string
}

export interface CompositionOptions {
  projectRoot?: string
  dataDirectory?: string
}

function noSecrets(): SecretResolver {
  return {
    resolve(reference) {
      throw new Error(`No secret is configured for opaque reference "${reference.ref}".`)
    },
  }
}

export function createCompositionRoot(options: CompositionOptions = {}): CompositionRoot {
  const projectRoot = resolve(options.projectRoot ?? process.cwd())
  const dataDirectory = resolve(
    options.dataDirectory
      ?? process.env.DO178_AUDIT_HUB_DATA_DIR
      ?? join(homedir(), '.do178-audit-hub'),
  )
  const container = new LifecycleContainer()

  container.register<ConfigurationReader>({
    token: CONFIGURATION_TOKEN,
    lifecycle: 'singleton',
    factory: () => new MapConfigurationReader({
      SERVICE_NAME: 'do178-audit-hub',
      DATA_DIRECTORY: dataDirectory,
      PROJECT_ROOT: projectRoot,
    }),
  })
  container.register<SecretResolver>({
    token: SECRET_RESOLVER_TOKEN,
    lifecycle: 'singleton',
    factory: noSecrets,
  })
  container.register<SnapshotStorePort>({
    token: SNAPSHOT_STORE_TOKEN,
    lifecycle: 'singleton',
    factory: () => new JsonSnapshotStore(dataDirectory),
  })
  container.register<SampleSnapshotPort>({
    token: SAMPLE_SNAPSHOT_TOKEN,
    lifecycle: 'singleton',
    factory: () => new SampleSnapshotAdapter(join(projectRoot, 'sample-data', 'aeronav-2.4.0.json')),
  })
  container.register<ArtifactCatalogPort>({
    token: ARTIFACT_CATALOG_TOKEN,
    lifecycle: 'singleton',
    factory: () => new FilesystemAdapter(),
  })
  container.register<RevisionSourcePort>({
    token: REVISION_SOURCE_TOKEN,
    lifecycle: 'singleton',
    factory: () => new GitAdapter(),
  })
  container.register<EvidenceSourcePort[]>({
    token: EVIDENCE_SOURCE_PORTS_TOKEN,
    lifecycle: 'singleton',
    factory: () => [
      new MatlabSimulinkAdapter(join(projectRoot, 'server', 'matlab')),
      new SpreadsheetAdapter(),
      new CSourceAdapter(),
      new ReviewEvidenceAdapter(),
      new CoverageAdapter(),
      new ObjectiveProfileAdapter(),
    ],
  })
  container.register<AuditPackageWriterPort>({
    token: PACKAGE_WRITER_TOKEN,
    lifecycle: 'singleton',
    factory: () => new AuditPackageAdapter(join(dataDirectory, 'packages')),
  })
  container.register<EvidenceHubService>({
    token: HUB_SERVICE_TOKEN,
    lifecycle: 'singleton',
    factory: (scope) => new EvidenceHubService({
      store: scope.resolve(SNAPSHOT_STORE_TOKEN),
      sample: scope.resolve(SAMPLE_SNAPSHOT_TOKEN),
      artifactCatalog: scope.resolve(ARTIFACT_CATALOG_TOKEN),
      revisionSource: scope.resolve(REVISION_SOURCE_TOKEN),
      evidenceSources: scope.resolve(EVIDENCE_SOURCE_PORTS_TOKEN),
      packageWriter: scope.resolve(PACKAGE_WRITER_TOKEN),
    }),
  })
  container.register<AuditHubOperations>({
    token: OPERATIONS_TOKEN,
    lifecycle: 'singleton',
    factory: (scope) => createAuditHubOperations(scope.resolve(HUB_SERVICE_TOKEN)),
  })

  const rootScope = container.createRootScope('do178-audit-hub')
  return {
    container,
    rootScope,
    service: rootScope.resolve(HUB_SERVICE_TOKEN),
    operations: rootScope.resolve(OPERATIONS_TOKEN),
    configuration: rootScope.resolve(CONFIGURATION_TOKEN),
    secretResolver: rootScope.resolve(SECRET_RESOLVER_TOKEN),
    dataDirectory,
  }
}
