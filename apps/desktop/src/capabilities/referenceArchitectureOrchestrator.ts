/**
 * Desktop-owned production orchestration for generation/apply/rollback.
 * The renderer supplies identities and explicit intent only; this service
 * reloads canonical records and owns all filesystem/process authority.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import {
  CapabilityIntegrationStore,
  CapabilityWorkspace,
  applyGenerationPlan,
  assembleGenerationPlan,
  buildOwnershipManifest,
  canonicalHash,
  canonicalRecordHash,
  generatedContentHash,
  promoteInterviewToModuleImplementationSpecification,
  rollbackGenerationApply,
  runConnectionVerification,
  validateComposition,
  type CapabilityIntegrationState,
  type CompositionConfigurationState,
  type CleanState,
  type DeployableSpecification,
  type GeneratedSchemaDefinition,
  type GeneratedSchemaNode,
  type GenerationApplyRecord,
  type GenerationPlan,
  type ConnectionVerificationRecord,
  type GeneratedOwnershipManifest,
  type IntegrationCommandRun,
  runCommand,
  type InboundBinding,
  type ModuleDataSchema,
  type ModuleImplementationSpecification,
  type ModuleInterviewResponse,
  type OperationContract,
  type PersistedGenerationBundle,
} from '@engineering-ui-kit/core'
import type { Workspace } from '@engineering-ui-kit/core'

export type GenerationPreviewResult = {
  plan: GenerationPlan
  status: 'plan-ready' | 'blocked'
}

function repositoryCleanState(repoRoot: string): CleanState {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.trim() ? 'dirty' : 'clean'
  } catch {
    // A non-git or unreadable repository is conservatively treated as dirty;
    // apply then requires the user's explicit dirty-worktree acceptance.
    return 'dirty'
  }
}

/**
 * Parse an approved launch command without invoking a shell. Environment
 * expansion, pipelines, redirection, command substitution, and control
 * operators are deliberately rejected; process authority remains bounded to
 * one executable plus literal argv.
 */
function parseApprovedCommand(commandText: string): { command: string; args: string[] } {
  const text = commandText.trim()
  if (!text) throw new Error('the approved deployable has no launch command')
  if (/[\n\r;&|<>`$]/.test(text)) {
    throw new Error('launch command contains shell expansion or control operators; configure a direct executable and arguments')
  }
  const tokens: string[] = []
  let token = ''
  let quote: 'single' | 'double' | undefined
  let escaping = false
  let started = false
  for (const character of text) {
    if (escaping) {
      token += character
      escaping = false
      started = true
      continue
    }
    if (character === '\\' && quote !== 'single') {
      escaping = true
      started = true
      continue
    }
    if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? undefined : 'single'
      started = true
      continue
    }
    if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? undefined : 'double'
      started = true
      continue
    }
    if (/\s/.test(character) && !quote) {
      if (started) {
        tokens.push(token)
        token = ''
        started = false
      }
      continue
    }
    token += character
    started = true
  }
  if (escaping || quote) throw new Error('launch command contains an unfinished escape or quote')
  if (started) tokens.push(token)
  const [command, ...args] = tokens
  if (!command) throw new Error('the approved deployable has no launch executable')
  return { command, args }
}

async function urlReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
    return response.status < 500
  } catch {
    return false
  }
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await urlReachable(url)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`the configured UI did not become reachable within ${timeoutMs}ms`)
}

async function stopSpawnedProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, value)
      else child.kill(value)
    } catch {
      try { child.kill(value) } catch { /* already exited */ }
    }
  }
  signal('SIGTERM')
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
  ])
  if (child.exitCode === null && child.signalCode === null) signal('SIGKILL')
}

function readCurrentOwnedSourceHashes(
  repoRoot: string,
  manifests: readonly GeneratedOwnershipManifest[],
): { hashes?: Record<string, string>; issue?: string } {
  const hashes: Record<string, string> = {}
  for (const ownership of manifests) {
    const absolute = path.resolve(repoRoot, ...ownership.filePath.split('/'))
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return { issue: `generated-owned verification source is missing: ${ownership.filePath}` }
    }
    const current = generatedContentHash(fs.readFileSync(absolute, 'utf8'))
    if (current !== ownership.contentHash) {
      return { issue: `generated-owned verification source changed after apply: ${ownership.filePath}` }
    }
    hashes[ownership.filePath] = current
  }
  return { hashes }
}

type RuntimeDistribution = {
  files: { path: string; contents: string; ownership: 'generated' | 'editable'; reason: string }[]
  dependencies: { packageName: string; language: 'typescript' | 'python'; toVersion: string; fromVersion?: string; reason: string }[]
  commands: string[]
  blockers: string[]
}

function textFilesBelow(root: string): { relativePath: string; contents: string }[] {
  if (!fs.existsSync(root)) return []
  const files: { relativePath: string; contents: string }[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile()) files.push({ relativePath: path.relative(root, absolute).replaceAll(path.sep, '/'), contents: fs.readFileSync(absolute, 'utf8') })
    }
  }
  visit(root)
  return files
}

function locateTypeScriptRuntime(): string | undefined {
  const resourceCandidate = path.resolve(
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '',
    'capabilities-runtime-typescript',
  )
  if (fs.existsSync(path.join(resourceCandidate, 'dist/index.js'))
    && fs.existsSync(path.join(resourceCandidate, 'dist/index.d.ts'))) {
    return resourceCandidate
  }
  try {
    const entry = createRequire(import.meta.url).resolve('@engineering-ui-kit/capabilities-runtime')
    return path.resolve(path.dirname(entry), '..')
  } catch {
    return undefined
  }
}

function locatePythonRuntime(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), 'runtimes/python'),
    path.resolve((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? '', 'capabilities-runtime-python'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../runtimes/python'),
  ]
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'pyproject.toml')))
}

export function buildRuntimeDistribution(deployable: DeployableSpecification, targetRoot: string): RuntimeDistribution {
  const result: RuntimeDistribution = { files: [], dependencies: [], commands: [], blockers: [] }
  if (deployable.runtimeLanguage === 'typescript') {
    const runtimeRoot = locateTypeScriptRuntime()
    if (!runtimeRoot || !fs.existsSync(path.join(runtimeRoot, 'dist/index.js'))) {
      result.blockers.push('The packaged TypeScript capabilities runtime is unavailable; rebuild the desktop application with runtime assets.')
      return result
    }
    const vendorRoot = '.engineering-ui/capabilities/runtime/typescript'
    for (const relativePath of ['package.json', ...textFilesBelow(path.join(runtimeRoot, 'dist')).map((file) => `dist/${file.relativePath}`)]) {
      const source = relativePath === 'package.json'
        ? fs.readFileSync(path.join(runtimeRoot, relativePath), 'utf8')
        : fs.readFileSync(path.join(runtimeRoot, relativePath), 'utf8')
      result.files.push({ path: `${vendorRoot}/${relativePath}`, contents: source, ownership: 'generated', reason: 'bundled TypeScript reference-architecture runtime' })
    }
    const packagePath = path.join(targetRoot, 'package.json')
    let packageJson: Record<string, unknown>
    try {
      packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) as Record<string, unknown> : { private: true, type: 'module' }
    } catch {
      result.blockers.push('The target package.json is not valid JSON, so the runtime dependency cannot be added safely.')
      return result
    }
    const dependencies = typeof packageJson.dependencies === 'object' && packageJson.dependencies
      ? { ...(packageJson.dependencies as Record<string, unknown>) }
      : {}
    const prior = typeof dependencies['@engineering-ui-kit/capabilities-runtime'] === 'string'
      ? dependencies['@engineering-ui-kit/capabilities-runtime'] as string
      : undefined
    dependencies['@engineering-ui-kit/capabilities-runtime'] = `file:${vendorRoot}`
    packageJson.dependencies = Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))
    const devDependencies = typeof packageJson.devDependencies === 'object' && packageJson.devDependencies
      ? { ...(packageJson.devDependencies as Record<string, unknown>) }
      : {}
    devDependencies.typescript = typeof devDependencies.typescript === 'string' ? devDependencies.typescript : '^5.8.0'
    devDependencies['@types/node'] = typeof devDependencies['@types/node'] === 'string' ? devDependencies['@types/node'] : '^22.15.0'
    if (deployable.kind === 'electron-main') {
      devDependencies.electron = typeof devDependencies.electron === 'string' ? devDependencies.electron : '43.0.0'
    }
    packageJson.devDependencies = Object.fromEntries(Object.entries(devDependencies).sort(([a], [b]) => a.localeCompare(b)))
    result.files.push({ path: 'package.json', contents: `${JSON.stringify(packageJson, null, 2)}\n`, ownership: 'editable', reason: 'register the bundled reference-architecture runtime dependency' })
    result.files.push({
      path: 'tsconfig.engineering-ui.json',
      contents: `${JSON.stringify({
        compilerOptions: {
          target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.',
          outDir: '.engineering-ui/capabilities/build', strict: true, skipLibCheck: true,
          esModuleInterop: true, types: ['node'],
        },
        include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.mts', deployable.compositionRootPath],
      }, null, 2)}\n`,
      ownership: 'generated',
      reason: 'compile generated TypeScript adapters, composition, and host with a deterministic preset',
    })
    result.dependencies.push({ packageName: '@engineering-ui-kit/capabilities-runtime', language: 'typescript', toVersion: '0.1.0', fromVersion: prior, reason: 'generated adapters and composition root import the project runtime' })
    result.commands.push('npm install')
    result.commands.push('npx tsc -p tsconfig.engineering-ui.json')
    if (deployable.kind === 'http-api') {
      result.commands.push(`node .engineering-ui/capabilities/build/src/generated/${deployable.deployableId.replaceAll('/', '-')}/host.g.js`)
    } else if (deployable.kind === 'cli') {
      result.commands.push(`node .engineering-ui/capabilities/build/src/generated/${deployable.deployableId.replaceAll('/', '-')}/cli-host.g.js`)
    }
  } else {
    const runtimeRoot = locatePythonRuntime()
    if (!runtimeRoot) {
      result.blockers.push('The packaged Python capabilities runtime is unavailable; rebuild the desktop application with runtime assets.')
      return result
    }
    const vendorRoot = '.engineering-ui/capabilities/runtime/python'
    const pythonRuntimeSources = textFilesBelow(path.join(runtimeRoot, 'src'))
      .filter((file) => !/(^|\/)(?:[^/]+\.egg-info|__pycache__)(?:\/|$)|\.pyc$/i.test(file.relativePath))
      .map((file) => `src/${file.relativePath}`)
    for (const relativePath of ['pyproject.toml', 'README.md', ...pythonRuntimeSources]) {
      result.files.push({
        path: `${vendorRoot}/${relativePath}`,
        contents: fs.readFileSync(path.join(runtimeRoot, relativePath), 'utf8'),
        ownership: 'generated',
        reason: 'bundled Python reference-architecture runtime',
      })
    }
    const hostDependencies = deployable.kind === 'http-api' ? ['uvicorn==0.35.0'] : []
    result.files.push({
      path: 'requirements.engineering-ui.txt',
      // A normal local-path install works with the older pip bundled by some
      // supported Python 3.11 installations. Editable PEP 660 installs would
      // unnecessarily require a newer pip just to consume generated runtime
      // infrastructure.
      contents: [`./${vendorRoot}`, ...hostDependencies, ''].join('\n'),
      ownership: 'generated',
      reason: 'install the bundled Python reference-architecture runtime and its declared dependencies',
    })
    result.dependencies.push({ packageName: 'engineering-ui-capabilities-runtime', language: 'python', toVersion: '0.1.0', reason: 'generated adapters and composition root import the project runtime' })
    if (deployable.kind === 'http-api') {
      result.dependencies.push({ packageName: 'uvicorn', language: 'python', toVersion: '0.35.0', reason: 'generated Python HTTP host launches the ASGI application with uvicorn' })
    }
    const pythonCommand = pythonCommandFor(targetRoot)
    result.commands.push(`${pythonCommand} -m pip install -r requirements.engineering-ui.txt`)
    if (deployable.kind === 'http-api') {
      result.commands.push(`${pythonCommand} src/generated/${deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}/host_g.py`)
    } else if (deployable.kind === 'cli') {
      result.commands.push(`${pythonCommand} src/generated/${deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}/cli_host_g.py`)
    }
  }
  return result
}

function pythonCommandFor(targetRoot: string): string {
  const relative = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'
  return fs.existsSync(path.join(targetRoot, ...relative.split('/')))
    ? relative
    : process.platform === 'win32' ? 'python' : 'python3'
}

function generatedLaunchCommand(
  deployable: DeployableSpecification,
  targetRoot: string,
  binding?: InboundBinding,
): string | undefined {
  if (binding?.kind === 'embedded-library') {
    const id = deployable.deployableId.replaceAll('/', '-')
    return deployable.runtimeLanguage === 'python'
      ? `${pythonCommandFor(targetRoot)} src/generated/${deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}/embedded/${binding.bindingId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}_host_g.py`
      : `node .engineering-ui/capabilities/build/src/generated/${id}/embedded/${binding.bindingId}.host.g.js`
  }
  if (binding?.kind === 'schedule') {
    const id = deployable.deployableId.replaceAll('/', '-')
    return deployable.runtimeLanguage === 'python'
      ? `${pythonCommandFor(targetRoot)} src/generated/${deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}/worker/${binding.bindingId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}_host_g.py`
      : `node .engineering-ui/capabilities/build/src/generated/${id}/worker/${binding.bindingId}.host.g.js`
  }
  if (binding?.kind === 'ui' && binding.transport === 'electron-ipc') {
    const id = deployable.deployableId.replaceAll('/', '-')
    return `npx electron .engineering-ui/capabilities/build/src/generated/${id}/electron/${binding.bindingId}.verification-main.g.js`
  }
  if (deployable.kind !== 'http-api' && deployable.kind !== 'cli') return undefined
  const id = deployable.deployableId.replaceAll('/', '-')
  return deployable.runtimeLanguage === 'python'
    ? `${pythonCommandFor(targetRoot)} src/generated/${deployable.deployableId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}/${deployable.kind === 'cli' ? 'cli_host_g.py' : 'host_g.py'}`
    : `node .engineering-ui/capabilities/build/src/generated/${id}/${deployable.kind === 'cli' ? 'cli-host.g.js' : 'host.g.js'}`
}

function schemaNode(type: string, knownSchemaIds: ReadonlySet<string>): GeneratedSchemaNode | undefined {
  const value = type.trim()
  const lower = value.toLowerCase()
  if (knownSchemaIds.has(value)) return { kind: 'ref', schemaId: value }
  if (lower.endsWith('[]')) {
    const item = schemaNode(value.slice(0, -2), knownSchemaIds)
    return item ? { kind: 'array', items: item } : undefined
  }
  if (['string', 'text', 'uuid', 'date', 'datetime', 'timestamp'].includes(lower)) return { kind: 'string' }
  if (['integer', 'int'].includes(lower)) return { kind: 'integer' }
  if (['number', 'float', 'double', 'decimal'].includes(lower)) return { kind: 'number' }
  if (['boolean', 'bool'].includes(lower)) return { kind: 'boolean' }
  if (['unknown', 'any', 'object', 'json'].includes(lower)) return { kind: 'unknown' }
  return undefined
}

function typeNameForSchema(schemaId: string): string {
  const words = schemaId.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')
  return joined || 'AnonymousSchema'
}

function factoryExportName(operationId: string, runtimeLanguage: 'typescript' | 'python'): string {
  const words = operationId.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (runtimeLanguage === 'python') return `create_${words.map((word) => word.toLowerCase()).join('_') || 'operation'}`
  return `create${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('') || 'Operation'}`
}

function suggestedImplementationTarget(
  specification: ModuleImplementationSpecification,
  operationId: string,
  runtimeLanguage: 'typescript' | 'python',
): string | undefined {
  const extension = runtimeLanguage === 'python' ? '.py' : '.ts'
  const approved = specification.editablePaths[0]
  if (!approved) return undefined
  const normalized = approved.replaceAll('\\', '/').replace(/\/+$/, '')
  const looksLikeFile = /\.[A-Za-z0-9]+$/.test(normalized)
  const operationFile = operationId.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()
  const filePath = looksLikeFile ? normalized : `${normalized}/${operationFile}${extension}`
  return `${filePath}#${factoryExportName(operationId, runtimeLanguage)}`
}

function assertImplementationTarget(
  target: string,
  runtimeLanguage: 'typescript' | 'python',
  editablePaths: readonly string[],
): void {
  const split = target.split('#')
  if (split.length !== 2 || !split[0] || !split[1]) throw new Error('implementation target must be <repo-relative-file>#<named-factory-export>')
  const [rawFile, exportName] = split
  const filePath = rawFile.replaceAll('\\', '/')
  if (path.posix.isAbsolute(filePath) || filePath.split('/').some((segment) => segment === '..')) {
    throw new Error('implementation target must remain inside an approved editable path')
  }
  const validExtension = runtimeLanguage === 'python' ? filePath.endsWith('.py') : /\.tsx?$/.test(filePath)
  if (!validExtension) throw new Error(`implementation target must be a ${runtimeLanguage === 'python' ? '.py' : '.ts or .tsx'} file`)
  if (runtimeLanguage === 'python' && filePath.replace(/\.py$/, '').split('/').some((segment) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment))) {
    throw new Error('Python implementation target path segments must be importable identifiers (letters, digits, and underscores)')
  }
  const validExport = runtimeLanguage === 'python' ? /^[A-Za-z_][A-Za-z0-9_]*$/.test(exportName) : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exportName)
  if (!validExport) throw new Error('implementation factory export is not a valid identifier')
  const owned = editablePaths.some((editable) => {
    const base = editable.replaceAll('\\', '/').replace(/\/+$/, '')
    return filePath === base || filePath.startsWith(`${base}/`)
  })
  if (!owned) throw new Error(`implementation target is outside the module's approved editable paths: ${filePath}`)
}

function convertSchemas(interviews: readonly ModuleInterviewResponse[]): {
  schemas: GeneratedSchemaDefinition[]
  blockers: string[]
} {
  const source = interviews.flatMap((interview) => interview.dataSchemas ?? [])
  const knownIds = new Set(source.map((schema) => schema.schemaId))
  const blockers: string[] = []
  const byId = new Map<string, GeneratedSchemaDefinition>()
  const schemaIdByTypeName = new Map<string, string>()
  for (const schema of source) {
    const properties: { name: string; schema: GeneratedSchemaNode; required?: boolean }[] = []
    for (const field of schema.fields) {
      const node = schemaNode(field.type, knownIds)
      if (!node) {
        blockers.push(`Schema "${schema.schemaId}" field "${field.name}" has unsupported type "${field.type}".`)
        continue
      }
      properties.push({ name: field.name, schema: node, required: field.required })
    }
    const converted: GeneratedSchemaDefinition = {
      schemaId: schema.schemaId,
      typeName: typeNameForSchema(schema.schemaId),
      schema: { kind: 'object', properties },
    }
    const priorSchemaId = schemaIdByTypeName.get(converted.typeName)
    if (priorSchemaId && priorSchemaId !== schema.schemaId) {
      blockers.push(`Schemas "${priorSchemaId}" and "${schema.schemaId}" both map to generated type name "${converted.typeName}".`)
    } else {
      schemaIdByTypeName.set(converted.typeName, schema.schemaId)
    }
    const existing = byId.get(schema.schemaId)
    if (existing && canonicalHash(existing) !== canonicalHash(converted)) {
      blockers.push(`Schema "${schema.schemaId}" has conflicting approved definitions.`)
    } else {
      byId.set(schema.schemaId, converted)
    }
  }
  return { schemas: [...byId.values()].sort((a, b) => a.schemaId.localeCompare(b.schemaId)), blockers }
}

function uniqueOperations(interviews: readonly ModuleInterviewResponse[]): {
  operations: OperationContract[]
  blockers: string[]
} {
  const byKey = new Map<string, OperationContract>()
  const blockers: string[] = []
  for (const operation of interviews.flatMap((interview) => interview.operationContracts ?? [])) {
    const key = `${operation.operationId}@${operation.version}`
    const existing = byKey.get(key)
    if (existing && canonicalHash(existing) !== canonicalHash(operation)) {
      blockers.push(`Operation contract "${key}" has conflicting approved definitions.`)
    } else {
      byKey.set(key, operation)
    }
  }
  return { operations: [...byKey.values()].sort((a, b) => `${a.operationId}@${a.version}`.localeCompare(`${b.operationId}@${b.version}`)), blockers }
}

export class ReferenceArchitectureOrchestrator {
  readonly capabilities: CapabilityWorkspace
  readonly integration: CapabilityIntegrationStore

  constructor(readonly workspace: Workspace, dataDir: string) {
    this.capabilities = new CapabilityWorkspace(dataDir)
    this.integration = new CapabilityIntegrationStore(this.capabilities)
  }

  private approvedDeployable(projectId: string, deployableId: string): DeployableSpecification {
    const foundation = this.capabilities.getApprovedFoundation(projectId)
    if (!foundation) throw new Error('approved foundation plan not found')
    const architecture = this.capabilities.getApprovedArchitecture(projectId)
    if (!architecture) throw new Error('approved architecture not found')
    if (foundation.architectureHash !== architecture.contentHash) throw new Error('approved foundation is stale')
    const deployable = this.capabilities.getApprovedDeployable(projectId, deployableId)
    if (!deployable || !foundation.deployables.some((item) => item.deployableId === deployableId)) {
      throw new Error(`approved deployable not found in current foundation: ${deployableId}`)
    }
    return deployable
  }

  private collectInputs(projectId: string, deployableId: string) {
    const project = this.workspace.getProject(projectId)
    if (!project) throw new Error(`project not found: ${projectId}`)
    const architecture = this.capabilities.getApprovedArchitecture(projectId)
    const foundation = this.capabilities.getApprovedFoundation(projectId)
    if (!architecture || !foundation) throw new Error('approved architecture and foundation are required')
    const deployable = this.approvedDeployable(projectId, deployableId)
    const allManifests = architecture.moduleIds.map((moduleId) => {
      const manifest = this.capabilities.getApprovedModule(projectId, moduleId)
      if (!manifest) throw new Error(`approved module not found: ${moduleId}`)
      return manifest
    })
    const manifests = allManifests.filter((manifest) => deployable.moduleIds.includes(manifest.moduleId))
    const interviews = allManifests
      .map((manifest) => this.capabilities.getApprovedModuleInterview(projectId, manifest.moduleId))
      .filter((value): value is ModuleInterviewResponse => Boolean(value))
    const allBindings = this.capabilities.listInboundBindings(projectId)
      .map((record) => record.approved)
      .filter((binding): binding is InboundBinding => Boolean(binding))
    const bindings = allBindings.filter((binding) => binding.deployableId === deployableId)
    const composition = this.integration.getCompositionManifest(projectId, deployableId)
    const specifications: ModuleImplementationSpecification[] = manifests.map((manifest) => {
      const interview = interviews.find((candidate) => candidate.moduleId === manifest.moduleId)
      const existing = this.integration.getModuleSpecification(projectId, manifest.moduleId)
      const specification = existing ?? promoteInterviewToModuleImplementationSpecification({
        manifest,
        interview,
        projectId,
        deployableId,
        runtimeLanguage: deployable.runtimeLanguage,
      })
      if (!existing) this.integration.saveModuleSpecification(specification)
      return specification
    })
    const schemaResult = convertSchemas(interviews)
    const operationResult = uniqueOperations(interviews)
    const requiredOperationIds = new Set(specifications.flatMap((specification) =>
      specification.requiredOperations.map((operation) => operation.operationId)))
    const remoteHttpBindings = allBindings.filter((binding): binding is Extract<InboundBinding, { kind: 'http' }> =>
      binding.kind === 'http' && binding.deployableId !== deployableId && requiredOperationIds.has(binding.operationId))
    const blockers = [...schemaResult.blockers, ...operationResult.blockers]
    if (deployable.runtimeLanguage === 'python'
      && deployable.compositionRootPath.replace(/\.py$/, '').split('/').some((segment) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment))) {
      blockers.push(`Python composition root path "${deployable.compositionRootPath}" is not importable; approve a path whose segments use letters, digits, and underscores.`)
    }
    for (const specification of specifications) {
      for (const unresolved of specification.unresolvedItems.filter((item) => item.materiality === 'material')) {
        blockers.push(`${specification.moduleId}: ${unresolved.description}`)
      }
    }
    if (!composition) blockers.push(`No approved composition manifest exists for deployable "${deployableId}".`)
    if (composition) {
      for (const issue of validateComposition(composition).issues) blockers.push(issue.message)
      for (const binding of bindings) {
        if (!composition.registrations.some((registration) => registration.contractId === binding.operationId)) {
          blockers.push(`Binding "${binding.bindingId}" has no composition registration for operation "${binding.operationId}".`)
        }
        if (!composition.operationRoutes.some((route) => route.inboundBindingId === binding.bindingId
          && route.operationId === binding.operationId && route.operationVersion === binding.operationVersion)) {
          blockers.push(`Binding "${binding.bindingId}" has no matching composition operation route.`)
        }
      }
    }
    const canonical = { architecture, foundation, deployable, manifests, interviews, bindings, remoteHttpBindings, composition, specifications }
    return {
      project,
      architecture,
      foundation,
      deployable,
      bindings,
      remoteHttpBindings,
      composition,
      specifications,
      schemas: schemaResult.schemas,
      operations: operationResult.operations,
      blockers,
      inputHash: canonicalHash(canonical),
    }
  }

  private compositionConfiguration(projectId: string, deployableId: string): CompositionConfigurationState {
    const inputs = this.collectInputs(projectId, deployableId)
    const existing = inputs.composition
    const attention: string[] = []
    const expected = new Map<string, CompositionConfigurationState['registrations'][number]>()
    for (const specification of inputs.specifications) {
      for (const operation of specification.providedOperations) {
        if (expected.has(operation.operationId)) {
          attention.push(`Operation "${operation.operationId}" has more than one provider module.`)
          continue
        }
        expected.set(operation.operationId, {
          contractId: operation.operationId,
          providerModuleId: specification.moduleId,
          lifecycle: specification.lifecycleRegistration,
          dependencies: specification.requiredOperations
            .map((required) => required.operationId)
            .filter((required) => inputs.specifications.some((candidate) =>
              candidate.providedOperations.some((provided) => provided.operationId === required)))
            .sort(),
          implementationTarget: existing?.registrations.find((registration) => registration.contractId === operation.operationId)?.implementationTarget,
          suggestedImplementationTarget: suggestedImplementationTarget(specification, operation.operationId, inputs.deployable.runtimeLanguage),
        })
      }
    }
    for (const registration of existing?.registrations ?? []) {
      if (!expected.has(registration.contractId)) {
        expected.set(registration.contractId, { ...registration })
        attention.push(`Preserving custom composition registration "${registration.contractId}" from the existing project.`)
      }
    }
    const registrations = [...expected.values()].sort((a, b) => a.contractId.localeCompare(b.contractId))
    for (const registration of registrations) {
      if (!registration.implementationTarget) attention.push(`Choose the editable factory for "${registration.contractId}".`)
    }
    const operationRoutes = inputs.bindings.map((binding) => ({
      operationId: binding.operationId,
      operationVersion: binding.operationVersion,
      inboundBindingId: binding.bindingId,
    })).sort((a, b) => a.inboundBindingId.localeCompare(b.inboundBindingId))
    return {
      deployableId,
      compositionId: existing?.compositionId ?? deployableId,
      compositionRootPath: inputs.deployable.compositionRootPath,
      runtimeLanguage: inputs.deployable.runtimeLanguage,
      registrations,
      operationRoutes,
      ready: registrations.every((registration) => Boolean(registration.implementationTarget)) && attention.every((item) => !/more than one provider/.test(item)),
      attention,
    }
  }

  saveCompositionConfiguration(input: {
    projectId: string
    deployableId: string
    targets: { contractId: string; implementationTarget: string }[]
    explicit: boolean
  }): CompositionConfigurationState {
    if (!input.explicit) throw new Error('saving composition configuration requires explicit user action')
    const collected = this.collectInputs(input.projectId, input.deployableId)
    const configuration = this.compositionConfiguration(input.projectId, input.deployableId)
    const targetByContract = new Map(input.targets.map((target) => [target.contractId, target.implementationTarget.trim()]))
    if (targetByContract.size !== configuration.registrations.length
      || configuration.registrations.some((registration) => !targetByContract.has(registration.contractId))) {
      throw new Error('composition target set does not match the current approved module specifications')
    }
    const registrations = configuration.registrations.map((registration) => {
      const target = targetByContract.get(registration.contractId)!
      const specification = collected.specifications.find((candidate) => candidate.moduleId === registration.providerModuleId)
      if (specification) assertImplementationTarget(target, collected.deployable.runtimeLanguage, specification.editablePaths)
      else if (target !== registration.implementationTarget) throw new Error(`custom registration "${registration.contractId}" cannot be retargeted without an owning module specification`)
      return {
        contractId: registration.contractId,
        implementationTarget: target,
        lifecycle: registration.lifecycle,
        providerModuleId: registration.providerModuleId,
        dependencies: [...registration.dependencies],
      }
    })
    const prior = collected.composition
    const body = {
      schemaVersion: '1.0' as const,
      projectId: input.projectId,
      compositionId: configuration.compositionId,
      applicationRevision: collected.architecture.applicationSpecRevision,
      architectureRevision: collected.architecture.revision,
      deployableIds: [input.deployableId],
      registrations,
      operationRoutes: configuration.operationRoutes,
      inboundAdapterRefs: collected.bindings.map((binding) => binding.bindingId).sort(),
      outboundAdapterRefs: prior?.outboundAdapterRefs ?? [],
      configurationRefs: [...new Set([...collected.deployable.configurationRefs, ...collected.specifications.flatMap((specification) => specification.configurationRefs)])].sort(),
      secretReferenceIds: [...new Set([...collected.deployable.secretReferenceIds, ...collected.specifications.flatMap((specification) => specification.secretReferenceIds)])].sort(),
      telemetryHookRefs: prior?.telemetryHookRefs ?? [],
      healthHookRefs: prior?.healthHookRefs ?? [],
      authorizationHookRefs: prior?.authorizationHookRefs ?? [],
    }
    this.integration.saveCompositionManifest({ ...body, compositionHash: canonicalHash(body) })
    return this.compositionConfiguration(input.projectId, input.deployableId)
  }

  /**
   * Operation routes and inbound adapter references are projections of the
   * currently approved bindings, not additional user-authored decisions.
   * Refresh them before every plan so a connection approved after composition
   * factories were configured cannot leave the manifest permanently stale.
   */
  private synchronizeDerivedCompositionRoutes(projectId: string, deployableId: string): void {
    const current = this.integration.getCompositionManifest(projectId, deployableId)
    if (!current) return
    const bindings = this.capabilities.listInboundBindings(projectId)
      .map((record) => record.approved)
      .filter((binding): binding is InboundBinding => binding !== undefined && binding.deployableId === deployableId)
    const operationRoutes = bindings.map((binding) => ({
      operationId: binding.operationId,
      operationVersion: binding.operationVersion,
      inboundBindingId: binding.bindingId,
    })).sort((a, b) => a.inboundBindingId.localeCompare(b.inboundBindingId))
    const inboundAdapterRefs = bindings.map((binding) => binding.bindingId).sort()
    const deployable = this.approvedDeployable(projectId, deployableId)
    const requiredOperationIds = new Set(deployable.moduleIds.flatMap((moduleId) =>
      this.integration.getModuleSpecification(projectId, moduleId)?.requiredOperations.map((operation) => operation.operationId) ?? []))
    const allApprovedBindings = this.capabilities.listInboundBindings(projectId)
      .map((record) => record.approved)
      .filter((binding): binding is InboundBinding => binding !== undefined)
    const remoteHttpRefs = allApprovedBindings
      .filter((binding) => binding.kind === 'http' && binding.deployableId !== deployableId && requiredOperationIds.has(binding.operationId))
      .map((binding) => binding.bindingId)
    const approvedBindingIds = new Set(allApprovedBindings.map((binding) => binding.bindingId))
    const customOutboundRefs = current.outboundAdapterRefs.filter((reference) => !approvedBindingIds.has(reference))
    const outboundAdapterRefs = [...new Set([...customOutboundRefs, ...remoteHttpRefs])].sort()
    if (canonicalHash(current.operationRoutes) === canonicalHash(operationRoutes)
      && canonicalHash(current.inboundAdapterRefs) === canonicalHash(inboundAdapterRefs)
      && canonicalHash(current.outboundAdapterRefs) === canonicalHash(outboundAdapterRefs)) return
    const { compositionHash: _priorHash, ...priorBody } = current
    const body = { ...priorBody, operationRoutes, inboundAdapterRefs, outboundAdapterRefs }
    this.integration.saveCompositionManifest({ ...body, compositionHash: canonicalHash(body) })
  }

  previewGeneration(projectId: string, deployableId: string): GenerationPreviewResult {
    this.synchronizeDerivedCompositionRoutes(projectId, deployableId)
    const inputs = this.collectInputs(projectId, deployableId)
    const latestApply = this.integration.getLatestApplyRecord(projectId, deployableId)
    const ownershipManifests = latestApply?.ownershipManifests ?? []
    const currentContentHashesByPath: Record<string, string> = {}
    for (const manifest of ownershipManifests) {
      const absolute = path.resolve(inputs.project.repoPath, ...manifest.filePath.split('/'))
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
        currentContentHashesByPath[manifest.filePath] = generatedContentHash(fs.readFileSync(absolute, 'utf8'))
      }
    }
    const runtime = buildRuntimeDistribution(inputs.deployable, inputs.project.repoPath)
    const planId = `plan-${crypto.randomUUID()}`
    const assembled = assembleGenerationPlan({
      deployable: inputs.deployable,
      modules: inputs.specifications,
      inboundBindings: inputs.bindings,
      remoteHttpBindings: inputs.remoteHttpBindings,
      schemas: inputs.schemas,
      operations: inputs.operations,
      composition: inputs.composition,
      targetRoot: inputs.project.repoPath,
      generatorVersion: '1.0.0',
      referenceProfileVersion: '1.0.0',
      planId,
      runId: planId,
      blockers: [...inputs.blockers, ...runtime.blockers],
      ownershipManifests,
      currentContentHashesByPath,
      targetCleanState: repositoryCleanState(inputs.project.repoPath),
      additionalFiles: runtime.files,
      dependencyChanges: runtime.dependencies,
      additionalCommands: runtime.commands,
    })
    const bundle: PersistedGenerationBundle = {
      schemaVersion: '1.0', projectId, deployableId, plan: assembled.plan,
      virtualFiles: assembled.virtualFiles, inputHash: inputs.inputHash, createdAt: new Date().toISOString(),
    }
    this.integration.saveGenerationBundle(bundle)
    return { plan: assembled.plan, status: assembled.plan.blockers.length || assembled.plan.ambiguityQuestions.length ? 'blocked' : 'plan-ready' }
  }

  getState(projectId: string): CapabilityIntegrationState {
    const foundation = this.capabilities.getApprovedFoundation(projectId)
    const ids = foundation?.deployables.map((deployable) => deployable.deployableId) ?? []
    const hashes: Record<string, string> = {}
    for (const id of ids) {
      try { hashes[id] = this.collectInputs(projectId, id).inputHash } catch { /* state remains not-ready */ }
    }
    const state = this.integration.buildState(projectId, ids, hashes)
    for (const deployableState of state.deployables) {
      try {
        const inputs = this.collectInputs(projectId, deployableState.deployableId)
        deployableState.compositionConfiguration = this.compositionConfiguration(projectId, deployableState.deployableId)
        const bundle = this.integration.getCurrentGenerationBundle(projectId, deployableState.deployableId)
        const apply = this.integration.getLatestApplyRecord(projectId, deployableState.deployableId)
        if (!bundle || !apply || apply.status !== 'applied'
          || apply.planId !== bundle.plan.planId || apply.planHash !== bundle.plan.planHash
          || bundle.inputHash !== inputs.inputHash || !inputs.composition) continue
        const source = readCurrentOwnedSourceHashes(inputs.project.repoPath, apply.ownershipManifests)
        if (!source.hashes) continue
        const common = {
          architecture: inputs.architecture.contentHash,
          composition: inputs.composition.compositionHash,
          generatedOwnership: canonicalHash(apply.ownershipManifests),
          source: canonicalHash(source.hashes),
        }
        deployableState.currentConnectionVerificationIds = deployableState.connectionVerifications
          .filter((record) => {
            const binding = inputs.bindings.find((candidate) => candidate.bindingId === record.bindingId)
            const operation = binding && inputs.operations.find((candidate) =>
              candidate.operationId === binding.operationId && candidate.version === binding.operationVersion)
            if (!binding || !operation) return false
            const expected: ConnectionVerificationRecord['hashes'] = {
              ...common,
              binding: canonicalHash(binding),
              operation: canonicalHash(operation),
            }
            return canonicalRecordHash(record.hashes) === canonicalRecordHash(expected)
          })
          .map((record) => record.verificationId)
      } catch {
        // The base lifecycle state already exposes missing/stale prerequisites.
      }
    }
    return state
  }

  applyGeneration(input: {
    projectId: string
    deployableId: string
    planId: string
    planHash: string
    explicit: boolean
    acceptDirtyWorktree?: boolean
  }): GenerationApplyRecord {
    if (!input.explicit) throw new Error('generation apply requires explicit user action')
    const bundle = this.integration.getGenerationBundle(input.projectId, input.planId)
    if (!bundle || bundle.deployableId !== input.deployableId) throw new Error('persisted generation plan not found for deployable')
    if (bundle.plan.planHash !== input.planHash) throw new Error('generation plan hash does not match persisted plan')
    const current = this.collectInputs(input.projectId, input.deployableId)
    if (current.inputHash !== bundle.inputHash) throw new Error('generation plan is stale because approved inputs changed')
    const applyRunId = `apply-${crypto.randomUUID()}`
    const startedAt = new Date().toISOString()
    const priorOwnership = this.integration.getLatestApplyRecord(input.projectId, input.deployableId)?.ownershipManifests ?? []
    const applying: GenerationApplyRecord = {
      schemaVersion: '1.0', projectId: input.projectId, deployableId: input.deployableId,
      planId: bundle.plan.planId, planHash: bundle.plan.planHash, applyRunId, status: 'applying',
      ownershipManifests: priorOwnership, commands: bundle.plan.commands, startedAt,
    }
    this.integration.saveApplyRecord(applying)
    try {
      const result = applyGenerationPlan({
        plan: bundle.plan,
        targetRoot: current.project.repoPath,
        virtualFiles: bundle.virtualFiles,
        ownershipManifest: priorOwnership,
        acceptDirtyWorktree: input.acceptDirtyWorktree,
        runId: applyRunId,
      })
      const virtualByPath = new Map(bundle.virtualFiles.map((file) => [file.path, file.contents]))
      const ownershipManifests = bundle.plan.fileChanges
        .filter((change) => change.ownership === 'generated' && change.action !== 'delete')
        .map((change) => {
          const content = virtualByPath.get(change.path)
          if (content === undefined) throw new Error(`generated virtual file missing for ownership record: ${change.path}`)
          return buildOwnershipManifest({
          projectId: input.projectId,
          filePath: change.path,
          content,
          generatorVersion: bundle.plan.generatorVersion,
          referenceProfileVersion: bundle.plan.referenceProfileVersion,
          sourceContractHashes: bundle.plan.inputRecords.map((record) => record.hash),
          deployableId: input.deployableId,
          moduleIds: current.deployable.moduleIds,
          lastAppliedPlanId: bundle.plan.planId,
          safeToDelete: true,
          })
        })
      const applied: GenerationApplyRecord = {
        ...applying, status: 'applied', rollbackId: result.rollbackId,
        ownershipManifests, commands: result.commands, completedAt: new Date().toISOString(),
      }
      this.integration.saveApplyRecord(applied)
      return applied
    } catch (error) {
      const failed: GenerationApplyRecord = {
        ...applying, status: 'failed', error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      }
      this.integration.saveApplyRecord(failed)
      throw error
    }
  }

  async runIntegrationCommands(input: {
    projectId: string
    deployableId: string
    planId: string
    planHash: string
    explicit: boolean
  }): Promise<IntegrationCommandRun> {
    if (!input.explicit) throw new Error('running integration commands requires explicit user action')
    const collected = this.collectInputs(input.projectId, input.deployableId)
    const bundle = this.integration.getCurrentGenerationBundle(input.projectId, input.deployableId)
    const apply = this.integration.getLatestApplyRecord(input.projectId, input.deployableId)
    if (!bundle || bundle.plan.planId !== input.planId || bundle.plan.planHash !== input.planHash) {
      throw new Error('current generation plan identity does not match the command request')
    }
    if (!apply || apply.status !== 'applied' || apply.planId !== input.planId || apply.planHash !== input.planHash) {
      throw new Error('apply the current generation plan before running its commands')
    }
    if (bundle.inputHash !== collected.inputHash) throw new Error('generated integration is stale; regenerate and apply before running commands')
    const runtime = buildRuntimeDistribution(collected.deployable, collected.project.repoPath)
    if (runtime.blockers.length) throw new Error(runtime.blockers.join(' '))
    const launch = generatedLaunchCommand(collected.deployable, collected.project.repoPath)
    const commands = [...new Set([
      ...runtime.commands.filter((command) => command !== launch),
      collected.deployable.commands.build,
      collected.deployable.commands.test,
    ].filter((command): command is string => Boolean(command)))]
    if (!commands.length) throw new Error('no approved install, build, or test commands are available for this deployable')

    const commandRunId = `commands-${crypto.randomUUID()}`
    const startedAt = new Date().toISOString()
    const running: IntegrationCommandRun = {
      schemaVersion: '1.0', projectId: input.projectId, deployableId: input.deployableId,
      planId: input.planId, planHash: input.planHash, commandRunId, status: 'running', results: [], startedAt,
    }
    this.integration.saveCommandRun(running)
    const results: IntegrationCommandRun['results'] = []
    for (const [index, command] of commands.entries()) {
      const label = index === 0 ? 'install' : `command-${index + 1}`
      const result = await runCommand({
        runId: commandRunId,
        commandLabel: label,
        commandText: command,
        workingDirectory: collected.project.repoPath,
        timeoutMs: 10 * 60 * 1000,
        outputDir: this.integration.commandOutputDirectory(input.projectId, commandRunId),
      })
      results.push({
        label,
        command: result.commandText,
        status: result.status,
        exitCode: result.exitCode,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        outputArtifactRefs: [result.stdoutPath, result.stderrPath, result.combinedOutputPath]
          .filter((value): value is string => Boolean(value))
          .map((value) => path.relative(this.capabilities.root(input.projectId), value).replaceAll(path.sep, '/')),
      })
      if (result.status !== 'passed') break
    }
    const completed: IntegrationCommandRun = {
      ...running,
      status: results.length === commands.length && results.every((result) => result.status === 'passed') ? 'passed' : 'failed',
      results,
      completedAt: new Date().toISOString(),
    }
    this.integration.saveCommandRun(completed)
    return completed
  }

  rollbackGeneration(input: { projectId: string; deployableId: string; rollbackId: string; explicit: boolean }): GenerationApplyRecord {
    if (!input.explicit) throw new Error('generation rollback requires explicit user action')
    const latest = this.integration.getLatestApplyRecord(input.projectId, input.deployableId)
    if (!latest || latest.status !== 'applied' || latest.rollbackId !== input.rollbackId) {
      throw new Error('current applied generation does not match rollback request')
    }
    const project = this.workspace.getProject(input.projectId)
    if (!project) throw new Error(`project not found: ${input.projectId}`)
    rollbackGenerationApply(project.repoPath, input.rollbackId)
    const rolledBack: GenerationApplyRecord = {
      ...latest, status: 'rolled-back', ownershipManifests: [], completedAt: new Date().toISOString(),
    }
    this.integration.saveApplyRecord(rolledBack)
    return rolledBack
  }

  listConnectionVerifications(projectId: string, deployableId?: string): ConnectionVerificationRecord[] {
    return this.integration.listConnectionVerifications(projectId, deployableId)
  }

  async verifyConnection(input: {
    projectId: string
    deployableId: string
    bindingId: string
    explicit: boolean
  }): Promise<ConnectionVerificationRecord> {
    if (!input.explicit) throw new Error('connection verification requires explicit user action')
    const collected = this.collectInputs(input.projectId, input.deployableId)
    const binding = collected.bindings.find((candidate) => candidate.bindingId === input.bindingId)
    if (!binding) throw new Error('approved inbound binding not found for deployable')
    const composition = collected.composition
    if (!composition) throw new Error('approved composition manifest is required before verification')

    const bundle = this.integration.getCurrentGenerationBundle(input.projectId, input.deployableId)
    const apply = this.integration.getLatestApplyRecord(input.projectId, input.deployableId)
    if (!bundle || !apply || apply.status !== 'applied'
      || apply.planId !== bundle.plan.planId || apply.planHash !== bundle.plan.planHash) {
      throw new Error('apply the current generation plan before verifying this connection')
    }
    if (bundle.inputHash !== collected.inputHash) throw new Error('generated integration is stale; regenerate and apply before verification')

    const operation = collected.operations.find((candidate) =>
      candidate.operationId === binding.operationId && candidate.version === binding.operationVersion)
    if (!operation) throw new Error('approved operation contract for binding was not found')
    const source = readCurrentOwnedSourceHashes(collected.project.repoPath, apply.ownershipManifests)
    if (!source.hashes) throw new Error(source.issue ?? 'generated-owned verification source is unavailable')

    const hashes: ConnectionVerificationRecord['hashes'] = {
      binding: canonicalHash(binding),
      operation: canonicalHash(operation),
      architecture: collected.architecture.contentHash,
      composition: composition.compositionHash,
      generatedOwnership: canonicalHash(apply.ownershipManifests),
      source: canonicalHash(source.hashes),
    }
    const correlationId = crypto.randomUUID()
    let launch: Parameters<typeof runConnectionVerification>[0]['launch']
    let trigger: Parameters<typeof runConnectionVerification>[0]['trigger']
    if (binding.kind === 'ui' && binding.transport === 'browser-local') {
      const launchUrl = collected.project.launchUrl
      const selector = binding.selectionEvidence?.selector
      if (!launchUrl) throw new Error('configure the actual application UI URL before verifying this browser-local connection')
      if (!selector) throw new Error('select the actual UI element before verifying this browser-local connection')
      if (binding.trigger === 'load') throw new Error('load-trigger browser verification requires an explicit application readiness marker')
      launch = {
        kind: 'in-process',
        start: async () => {
          let child: ChildProcess | undefined
          const dependencyChildren: ChildProcess[] = []
          for (const remoteBinding of collected.remoteHttpBindings) {
            const remoteDeployable = this.approvedDeployable(input.projectId, remoteBinding.deployableId)
            const remoteLaunchText = generatedLaunchCommand(remoteDeployable, collected.project.repoPath, remoteBinding)
              ?? remoteDeployable.commands.launch
            if (!remoteLaunchText) throw new Error(`remote HTTP deployable "${remoteDeployable.deployableId}" has no approved launch command`)
            const healthUrl = `http://127.0.0.1:3000/${remoteDeployable.runtimeLanguage === 'python' ? 'healthz' : 'health'}`
            if (!(await urlReachable(healthUrl))) {
              const approved = parseApprovedCommand(remoteLaunchText)
              const dependency = spawn(approved.command, approved.args, {
                cwd: collected.project.repoPath,
                env: remoteDeployable.runtimeLanguage === 'python' ? {
                  ...process.env,
                  PORT: '3000',
                  PYTHONPATH: [
                    collected.project.repoPath,
                    path.join(collected.project.repoPath, '.engineering-ui/capabilities/runtime/python/src'),
                    process.env.PYTHONPATH,
                  ].filter(Boolean).join(path.delimiter),
                } : { ...process.env, PORT: '3000' },
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: process.platform !== 'win32',
              })
              dependencyChildren.push(dependency)
              try {
                await waitForUrl(healthUrl, 15_000)
              } catch (error) {
                await stopSpawnedProcess(dependency)
                throw error
              }
            }
          }
          if (!(await urlReachable(launchUrl))) {
            if (!collected.project.launchCommand) throw new Error('the configured UI is not running and has no approved launch command')
            const approved = parseApprovedCommand(collected.project.launchCommand)
            child = spawn(approved.command, approved.args, {
              cwd: collected.project.repoPath, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
              detached: process.platform !== 'win32',
            })
            try {
              await waitForUrl(launchUrl, 45_000)
            } catch (error) {
              await stopSpawnedProcess(child)
              for (const dependency of dependencyChildren) await stopSpawnedProcess(dependency)
              throw error
            }
          }
          const { BrowserWindow } = await import('electron')
          const verificationWindow = new BrowserWindow({
            show: false,
            webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
          })
          await verificationWindow.loadURL(launchUrl)
          return {
            invoke: async (payload?: unknown) => {
              const requested = payload as { correlationId?: string } | undefined
              const requestedCorrelationId = requested?.correlationId
              if (!requestedCorrelationId) return { ok: false, outcome: 'verification correlation id missing' }
              const script = `(() => new Promise((resolve) => {
                globalThis.__EUIK_VERIFICATION_CORRELATION_ID = ${JSON.stringify(requestedCorrelationId)};
                const timeout = setTimeout(() => { cleanup(); resolve({ ok: false, outcome: 'UI trigger did not emit capability evidence' }); }, 10000);
                const listener = (event) => { cleanup(); resolve({ ok: true, outcome: 'UI element reached the browser-local capability', body: event.detail }); };
                const cleanup = () => { clearTimeout(timeout); globalThis.removeEventListener('euik-capability-invoked', listener); delete globalThis.__EUIK_VERIFICATION_CORRELATION_ID; };
                globalThis.addEventListener('euik-capability-invoked', listener, { once: true });
                const element = document.querySelector(${JSON.stringify(selector)});
                if (!element) { cleanup(); resolve({ ok: false, outcome: 'Selected UI element is not present in the launched application' }); return; }
                ${binding.trigger === 'submit'
                  ? `(element.closest('form') ?? element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));`
                  : binding.trigger === 'change'
                    ? `element.dispatchEvent(new Event('change', { bubbles: true }));`
                    : `(element instanceof HTMLElement ? element.click() : element.dispatchEvent(new MouseEvent('click', { bubbles: true })));`}
              }))()`
              return verificationWindow.webContents.executeJavaScript(script, true) as Promise<{ ok: boolean; outcome?: string; body?: unknown }>
            },
            close: async () => {
              if (!verificationWindow.isDestroyed()) verificationWindow.destroy()
              await stopSpawnedProcess(child)
              for (const dependency of dependencyChildren) await stopSpawnedProcess(dependency)
            },
          }
        },
      }
      trigger = { kind: 'ui', input: { correlationId } }
    } else {
      const launchText = generatedLaunchCommand(collected.deployable, collected.project.repoPath, binding)
        ?? collected.deployable.commands.launch
      if (!launchText) throw new Error('configure and approve a launch command for this deployable before verification')
      const launchCommand = parseApprovedCommand(launchText)
      launch = {
        command: launchCommand.command,
        args: launchCommand.args,
        cwd: collected.project.repoPath,
        env: collected.deployable.runtimeLanguage === 'python' ? {
          PYTHONPATH: [
            collected.project.repoPath,
            path.join(collected.project.repoPath, '.engineering-ui/capabilities/runtime/python/src'),
            process.env.PYTHONPATH,
          ].filter(Boolean).join(path.delimiter),
        } : undefined,
        healthPath: collected.deployable.runtimeLanguage === 'python' ? '/healthz' : '/health',
        readyTimeoutMs: 15_000,
      }
      const selectedTrigger = binding.kind === 'http'
      ? { kind: 'http' as const, method: binding.method, path: binding.path, body: {} }
      : binding.kind === 'cli'
        ? {
            kind: 'cli' as const,
            args: [binding.command, ...(binding.argumentMappings?.length
              ? binding.argumentMappings.map(() => '')
              : ['{}'])],
          }
        : binding.kind === 'embedded-library'
          ? { kind: 'embedded-library' as const, input: {} }
        : binding.kind === 'schedule'
          ? { kind: 'schedule' as const }
        : binding.kind === 'ui' && binding.transport === 'electron-ipc'
          ? { kind: 'electron-ipc' as const, input: {} }
        : undefined
      if (!selectedTrigger) throw new Error(`real verification for inbound binding kind "${binding.kind}" is not configured yet`)
      trigger = selectedTrigger
    }

    const record = await runConnectionVerification({
      verificationId: `verification-${crypto.randomUUID()}`,
      projectId: input.projectId,
      binding,
      deployable: collected.deployable,
      hashes,
      launch,
      trigger,
      correlationId,
      observedPathOverrides: { outboundAdapters: [...composition.outboundAdapterRefs].sort() },
    })
    this.integration.saveConnectionVerification(record)
    return record
  }
}
