import { createHash } from 'node:crypto'
import { chmod, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import type { Context } from '@engineering-ui-kit/capabilities-runtime'
import { createNodeContext } from '@engineering-ui-kit/capabilities-runtime/node'
import { afterEach, describe, expect, test } from 'vitest'
import { CSourceAdapter } from '../adapters/c-source-adapter.js'
import { CoverageAdapter } from '../adapters/coverage-adapter.js'
import { FilesystemAdapter } from '../adapters/filesystem-adapter.js'
import { MatlabSimulinkAdapter } from '../adapters/matlab-simulink-adapter.js'
import { ObjectiveProfileAdapter } from '../adapters/objective-profile-adapter.js'
import { ReviewEvidenceAdapter } from '../adapters/review-evidence-adapter.js'
import { SpreadsheetAdapter } from '../adapters/spreadsheet-adapter.js'
import { createCompositionRoot, type CompositionRoot } from '../composition-root.js'
import { createAuditHubHttpApi } from '../http-api.js'
import { createStaticHost } from '../static-host.js'

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CONNECTED_FIXTURE = join(PROJECT_ROOT, 'test-fixtures', 'connected-project')
const temporaryDirectories: string[] = []
const roots: CompositionRoot[] = []

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `do178-audit-hub-${label}-`))
  temporaryDirectories.push(directory)
  return directory
}

async function composition(label: string): Promise<CompositionRoot> {
  const dataDirectory = await temporaryDirectory(label)
  const root = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
  roots.push(root)
  return root
}

async function publishConnected(root: CompositionRoot) {
  const configuration = await root.service.configureWorkspace({
    name: 'Connected integration fixture',
    softwareLevel: 'Level B',
    do331Applicable: true,
    baselineId: 'integration-baseline',
    objectiveProfilePath: join(CONNECTED_FIXTURE, 'certification', 'objective-profile.json'),
    sourceRoots: [{
      id: 'fixture-root',
      label: 'Fixture root',
      rootPath: CONNECTED_FIXTURE,
      enabled: true,
    }],
    matlab: { enabled: false },
  })
  const refresh = await root.service.refresh(configuration.id, 'integration-test')
  expect(refresh.status).toBe('published')
  expect(refresh.diagnostics.some((item) => item.severity === 'fatal')).toBe(false)
  return { configuration, refresh }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => root.rootScope.dispose()))
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })))
})

describe('DO-178C Audit Hub composition', () => {
  test('keeps every evidence integration actor-specific and aligned with the capability catalog', async () => {
    const catalog = JSON.parse(await readFile(
      join(PROJECT_ROOT, 'capabilities', 'adapter-catalog.json'),
      'utf8',
    )) as {
      adapters: Array<{
        id: string
        moduleId: string
        drivenActorId: string
        implements: string[]
      }>
    }
    const sourceAdapters = [
      new MatlabSimulinkAdapter(join(PROJECT_ROOT, 'server', 'matlab')),
      new SpreadsheetAdapter(),
      new CSourceAdapter(),
      new ReviewEvidenceAdapter(),
      new CoverageAdapter(),
      new ObjectiveProfileAdapter(),
    ]

    for (const adapter of sourceAdapters) {
      const definition = catalog.adapters.find((candidate) => candidate.id === adapter.id)
      expect(definition, `${adapter.id} is missing from the capability catalog`).toBeDefined()
      expect(definition?.moduleId).toMatch(/^mod\.adapter\./)
      expect(definition?.drivenActorId).toMatch(/^ext\./)
      expect(definition?.implements).toEqual([...adapter.implementedPortIds])
    }
  })

  test('opens the deterministic sample when no project is configured', async () => {
    const root = await composition('sample')
    const selection = await root.service.selectWorkspace({ realProjectCount: 0 })
    const snapshot = await root.service.mergedSnapshot(selection.workspaceId, selection.snapshotId)

    expect(selection.workspaceKind).toBe('sample')
    expect(snapshot.workspace.watermark).toMatch(/not certification evidence/i)
    expect(snapshot.evidence).toHaveLength(508)
    expect(snapshot.findings).toHaveLength(12)
    expect(snapshot.reviews).toHaveLength(45)
    expect(snapshot.canonicalChain).toHaveLength(8)
    expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('publishes filesystem, Git, spreadsheet, C/H, review, and coverage evidence as one graph', async () => {
    const root = await composition('connected')
    const { configuration } = await publishConnected(root)
    const snapshot = await root.service.mergedSnapshot(configuration.id)
    const byId = new Map(snapshot.evidence.map((record) => [record.id, record]))

    expect(snapshot.workspace.kind).toBe('real')
    expect(snapshot.evidence).toHaveLength(12)
    expect(snapshot.reviews).toHaveLength(2)
    expect(snapshot.reviews.find((review) => review.id === 'REV-DEMO-001')?.phase).toBe('requirements')
    expect(snapshot.reviews.find((review) => review.id === 'REV-DEMO-002')?.phase).toBe('implementation')
    expect(snapshot.coverage).toHaveLength(1)
    expect(byId.get('SYS-DEMO-001')?.downstream).toContain('SWR-HLR-DEMO-001')
    expect(byId.get('src/lateral_guidance.c::limit_bank_command')?.downstream)
      .toContain('TC-DEMO-BOUNDARY-001')
    expect(snapshot.canonicalChain).toEqual([
      'SYS-DEMO-001',
      'SWR-HLR-DEMO-001',
      'SWR-LLR-DEMO-001',
      'src/lateral_guidance.c::limit_bank_command',
      'TC-DEMO-BOUNDARY-001',
      'VR-DEMO-001',
      'OBJ-DEMO-VER-001',
    ])
    expect(new Set(snapshot.evidence.map((record) => record.sourceKind)))
      .toEqual(new Set(['CSV', 'C', 'H', 'COVERAGE', 'CONFIG']))
  })

  test('persists the selected real project and immutable snapshot across a new composition root', async () => {
    const dataDirectory = await temporaryDirectory('restart')
    const first = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
    roots.push(first)
    const { configuration, refresh } = await publishConnected(first)

    const second = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
    roots.push(second)
    const selection = await second.service.selectWorkspace({ realProjectCount: 0 })
    const snapshot = await second.service.currentSnapshot(selection.workspaceId)

    expect(selection.workspaceId).toBe(configuration.id)
    expect(selection.snapshotId).toBe(refresh.snapshotId)
    expect(snapshot.snapshotId).toBe(refresh.snapshotId)
    expect(snapshot.evidence).toHaveLength(12)
  })

  test('keeps the last published snapshot active when a refresh candidate is empty', async () => {
    const rootDirectory = await temporaryDirectory('fallback')
    const projectDirectory = join(rootDirectory, 'project')
    const dataDirectory = join(rootDirectory, 'data')
    await mkdir(projectDirectory, { recursive: true })
    const evidencePath = join(projectDirectory, 'requirements.csv')
    await writeFile(
      evidencePath,
      'ID,Title,Type,Status,Revision\nREQ-ONE,First requirement,hlr,approved,1\n',
      'utf8',
    )
    const root = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
    roots.push(root)
    const configuration = await root.service.configureWorkspace({
      name: 'Failure isolation fixture',
      softwareLevel: 'Level C',
      baselineId: 'working',
      sourceRoots: [{ rootPath: projectDirectory }],
      matlab: { enabled: false },
    })
    const published = await root.service.refresh(configuration.id, 'test')
    expect(published.status).toBe('published')
    const previous = await root.service.currentSnapshot(configuration.id)

    await unlink(evidencePath)
    const rejected = await root.service.refresh(configuration.id, 'test')
    const stillCurrent = await root.service.currentSnapshot(configuration.id)

    expect(rejected.status).toBe('rejected')
    expect(rejected.diagnostics.some((item) => item.code === 'empty-normalized-snapshot')).toBe(true)
    expect(stillCurrent.snapshotId).toBe(previous.snapshotId)
    expect(stillCurrent.evidence.map((record) => record.id)).toEqual(['REQ-ONE'])
  })

  test('rejects a candidate when an explicitly configured objective profile is invalid', async () => {
    const root = await composition('invalid-objectives')
    const invalidProfileDirectory = await temporaryDirectory('invalid-objective-file')
    const invalidProfilePath = join(invalidProfileDirectory, 'objectives.json')
    await writeFile(invalidProfilePath, '{"objectives": "not-an-array"}', 'utf8')
    const configuration = await root.service.configureWorkspace({
      name: 'Invalid objective profile fixture',
      softwareLevel: 'Level B',
      baselineId: 'working',
      objectiveProfilePath: invalidProfilePath,
      sourceRoots: [{ rootPath: CONNECTED_FIXTURE }],
      matlab: { enabled: false },
    })
    const refresh = await root.service.refresh(configuration.id, 'test')

    expect(refresh.status).toBe('rejected')
    expect(refresh.diagnostics).toContainEqual(expect.objectContaining({
      adapterId: 'adapter.objective-profile',
      severity: 'fatal',
      code: 'objective-profile-invalid',
    }))
    await expect(root.service.currentSnapshot(configuration.id)).rejects.toThrow(/not published/i)
  })

  test('persists reviews and finding transitions through the application operations', async () => {
    const dataDirectory = await temporaryDirectory('overlay')
    const first = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
    roots.push(first)
    const sample = await first.service.ensureSample()

    await first.service.recordReview({
      workspaceId: sample.workspace.id,
      evidenceIds: ['SYS-LAT-014'],
      review: {
        reviewer: 'Independent reviewer',
        method: 'inspection',
        result: 'passed',
        comments: 'All review objectives satisfied.',
        date: '2026-07-23',
        revision: 'Rev 4',
        independent: true,
        phase: 'requirements',
      },
    })
    await first.service.manageFinding({
      workspaceId: sample.workspace.id,
      findingId: 'FND-012',
      action: 'reverified',
      payload: {
        status: 'reverified',
        reverificationEvidence: ['VR-RESULT-2026-052'],
        independentVerifier: 'Independent reviewer',
        actor: 'Independent reviewer',
      },
    })
    await first.service.manageFinding({
      workspaceId: sample.workspace.id,
      findingId: 'FND-012',
      action: 'closed',
      payload: { status: 'closed', actor: 'Independent reviewer' },
    })

    const second = createCompositionRoot({ projectRoot: PROJECT_ROOT, dataDirectory })
    roots.push(second)
    const merged = await second.service.mergedSnapshot(sample.workspace.id)
    expect(merged.reviews).toHaveLength(46)
    expect(merged.findings.find((finding) => finding.id === 'FND-012')?.status).toBe('closed')
    expect(merged.activity?.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'review-recorded',
      'finding-transition',
    ]))
  })

  test('builds a deterministic ZIP package with manifest, evidence, findings, and reviews', async () => {
    const root = await composition('package')
    const { configuration } = await publishConnected(root)
    const snapshot = await root.service.currentSnapshot(configuration.id)
    const selection = {
      workspaceId: configuration.id,
      snapshotId: snapshot.snapshotId,
      selection: {
        name: 'Integration audit package',
        evidenceIds: snapshot.evidence.map((record) => record.id),
        phaseIds: ['planning', 'requirements', 'design', 'implementation', 'verification', 'cm', 'qa', 'certification'],
        includeFindings: true,
        includeReviews: true,
      },
    }
    const first = await root.service.buildPackage(selection)
    const second = await root.service.buildPackage(selection)
    const firstDownload = first.download as { path: string; url: string; contentHash: string }
    const secondDownload = second.download as { path: string; url: string; contentHash: string }

    expect(second.packageId).toBe(first.packageId)
    expect(secondDownload.contentHash).toBe(firstDownload.contentHash)
    const bytes = await readFile(firstDownload.path)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(firstDownload.contentHash)
    const zip = new AdmZip(bytes)
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([
      'README.txt',
      'evidence.json',
      'findings.json',
      'manifest.json',
      'reviews.json',
    ])
    const manifest = JSON.parse(zip.readAsText('manifest.json')) as {
      counts: { evidence: number; reviews: number }
      syntheticSample: boolean
    }
    expect(manifest.counts).toMatchObject({ evidence: 12, reviews: 2 })
    expect(manifest.syntheticSample).toBe(false)

    const sample = await root.service.ensureSample()
    const sampleResult = await root.service.buildPackage({
      workspaceId: sample.workspace.id,
      snapshotId: sample.snapshotId,
      selection: {
        name: 'Complete sample lifecycle package',
        evidenceIds: sample.evidence.map((record) => record.id),
        phaseIds: ['planning', 'requirements', 'design', 'implementation', 'verification', 'cm', 'qa', 'certification'],
        includeFindings: true,
        includeReviews: true,
      },
    })
    expect((sampleResult.manifest as { counts: Record<string, number> }).counts).toEqual({
      evidence: 508,
      findings: 12,
      reviews: 45,
    })
    const sampleDownload = sampleResult.download as { path: string }
    await expect(readFile(sampleDownload.path)).resolves.toBeInstanceOf(Buffer)
    await root.service.resetSample(sample.workspace.id)
    await expect(readFile(sampleDownload.path)).rejects.toMatchObject({ code: 'ENOENT' })

    const distDirectory = await temporaryDirectory('download-dist')
    await writeFile(join(distDirectory, 'index.html'), '<!doctype html><title>test</title>', 'utf8')
    const host = createStaticHost({
      distDirectory,
      apiPort: 9,
      packageDirectory: join(root.dataDirectory, 'packages'),
    })
    await new Promise<void>((resolveStart, rejectStart) => {
      host.once('error', rejectStart)
      host.listen(0, '127.0.0.1', () => {
        host.removeListener('error', rejectStart)
        resolveStart()
      })
    })
    try {
      const port = (host.address() as AddressInfo).port
      const download = await fetch(`http://127.0.0.1:${port}${firstDownload.url}`)
      const invalid = await fetch(`http://127.0.0.1:${port}/api/packages/download/%2e%2e%2Fsecret.zip`)
      expect(download.status).toBe(200)
      expect(download.headers.get('content-type')).toBe('application/zip')
      expect(download.headers.get('content-disposition')).toContain(`${first.packageId}.zip`)
      expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes)
      expect(invalid.status).toBe(400)
    } finally {
      await new Promise<void>((resolveClose) => host.close(() => resolveClose()))
    }
  })

  test('serves readiness and capability operations through the HTTP adapter', async () => {
    const root = await composition('http')
    const api = createAuditHubHttpApi(root)
    const bound = await api.start(0, '127.0.0.1')
    try {
      const readiness = await fetch(`http://127.0.0.1:${bound.port}/api/ready`).then((response) => response.json()) as {
        ready: boolean
      }
      const selection = await fetch(`http://127.0.0.1:${bound.port}/api/workspace/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ realProjectCount: 0 }),
      }).then((response) => response.json()) as {
        kind: string
        value: { workspaceKind: string; snapshotId: string }
      }

      expect(readiness.ready).toBe(true)
      expect(selection.kind).toBe('success')
      expect(selection.value.workspaceKind).toBe('sample')
      expect(selection.value.snapshotId).toBe('sample-aeronav-2.4.0')
    } finally {
      await api.stop()
    }
  })

  test('executes every approved capability operation through the composition root', async () => {
    const root = await composition('all-operations')
    const context = createNodeContext({
      correlationId: 'all-operations-test',
      configuration: root.configuration,
      secretResolver: root.secretResolver,
    })
    const execute = async <T>(
      operation: unknown,
      input: unknown,
    ): Promise<T> => {
      const executable = operation as {
        execute(input: unknown, context: Context): unknown | Promise<unknown>
      }
      const outcome = await executable.execute(input, context) as { kind: string; value?: T; code?: string }
      expect(outcome.kind, outcome.code).toBe('success')
      return outcome.value as T
    }
    const operations = root.operations
    expect(new Set(Object.values(operations).map((operation) => operation.code)).size).toBe(14)

    await execute(operations.openSample, { configuredProjectCount: 0 })
    const sampleSelection = await execute<{ workspaceId: string; snapshotId: string; baselineId: string }>(
      operations.selectWorkspaceBaseline,
      { realProjectCount: 0, requestedWorkspaceId: 'sample-aeronav' },
    )
    await execute(operations.renderAuditHub, {
      workspaceId: sampleSelection.workspaceId,
      snapshotId: sampleSelection.snapshotId,
      baselineId: sampleSelection.baselineId,
      route: '/overview',
    })
    await execute(operations.projectLifecycleArea, {
      workspaceId: sampleSelection.workspaceId,
      baselineId: sampleSelection.baselineId,
      phase: 'requirements',
      subview: 'evidence',
    })
    await execute(operations.queryDossier, {
      workspaceId: sampleSelection.workspaceId,
      snapshotId: sampleSelection.snapshotId,
      evidenceId: 'SYS-LAT-014',
    })
    await execute(operations.searchEvidence, {
      workspaceId: sampleSelection.workspaceId,
      snapshotId: sampleSelection.snapshotId,
      query: 'SYS-LAT-014',
    })
    await execute(operations.traverseEvidenceChain, {
      workspaceId: sampleSelection.workspaceId,
      snapshotId: sampleSelection.snapshotId,
      startEvidenceId: 'SYS-LAT-014',
      direction: 'downstream',
    })
    await execute(operations.accessExternalArtifacts, {
      operation: 'discover',
      source: {
        id: 'fixture-root',
        label: 'Fixture root',
        rootPath: CONNECTED_FIXTURE,
        enabled: true,
      },
    })
    const persisted = await execute<{ workspaceState: { id: string } }>(
      operations.persistEvidenceState,
      {
        workspaceId: '',
        mode: 'configure-workspace',
        payload: {
          name: 'All operations fixture',
          softwareLevel: 'Level B',
          do331Applicable: true,
          baselineId: 'integration-baseline',
          objectiveProfilePath: join(CONNECTED_FIXTURE, 'certification', 'objective-profile.json'),
          sourceRoots: [{
            id: 'fixture-root',
            label: 'Fixture root',
            rootPath: CONNECTED_FIXTURE,
            enabled: true,
          }],
          matlab: { enabled: false },
        },
      },
    )
    const refreshed = await execute<{ snapshotId: string }>(operations.runRefresh, {
      workspaceId: persisted.workspaceState.id,
      requestedBy: 'operation test',
      sourceConfiguration: {},
    })
    const realSnapshot = await root.service.currentSnapshot(
      persisted.workspaceState.id,
      refreshed.snapshotId,
    )
    await execute(operations.recordReview, {
      workspaceId: persisted.workspaceState.id,
      evidenceIds: ['SWR-LLR-DEMO-001'],
      review: {
        reviewer: 'Independent reviewer',
        method: 'inspection',
        result: 'passed',
        date: '2026-07-23',
        revision: '7',
        independent: true,
        phase: 'requirements',
      },
    })
    await execute(operations.buildAuditPackage, {
      workspaceId: persisted.workspaceState.id,
      snapshotId: realSnapshot.snapshotId,
      selection: {
        name: 'All operations package',
        evidenceIds: realSnapshot.evidence.map((record) => record.id),
        phaseIds: ['planning', 'requirements', 'design', 'implementation', 'verification', 'cm', 'qa', 'certification'],
        includeFindings: true,
        includeReviews: true,
      },
    })
    await execute(operations.manageFinding, {
      workspaceId: sampleSelection.workspaceId,
      findingId: 'FND-012',
      action: 'reverified',
      payload: {
        status: 'reverified',
        reverificationEvidence: ['VR-RESULT-2026-052'],
        independentVerifier: 'Independent reviewer',
        actor: 'Independent reviewer',
      },
    })
    await execute(operations.resetSampleOverlay, {
      workspaceId: sampleSelection.workspaceId,
      requestedBy: 'operation test',
    })
  })
})

describe('MATLAB/Simulink adapter isolation', () => {
  test('uses a normalized sidecar without treating the sidecar as an independent artifact', async () => {
    const directory = await temporaryDirectory('matlab-sidecar')
    const artifactPath = join(directory, 'requirements.slreqx')
    await writeFile(artifactPath, 'placeholder proprietary container', 'utf8')
    await writeFile(`${artifactPath}.audit-hub.json`, JSON.stringify({
      evidence: [{
        id: 'MATLAB-REQ-001',
        title: 'Normalized MATLAB requirement',
        type: 'hlr',
        phase: 'requirements',
        status: 'approved',
        revision: '1',
        sourcePath: 'requirements.slreqx',
        sourceKind: 'SLREQX',
        hash: 'a'.repeat(64),
        modified: '2026-07-23T00:00:00.000Z',
        baseline: 'working',
        upstream: [],
        downstream: [],
        reviewState: 'approved',
        findingIds: [],
        provenance: 'normalized sidecar',
        changeMark: 'unchanged',
        meta: {},
      }],
    }), 'utf8')

    const catalog = await new FilesystemAdapter().discover({
      id: 'matlab-root',
      label: 'MATLAB fixture',
      rootPath: directory,
      enabled: true,
    })
    expect(catalog.artifacts.map((artifact) => artifact.relativePath)).toEqual(['requirements.slreqx'])
    const adapter = new MatlabSimulinkAdapter(join(PROJECT_ROOT, 'server', 'matlab'))
    const batch = await adapter.extract({
      workspace: {
        id: 'workspace',
        name: 'MATLAB fixture',
        kind: 'real',
        softwareLevel: 'Level B',
        do331Applicable: true,
        baselineId: 'working',
        sourceRoots: [],
        matlab: { enabled: false },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      },
      artifacts: catalog.artifacts,
      baselineId: 'working',
    })

    expect(batch.evidence.map((record) => record.id)).toEqual(['MATLAB-REQ-001'])
    expect(batch.diagnostics).toEqual([])
    expect(batch.provenance[0]?.sourcePath).toBe('requirements.slreqx')
  })

  test('invokes a configured extractor process and normalizes its authoritative artifact provenance', async () => {
    const directory = await temporaryDirectory('matlab-process')
    const artifactPath = join(directory, 'model.slx')
    const executablePath = join(directory, 'matlab-contract-stub.cjs')
    await writeFile(artifactPath, 'placeholder proprietary container', 'utf8')
    await writeFile(executablePath, `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const expression = process.argv.at(-1)
const match = expression.match(/extract_audit_hub\\('([^']*)','([^']*)'\\)/)
if (!match) process.exit(2)
const inputPath = match[1]
const outputPath = match[2]
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify({
  adapterId: 'adapter.matlab-simulink',
  evidence: [{
    id: 'MATLAB-MODEL-001',
    title: 'Extracted model element',
    type: 'model-element',
    phase: 'design',
    status: 'approved',
    revision: 'extracted',
    sourcePath: inputPath,
    sourceKind: 'SLX',
    hash: '0'.repeat(64),
    modified: '2026-01-01T00:00:00.000Z',
    baseline: 'candidate',
    upstream: [],
    downstream: [],
    reviewState: 'approved',
    findingIds: [],
    provenance: 'extractor output',
    changeMark: 'unchanged',
    meta: {}
  }],
  relationships: [],
  reviews: [],
  findings: [],
  coverage: [],
  changes: [],
  diagnostics: [],
  provenance: []
}))
`, 'utf8')
    await chmod(executablePath, 0o755)

    const catalog = await new FilesystemAdapter().discover({
      id: 'matlab-root',
      label: 'MATLAB process fixture',
      rootPath: directory,
      enabled: true,
    })
    const artifact = catalog.artifacts.find((candidate) => candidate.relativePath === 'model.slx')
    expect(artifact).toBeDefined()
    const batch = await new MatlabSimulinkAdapter(join(PROJECT_ROOT, 'server', 'matlab')).extract({
      workspace: {
        id: 'workspace',
        name: 'MATLAB process fixture',
        kind: 'real',
        softwareLevel: 'Level B',
        do331Applicable: true,
        baselineId: 'working',
        sourceRoots: [],
        matlab: {
          enabled: true,
          executable: executablePath,
          timeoutMs: 5_000,
        },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      },
      artifacts: artifact ? [artifact] : [],
      baselineId: 'working',
    })

    expect(batch.diagnostics).toEqual([])
    expect(batch.evidence[0]).toMatchObject({
      id: 'MATLAB-MODEL-001',
      revision: artifact?.hash.slice(0, 12),
      sourcePath: 'model.slx',
      sourceKind: 'SLX',
      hash: artifact?.hash,
      modified: artifact?.modifiedAt,
      baseline: 'working',
      provenance: 'adapter.matlab-simulink read-only extraction from model.slx',
    })
    expect(batch.provenance).toEqual([expect.objectContaining({
      sourcePath: 'model.slx',
      adapterId: 'adapter.matlab-simulink',
      toolVersion: 'matlab-extractor/1.0',
    })])
  })

  test('reports a missing MATLAB executable as an isolated adapter error', async () => {
    const directory = await temporaryDirectory('matlab-missing')
    const artifactPath = join(directory, 'model.slx')
    await writeFile(artifactPath, 'placeholder proprietary container', 'utf8')
    const catalog = await new FilesystemAdapter().discover({
      id: 'matlab-root',
      label: 'MATLAB fixture',
      rootPath: directory,
      enabled: true,
    })
    const batch = await new MatlabSimulinkAdapter(join(PROJECT_ROOT, 'server', 'matlab')).extract({
      workspace: {
        id: 'workspace',
        name: 'MATLAB fixture',
        kind: 'real',
        softwareLevel: 'Level B',
        do331Applicable: true,
        baselineId: 'working',
        sourceRoots: [],
        matlab: {
          enabled: true,
          executable: 'definitely-not-a-real-matlab-executable',
          timeoutMs: 1_000,
        },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      },
      artifacts: catalog.artifacts,
      baselineId: 'working',
    })

    expect(batch.evidence).toEqual([])
    expect(batch.diagnostics).toHaveLength(1)
    expect(batch.diagnostics[0]).toMatchObject({
      adapterId: 'adapter.matlab-simulink',
      severity: 'error',
      code: 'matlab-extraction-failed',
      retryable: true,
    })
  })
})

describe('spreadsheet adapter', () => {
  test('normalizes a real XLSX workbook and its trace columns', async () => {
    const directory = await temporaryDirectory('xlsx')
    const workbookPath = join(directory, 'requirements.xlsx')
    const workbook = new AdmZip()
    workbook.addFile('xl/workbook.xml', Buffer.from(
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="Requirements" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ))
    workbook.addFile('xl/_rels/workbook.xml.rels', Buffer.from(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ))
    workbook.addFile('xl/worksheets/sheet1.xml', Buffer.from(
      '<worksheet><sheetData>'
      + '<row><c r="A1"><t>ID</t></c><c r="B1"><t>Title</t></c><c r="C1"><t>Type</t></c>'
      + '<c r="D1"><t>Status</t></c><c r="E1"><t>Revision</t></c><c r="F1"><t>Downstream</t></c></row>'
      + '<row><c r="A2"><t>XLSX-HLR-001</t></c><c r="B2"><t>Workbook requirement</t></c>'
      + '<c r="C2"><t>hlr</t></c><c r="D2"><t>approved</t></c><c r="E2"><t>4</t></c>'
      + '<c r="F2"><t>XLSX-LLR-001</t></c></row>'
      + '</sheetData></worksheet>',
    ))
    await writeFile(workbookPath, workbook.toBuffer())

    const catalog = await new FilesystemAdapter().discover({
      id: 'xlsx-root',
      label: 'XLSX fixture',
      rootPath: directory,
      enabled: true,
    })
    const batch = await new SpreadsheetAdapter().extract({
      workspace: {
        id: 'workspace',
        name: 'XLSX fixture',
        kind: 'real',
        softwareLevel: 'Level B',
        do331Applicable: false,
        baselineId: 'working',
        sourceRoots: [],
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      },
      artifacts: catalog.artifacts,
      baselineId: 'working',
    })

    expect(batch.diagnostics).toEqual([])
    expect(batch.evidence).toHaveLength(1)
    expect(batch.evidence[0]).toMatchObject({
      id: 'XLSX-HLR-001',
      title: 'Workbook requirement',
      type: 'hlr',
      phase: 'requirements',
      status: 'approved',
      revision: '4',
      sourceKind: 'XLSX',
      downstream: ['XLSX-LLR-001'],
    })
    expect(batch.relationships).toEqual([expect.objectContaining({
      from: 'XLSX-HLR-001',
      to: 'XLSX-LLR-001',
    })])
  })
})
