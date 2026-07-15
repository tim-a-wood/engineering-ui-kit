/**
 * CAP-TEST-102 — existing-repository migration planning (CAP-ERA-001 §14.3,
 * §11.2, §9 CAP-CONTRACT-030): each static existing-repo fixture (read from
 * disk here, in the test only) produces an additive, evidence-backed
 * `CapabilityMigrationPlan`, and legacy `runtime.js` modules trigger a
 * readiness-gap diagnostic (§14.2).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverRepository } from '../../../src/capabilities/generation/repositoryDiscovery.js'
import {
  detectLegacyRuntimeModules,
  planExistingRepoMigration,
  type ExistingRepoCapabilityRecord,
} from '../../../src/capabilities/generation/existingRepoMigration.js'
import { loadExistingRepoEvidence } from './existingRepoFixtureLoader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesRoot = path.resolve(__dirname, '../fixtures/existing-repos')

const VERSIONS = { fromWorkspaceVersion: '1.0', toWorkspaceVersion: '2.0' }

describe('CAP-TEST-102 existing-repository migration planning', () => {
  it('react-ts: detects npm/typescript/src conventions and produces an additive plan', () => {
    const evidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'react-ts'), 'repo.react-ts')
    const discovery = discoverRepository(evidence)
    expect(discovery.packageManager).toBe('npm')
    expect(discovery.languages).toEqual(['typescript'])
    expect(discovery.sourceRoots).toEqual(['src'])
    expect(discovery.testRoots).toEqual(['src'])
    expect(discovery.frameworks).toEqual(['react', 'vite'])
    expect(discovery.entryPoints).toEqual(['src/index.tsx'])

    const capabilityRecords: ExistingRepoCapabilityRecord[] = [
      {
        recordId: 'rec.dashboard',
        moduleId: 'mod.experience.dashboard',
        name: 'Dashboard',
        moduleType: 'experience',
        responsibility: 'renders the existing dashboard UI',
        providedOperations: [],
      },
    ]

    const plan = planExistingRepoMigration({
      migrationPlanId: 'mig-react-ts-0001',
      projectId: 'proj-1',
      evidence,
      capabilityRecords,
      versions: VERSIONS,
    })

    // Additive: no destructive delete of existing source, ever.
    expect(plan.fileTransformations.some((change) => change.action === 'delete')).toBe(false)

    // The existing entry point is wrapped/extended, never replaced wholesale.
    const entryPointChange = plan.fileTransformations.find((change) => change.path === 'src/index.tsx')
    expect(entryPointChange?.action).toBe('update')
    expect(entryPointChange?.description).toMatch(/wrap|extend/i)
    expect(entryPointChange?.description).toMatch(/never replaced wholesale/i)

    // A new generated composition root is proposed additively (`create`), in the detected source root.
    const created = plan.fileTransformations.filter((change) => change.action === 'create')
    expect(created.length).toBeGreaterThan(0)
    expect(created.every((change) => change.path.startsWith('src/'))).toBe(true)

    // Detected conventions are preserved and recorded.
    const conventionsRecord = plan.recordTransformations.find((record) => record.recordId === 'repo.react-ts:conventions')
    expect(conventionsRecord?.description).toContain('npm')
    expect(conventionsRecord?.description).toContain('src')

    expect(plan.dataLossAssessment.hasLoss).toBe(false)
    expect(plan.blockedAmbiguities).toEqual([])
  })

  it('python: detects pip/python/src/tests conventions and produces an additive plan', () => {
    const evidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'python'), 'repo.python')
    const discovery = discoverRepository(evidence)
    expect(discovery.packageManager).toBe('pip')
    expect(discovery.languages).toEqual(['python'])
    expect(discovery.sourceRoots).toEqual(['src'])
    expect(discovery.testRoots).toEqual(['tests'])
    expect(discovery.entryPoints).toEqual(['src/widgets/main.py'])

    const capabilityRecords: ExistingRepoCapabilityRecord[] = [
      {
        recordId: 'rec.widgets',
        moduleId: 'mod.domain.widgets',
        name: 'Widgets',
        moduleType: 'domain',
        responsibility: 'widget domain logic',
        providedOperations: [{ operationId: 'op.widgets.build', contractVersion: '1.0' }],
      },
    ]

    const plan = planExistingRepoMigration({
      migrationPlanId: 'mig-python-0001',
      projectId: 'proj-1',
      evidence,
      capabilityRecords,
      versions: VERSIONS,
    })

    expect(plan.fileTransformations.some((change) => change.action === 'delete')).toBe(false)

    const entryPointChange = plan.fileTransformations.find((change) => change.path === 'src/widgets/main.py')
    expect(entryPointChange?.action).toBe('update')
    expect(entryPointChange?.description).toMatch(/wrap|extend/i)

    const created = plan.fileTransformations.filter((change) => change.action === 'create')
    expect(created.length).toBeGreaterThan(0)
    expect(created.every((change) => change.path.startsWith('src/') && change.path.endsWith('.py'))).toBe(true)

    const conventionsRecord = plan.recordTransformations.find((record) => record.recordId === 'repo.python:conventions')
    expect(conventionsRecord?.description).toContain('pip')
    expect(conventionsRecord?.description).toContain('tests')

    const widgetsRecord = plan.recordTransformations.find((record) => record.recordId === 'rec.widgets')
    expect(widgetsRecord?.description).toContain('op.widgets.build')

    expect(plan.dataLossAssessment.hasLoss).toBe(false)
    expect(plan.blockedAmbiguities).toEqual([])
  })

  it('react-python: preserves two language source roots without collapsing the generated HTTP boundary', () => {
    const evidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'react-python'), 'repo.react-python')
    const discovery = discoverRepository(evidence)
    expect(discovery.languages).toEqual(['python', 'typescript'])
    // `legacy/runtime.js` also counts as typescript-extension source evidence
    // (repositoryDiscovery.ts has no special case for it), so it appears as
    // its own candidate source root alongside the two "real" roots.
    expect(discovery.sourceRoots).toEqual(['backend', 'frontend/src', 'legacy'])
    expect(discovery.frameworks).toEqual(['fastapi', 'react', 'vite'])
    expect(discovery.entryPoints.sort()).toEqual(['backend/app/main.py', 'frontend/src/index.tsx'])
    // repositoryDiscovery.ts only matches lockfiles by an exact top-level
    // filename (CAP-ERA-001 §11.2 evidence-only, not path-aware), so nested
    // per-side lockfiles (frontend/package-lock.json, backend/requirements.txt)
    // are not picked up as root package-manager evidence — the planner must
    // not fabricate a package manager the evidence does not actually show.
    expect(discovery.packageManager).toBe('unknown')
    expect(discovery.ambiguities).toEqual([])

    const capabilityRecords: ExistingRepoCapabilityRecord[] = [
      {
        recordId: 'rec.dashboard-ui',
        moduleId: 'mod.experience.dashboard',
        name: 'Dashboard',
        moduleType: 'experience',
        responsibility: 'renders the existing dashboard UI',
        providedOperations: [],
      },
      {
        recordId: 'rec.dashboard-api',
        moduleId: 'mod.domain.dashboardApi',
        name: 'Dashboard API',
        moduleType: 'domain',
        responsibility: 'serves dashboard data over HTTP',
        providedOperations: [{ operationId: 'op.dashboard.get', contractVersion: '1.0' }],
      },
    ]

    const plan = planExistingRepoMigration({
      migrationPlanId: 'mig-react-python-0001',
      projectId: 'proj-1',
      evidence,
      capabilityRecords,
      versions: VERSIONS,
    })

    expect(plan.fileTransformations.some((change) => change.action === 'delete')).toBe(false)

    // Both existing entry points are wrapped/extended, never replaced.
    for (const entryPointPath of ['backend/app/main.py', 'frontend/src/index.tsx']) {
      const change = plan.fileTransformations.find((c) => c.path === entryPointPath)
      expect(change?.action).toBe('update')
      expect(change?.description).toMatch(/wrap|extend/i)
    }

    // The generated HTTP boundary is not collapsed: the browser (TypeScript)
    // and http-api (Python) generated composition roots land in their own
    // language's source root, never the same one.
    const created = plan.fileTransformations.filter((change) => change.action === 'create')
    const browserFile = created.find((change) => change.path.includes('browser'))
    const httpApiFile = created.find((change) => change.path.includes('http-api'))
    expect(browserFile).toBeDefined()
    expect(httpApiFile).toBeDefined()
    expect(browserFile?.path.startsWith('frontend/')).toBe(true)
    expect(httpApiFile?.path.startsWith('backend/')).toBe(true)
    expect(browserFile?.path).not.toBe(httpApiFile?.path)
    expect(path.dirname(browserFile!.path)).not.toBe(path.dirname(httpApiFile!.path))

    // No fabricated ambiguity: the evidence genuinely does not surface one for this fixture.
    expect(plan.blockedAmbiguities).toEqual([])

    // Legacy runtime.js is never mutated directly by the plan; it is handled via a compatibility shim instead.
    expect(plan.fileTransformations.some((change) => change.path === 'legacy/runtime.js')).toBe(false)
    expect(plan.compatibilityShims.some((shim) => shim.includes('legacy/runtime.js'))).toBe(true)

    expect(plan.dataLossAssessment.hasLoss).toBe(false)
    expect(plan.dataLossAssessment.details.some((detail) => detail.includes('compatibility adapter'))).toBe(true)
  })

  it('legacy-runtime diagnostic fires only on the fixture containing runtime.js, with a readiness gap and a migration path', () => {
    const reactPythonEvidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'react-python'), 'repo.react-python')
    const diagnostics = detectLegacyRuntimeModules(reactPythonEvidence)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.path).toBe('legacy/runtime.js')
    expect(diagnostics[0]?.readinessGap).toMatch(/real-connection verification|not.*conformant/i)
    expect(diagnostics[0]?.migrationPath).toMatch(/compatibility adapter/i)
    expect(diagnostics[0]?.migrationPath).toMatch(/composition root/i)

    const reactTsEvidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'react-ts'), 'repo.react-ts')
    expect(detectLegacyRuntimeModules(reactTsEvidence)).toEqual([])

    const pythonEvidence = loadExistingRepoEvidence(path.join(fixturesRoot, 'python'), 'repo.python')
    expect(detectLegacyRuntimeModules(pythonEvidence)).toEqual([])
  })
})
