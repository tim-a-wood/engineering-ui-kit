import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { productTrialSystems } from './systems.mjs'
import { renderProductDocument } from './ui/product-renderers.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const uiRoot = path.join(here, 'ui')
const sampleRoot = path.join(repoRoot, 'e2e-samples/product-trials')

function domainService(system) {
  const protectedActionId = system.scenarios.at(-1).actionId
  return `const transitions = new Map(${JSON.stringify(system.scenarios.map((item, index) => [item.actionId, {
    result: item.result,
    target: item.target,
    protected: index === system.scenarios.length - 1,
  }]), null, 2)})

export function createProductState() {
  return {
    product: ${JSON.stringify(system.name)},
    revision: 0,
    completed: [],
    lastResult: '',
    protectedRejections: 0,
  }
}

export function executeProductAction(state, actionId) {
  const transition = transitions.get(actionId)
  if (!transition) throw new Error(\`Unknown product action: \${actionId}\`)
  if (transition.protected) {
    return {
      state: { ...state, protectedRejections: state.protectedRejections + 1 },
      result: transition.result,
      mutatedApprovedState: false,
    }
  }
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      completed: [...state.completed, actionId],
      lastResult: transition.result,
    },
    result: transition.result,
    mutatedApprovedState: true,
  }
}

export function validateProductState(state) {
  if (!Array.isArray(state.completed)) throw new Error('The product state has no completed action list.')
  if (state.completed.includes(${JSON.stringify(protectedActionId)})) {
    throw new Error('A protected action changed the approved state.')
  }
  return true
}
`
}

function moduleService(system, module, moduleIndex) {
  const operations = system.scenarios
    .slice(0, -1)
    .filter((_scenario, index) => index % system.architecture.modules.length === moduleIndex)
    .map((scenario) => scenario.actionId)
  return `export const moduleDefinition = ${JSON.stringify({
    moduleId: module[0],
    name: module[1],
    moduleType: module[2],
    responsibility: module[3],
  }, null, 2)}

export const ownedOperations = ${JSON.stringify(operations, null, 2)}

export function ownsOperation(actionId) {
  return ownedOperations.includes(actionId)
}
`
}

function testRunner(system, appRelativePath) {
  const moduleFiles = system.architecture.modules.map(([moduleId]) =>
    `capabilities/modules/${moduleId}/operations.mjs`)
  return `import fs from 'node:fs'
import path from 'node:path'
import { createProductState, executeProductAction, validateProductState } from './capabilities/modules/${system.architecture.uiModuleId}/domain-service.mjs'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve(${JSON.stringify(appRelativePath)})
const scenarios = ${JSON.stringify(system.scenarios)}
const moduleFiles = ${JSON.stringify(moduleFiles)}
let state = createProductState()
const failures = []

for (const scenario of scenarios) {
  const before = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
  const execution = executeProductAction(state, scenario.actionId)
  state = execution.state
  if (execution.result !== scenario.result) failures.push(\`Unexpected result for \${scenario.name}\`)
  if (scenario.actionId === ${JSON.stringify(system.scenarios.at(-1).actionId)}) {
    const after = JSON.stringify({ revision: state.revision, completed: state.completed, lastResult: state.lastResult })
    if (before !== after || execution.mutatedApprovedState) failures.push('The protected action changed approved state.')
  }
}

try { validateProductState(state) } catch (error) { failures.push(error.message) }

const missingModules = moduleFiles.filter((file) => !fs.existsSync(path.resolve(file)))
const passed = fs.existsSync(appPath)
  && fs.statSync(appPath).size > 0
  && missingModules.length === 0
  && failures.length === 0

if (passed && screenshotPath && fs.existsSync(proofPath)) {
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
  fs.copyFileSync(proofPath, screenshotPath)
}

process.stdout.write(JSON.stringify({
  passed,
  module: process.argv[2] ?? 'all',
  artifact: appPath,
  architecture: ${JSON.stringify(system.architecture.style)},
  modules: moduleFiles.length,
  scenarios: scenarios.length,
  completed: state.completed.length,
  protectedRejections: state.protectedRejections,
  missingModules,
  failures,
}))
process.exitCode = passed ? 0 : 1
`
}

function writeSystem(system) {
  const relativeUi = `capabilities/modules/${system.architecture.uiModuleId}/ui`
  const sampleDir = path.join(sampleRoot, system.slug)
  const sampleUi = path.join(sampleDir, relativeUi)
  fs.rmSync(path.join(sampleDir, 'capabilities'), { recursive: true, force: true })
  fs.mkdirSync(sampleUi, { recursive: true })

  const html = renderProductDocument(system)
  fs.writeFileSync(path.join(sampleUi, 'index.html'), html)
  fs.copyFileSync(path.join(uiRoot, 'styles.css'), path.join(sampleUi, 'styles.css'))
  fs.copyFileSync(path.join(uiRoot, 'product-layouts.css'), path.join(sampleUi, 'product-layouts.css'))
  fs.copyFileSync(path.join(uiRoot, 'runtime.js'), path.join(sampleUi, 'runtime.js'))
  fs.writeFileSync(path.join(path.dirname(sampleUi), 'domain-service.mjs'), domainService(system))

  const cli = `import { createProductState, executeProductAction } from './domain-service.mjs'
const input = JSON.parse(process.argv.at(-1) || '{}')
const initial = createProductState()
const execution = executeProductAction(initial, input.actionId ?? ${JSON.stringify(system.scenarios[0].actionId)})
process.stdout.write(JSON.stringify({ ok: true, system: ${JSON.stringify(system.name)}, result: execution.result, state: execution.state }))
`
  fs.writeFileSync(path.join(path.dirname(sampleUi), 'cli.mjs'), cli)

  for (const [index, module] of system.architecture.modules.entries()) {
    const moduleRoot = path.join(sampleDir, 'capabilities/modules', module[0])
    fs.mkdirSync(moduleRoot, { recursive: true })
    fs.writeFileSync(path.join(moduleRoot, 'operations.mjs'), moduleService(system, module, index))
  }

  fs.writeFileSync(path.join(sampleDir, 'README.md'), `# ${system.name}

${system.description}

## Product structure

- Architecture style: ${system.architecture.style}
- Starting structure: ${system.architecture.structure}
${system.architecture.modules.map((module) => `- ${module[1]} (${module[2]}): ${module[3]}`).join('\n')}

## User tasks

${system.examples.map((item) => `- ${item}`).join('\n')}

## Protected outcome

- ${system.prohibited}
`)
  fs.writeFileSync(path.join(sampleDir, 'package.json'), `${JSON.stringify({
    name: system.slug,
    private: true,
    type: 'module',
    scripts: { test: 'node ./test-runner.mjs' },
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(sampleDir, 'test-runner.mjs'), testRunner(system, relativeUi + '/index.html'))
  fs.writeFileSync(path.join(sampleDir, 'product-trial.json'), `${JSON.stringify(system, null, 2)}\n`)
}

for (const system of productTrialSystems) {
  writeSystem(system)
  console.log(`generated ${system.slug}`)
}
