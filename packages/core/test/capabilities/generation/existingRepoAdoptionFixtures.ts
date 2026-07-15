/**
 * Test-only helpers (CAP-TEST-103/104): copy a static existing-repo fixture
 * tree (from `test/capabilities/fixtures/existing-repos/**`) into a fresh
 * temp directory (`node:fs`) so the real, Node-only `assembleGenerationPlan`
 * / `applyGenerationPlan` / `rollbackGenerationApply` (WP7-rest, frozen) can
 * be exercised against it without ever mutating the checked-in fixture.
 *
 * Also provides minimal, deployable-agnostic schema/operation/binding
 * builders used to assemble a real `GenerationPlan` for an adopted deployable
 * (CAP-CONTRACT-024/027/028), independent of any particular fixture's
 * business domain.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { GeneratedSchemaDefinition } from '../../../src/capabilities/generation/contracts.js'
import type {
  EmbeddedLibraryInboundBinding,
  HttpInboundBinding,
  OperationContract,
  UiInboundBinding,
} from '../../../src/capabilities/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Absolute path to `test/capabilities/fixtures/existing-repos`. */
export const EXISTING_REPO_FIXTURES_ROOT = path.resolve(__dirname, '../fixtures/existing-repos')

/** Recursively list every file under `directory`, as paths relative to `root` (POSIX separators). */
export function listFilesRecursively(root: string, directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(root, absolute))
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'))
    }
  }
  return files
}

/**
 * Recursively list every file under `root`, excluding the private
 * `.engineering-ui/capabilities/**` apply-machinery directory (staging
 * journal / rollback bundle) that `applyGenerationPlan` creates — that
 * directory is apply infrastructure, not part of the adopted repository's
 * own file tree.
 */
export function listRepoFiles(root: string): string[] {
  if (!fs.existsSync(root)) return []
  return listFilesRecursively(root, root).filter((relPath) => !relPath.startsWith('.engineering-ui/'))
}

/** Copy every file from a static fixture tree into a fresh directory. Never mutates `fixtureRoot`. */
export function copyFixtureTree(fixtureRoot: string, destRoot: string): void {
  fs.mkdirSync(destRoot, { recursive: true })
  for (const relPath of listFilesRecursively(fixtureRoot, fixtureRoot)) {
    const srcAbs = path.join(fixtureRoot, relPath)
    const destAbs = path.join(destRoot, relPath)
    fs.mkdirSync(path.dirname(destAbs), { recursive: true })
    fs.copyFileSync(srcAbs, destAbs)
  }
}

function sha256(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/** Content hash (sha256) for each of `relPaths`, read from under `root`. */
export function hashFilesUnder(root: string, relPaths: readonly string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const relPath of relPaths) {
    map.set(relPath, sha256(fs.readFileSync(path.join(root, relPath))))
  }
  return map
}

// ---------------------------------------------------------------------------
// Deployable-agnostic schema / operation / binding builders
// ---------------------------------------------------------------------------

/** A minimal, deployable-agnostic pair of request/response schemas for an adopted operation. */
export function buildAdoptionSchemas(): GeneratedSchemaDefinition[] {
  return [
    {
      schemaId: 'adoption.run.input',
      typeName: 'AdoptionRunInput',
      schema: { kind: 'object', properties: [{ name: 'value', schema: { kind: 'string' }, required: true }] },
    },
    {
      schemaId: 'adoption.run.output',
      typeName: 'AdoptionRunSuccess',
      schema: { kind: 'object', properties: [{ name: 'ok', schema: { kind: 'boolean' }, required: true }] },
    },
  ]
}

/** A minimal, deployable-agnostic operation contract wired to `buildAdoptionSchemas()`. */
export function buildAdoptionOperation(operationId = 'adoption.run'): OperationContract {
  return {
    schemaVersion: '1.0',
    operationId,
    version: '1.0.0',
    behavior: 'command',
    inputSchemaRef: 'adoption.run.input',
    outputSchemaRef: 'adoption.run.output',
    preconditions: [],
    postconditions: [],
    domainRejections: [],
    technicalErrors: ['unexpected'],
    sideEffects: [],
    idempotency: 'non-idempotent',
    timeoutClass: 'short',
    cancellable: false,
    artifactTypes: [],
    provenanceFields: [],
  }
}

const BINDING_COMMON = {
  schemaVersion: '1.0' as const,
  version: '1.0.0',
  inputMappings: [],
  outputMappings: [],
  validationBehavior: 'reject-with-details',
  domainRejectionBehavior: 'return-typed',
  technicalFailureBehavior: 'safe-message-only',
  timeoutBehavior: 'return-timed-out',
  cancellationBehavior: 'propagate',
  retryBehavior: 'none',
  duplicateSubmissionBehavior: 'none',
  exposure: 'protected' as const,
  generatedTargets: [],
  approvalState: 'approved',
}

/** A minimal `ui` inbound binding, for a browser/UI deployable adopted from an existing repository. */
export function buildUiBinding(
  deployableId: string,
  projectId: string,
  overrides: Partial<UiInboundBinding> = {},
): UiInboundBinding {
  return {
    ...BINDING_COMMON,
    projectId,
    deployableId,
    bindingId: 'binding.adoption.run.ui',
    operationId: 'adoption.run',
    operationVersion: '1.0.0',
    kind: 'ui',
    transport: 'browser-local',
    trigger: 'activate',
    ...overrides,
  }
}

/** A minimal `http` inbound binding, for an http-api deployable adopted from an existing repository. */
export function buildHttpBinding(
  deployableId: string,
  projectId: string,
  overrides: Partial<HttpInboundBinding> = {},
): HttpInboundBinding {
  return {
    ...BINDING_COMMON,
    projectId,
    deployableId,
    bindingId: 'binding.adoption.run.http',
    operationId: 'adoption.run',
    operationVersion: '1.0.0',
    kind: 'http',
    method: 'POST',
    path: '/adoption/run',
    ...overrides,
  }
}

/** A minimal `embedded-library` inbound binding, for an embedded-library deployable adopted from an existing repository. */
export function buildEmbeddedLibraryBinding(
  deployableId: string,
  projectId: string,
  overrides: Partial<EmbeddedLibraryInboundBinding> = {},
): EmbeddedLibraryInboundBinding {
  return {
    ...BINDING_COMMON,
    projectId,
    deployableId,
    bindingId: 'binding.adoption.run.embedded',
    operationId: 'adoption.run',
    operationVersion: '1.0.0',
    kind: 'embedded-library',
    exportedCallable: 'adoption_run',
    reason: 'adopted from an existing module entry point',
    ...overrides,
  }
}
