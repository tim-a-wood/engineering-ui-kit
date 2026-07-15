/**
 * Shared fixtures for the WP2 generation-lane test suites (CAP-TEST-048..053).
 */
import { canonicalRecordHash } from '../../../src/capabilities/hash.js'
import type { ArchitectureModuleDefinition, DeployableKind, ReferenceArchitectureProfile } from '../../../src/capabilities/types.js'
import type { RepositoryEvidence } from '../../../src/capabilities/generation/repositoryDiscovery.js'

/** A CAP-CONTRACT-023 profile with a genuinely correct (self-consistent) contentHash. */
export function buildValidProfile(
  overrides: Partial<Omit<ReferenceArchitectureProfile, 'contentHash'>> = {},
): ReferenceArchitectureProfile {
  const rest: Omit<ReferenceArchitectureProfile, 'contentHash'> = {
    schemaVersion: '1.0',
    profileId: 'hexagonal-ports-and-adapters',
    profileVersion: '1.0.0',
    supportedRuntimeLanguages: [
      { language: 'typescript', versionRange: '>=22' },
      { language: 'python', versionRange: '>=3.11' },
    ],
    supportedHostKinds: ['browser', 'electron-main', 'http-api', 'cli', 'worker', 'embedded-library'] as DeployableKind[],
    contractFormat: 'json-schema-2020-12',
    httpContractFormat: 'openapi-3.1',
    generatedDirectoryPolicy: ['do-not-edit', 'committed'],
    editableDirectoryPolicy: ['project-owned'],
    runtimePackageCoordinates: [
      {
        language: 'typescript',
        packageName: '@engineering-ui-kit/capabilities-runtime',
        version: '0.1.0',
        pinnedVersionPolicy: 'exact',
      },
    ],
    lifecyclePolicy: 'singleton|request-job|transient',
    telemetryPolicy: 'json-console-default',
    secretPolicy: 'references-only',
    authorizationPolicy: 'protected-deny-by-default',
    persistencePolicy: 'ports-with-in-memory-test-adapter',
    errorPolicy: 'typed-outcomes',
    generatorVersion: '0.1.0',
    generatorCompatibilityRange: '>=0.1.0 <0.2.0',
    ...overrides,
  }
  return { ...rest, contentHash: canonicalRecordHash(rest) }
}

/** No file/manifest/CI evidence at all: a genuinely new, empty repository. */
export const GREENFIELD_EVIDENCE: RepositoryEvidence = {
  repositoryId: 'repo.greenfield',
  files: [],
  manifests: [],
  ciConfigs: [],
}

/** An existing repository with a React frontend, an Express HTTP API, and CI evidence. */
export const EXISTING_REPO_EVIDENCE: RepositoryEvidence = {
  repositoryId: 'repo.existing',
  files: [
    { path: 'package.json' },
    { path: 'package-lock.json' },
    { path: 'src/index.ts' },
    { path: 'src/app.tsx' },
    { path: 'src/composition/existing.ts' },
    { path: 'src/server/routes.ts' },
    { path: 'test/app.test.ts' },
    { path: '.github/workflows/ci.yml' },
  ],
  manifests: [
    {
      path: 'package.json',
      content: {
        name: 'existing-app',
        main: 'src/index.ts',
        dependencies: { react: '19.0.0', express: '5.0.0' },
        devDependencies: { typescript: '5.8.0' },
        scripts: { build: 'tsc', test: 'vitest run' },
      },
    },
  ],
  ciConfigs: [{ path: '.github/workflows/ci.yml', operatingSystems: ['ubuntu-latest', 'windows-latest'] }],
}

export const EXISTING_REPO_MODULE_DEFINITIONS: ArchitectureModuleDefinition[] = [
  { moduleId: 'mod.experience.dashboard', name: 'Dashboard', moduleType: 'experience', responsibility: 'renders the dashboard UI' },
  { moduleId: 'mod.domain.orders', name: 'Orders', moduleType: 'domain', responsibility: 'order domain logic' },
]

export const EXISTING_REPO_MODULE_IDS = EXISTING_REPO_MODULE_DEFINITIONS.map((module) => module.moduleId)
