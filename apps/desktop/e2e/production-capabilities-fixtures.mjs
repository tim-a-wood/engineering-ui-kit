import fs from 'node:fs'
import path from 'node:path'

const OPERATION_ID = 'echo.run'

export function createTypeScriptUiFixture(root, projectId = 'production-ui', port = 5417) {
  fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'euik-production-ui-fixture', private: true, type: 'module',
    scripts: { dev: `vite --host 127.0.0.1 --port ${port} --strictPort` },
    devDependencies: { vite: '^6.4.0' },
  }, null, 2) + '\n')
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head><title>Capability UI</title><style>body{margin:0}#run-capability{position:absolute;left:20px;top:20px;width:200px;height:60px}h1{margin:100px 20px 10px}output{margin:20px}</style></head><body><main><button id="run-capability" data-cap-id="run-capability">Run capability</button><h1>Capability UI</h1><output id="result">Not run</output></main><script type="module" src="/src/main.js"></script></body></html>\n')
  fs.writeFileSync(path.join(root, 'src/main.js'), [
    "const generatedClients = import.meta.glob('./generated/browser/inbound/*.g.ts')",
    "document.querySelector('#run-capability').addEventListener('click', async () => {",
    '  const loadGeneratedClient = Object.values(generatedClients)[0]',
    "  if (!loadGeneratedClient) throw new Error('No generated UI binding is available yet')",
    '  const generated = await loadGeneratedClient()',
    "  const createClient = Object.entries(generated).find(([name, value]) => name.startsWith('create') && name.endsWith('Client') && typeof value === 'function')?.[1]",
    "  if (!createClient) throw new Error('Generated UI binding does not export a client factory')",
    '  const client = createClient()',
    "  const outcome = await client.call({ message: 'hello' })",
    "  document.querySelector('#result').textContent = outcome.kind === 'success' ? outcome.value.echo : outcome.kind",
    '})',
  ].join('\n') + '\n')
  fs.writeFileSync(path.join(root, 'src/domain/echo_run.ts'), [
    "import { Outcome } from '@engineering-ui-kit/capabilities-runtime'",
    'export function createEchoRun() {',
    `  return { code: '${OPERATION_ID}', execute(input: { message?: string }) { return Outcome.success({ echo: input?.message ?? 'hello' }) } }`,
    '}',
  ].join('\n') + '\n')

  const product = {
    schemaVersion: '1.0', projectId, id: 'app.production-ui', revision: '1', status: 'draft',
    purpose: 'Run one approved capability from a real browser user interface.', outcomes: ['The user can run the capability and see its result.'],
    actors: [{ id: 'user', text: 'Application user' }], goals: [{ id: 'run', text: 'Run the approved capability' }],
    useCases: [{ id: 'use.run', text: 'Run capability from the UI' }], scenarios: [{ id: 'scenario.run', text: 'User activates Run capability and sees success' }],
    information: [{ id: 'echo', text: 'Echo input and output' }], rules: [{ id: 'rule.local', text: 'The operation runs through the approved local boundary.' }],
    externalSystems: [], constraints: [{ id: 'constraint.local', text: 'Runs locally.' }],
    scope: { inScope: ['Browser UI trigger', 'Local operation'], outOfScope: ['Remote services'] },
    acceptanceCases: [{ id: 'accept.run', description: 'Activate Run capability', expectedOutcome: 'The result says hello.' }],
    sources: [{ id: 'source.fixture', text: 'Packaged production journey fixture' }], unresolvedQuestions: [], contentHash: 'pending',
  }
  const manifest = {
    schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.echo.ui', moduleVersion: '1.0.0', moduleType: 'experience',
    name: 'Echo user experience', responsibility: 'Present and run the echo capability from the browser UI.',
    ownedConcerns: ['browser-presentation', 'capability-trigger'], excludedConcerns: ['remote-integration', 'persistence'],
    providedOperations: [{ operationId: OPERATION_ID, contractVersion: '1.0.0' }], requiredOperations: [],
    verificationSuiteIds: ['suite.echo.ui'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/domain'],
  }
  const architecture = {
    schemaVersion: '1.0', projectId, id: 'arch.production-ui', revision: '1', status: 'proposed',
    applicationSpecId: product.id, applicationSpecRevision: product.revision, applicationSpecHash: 'pending',
    capabilityProjections: [{ id: 'cap.echo', name: 'Echo', moduleIds: [manifest.moduleId] }], moduleIds: [manifest.moduleId],
    dependencyEdges: [], operationAllocations: [{ operationId: OPERATION_ID, moduleId: manifest.moduleId }], adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'use.run', moduleIds: [manifest.moduleId] }], proposals: [], unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
  }
  const architectureProposal = {
    architecture, manifests: [manifest],
    moduleNeedTraces: [{ moduleId: manifest.moduleId, needIds: ['use.run'] }],
    moduleJustifications: [{ moduleId: manifest.moduleId, justification: 'distinct-rules' }],
  }
  const detailIds = ['responsibility', 'exclusions', 'supported-workflows', 'required-information', 'actions-results', 'loading-empty-error', 'responsive-a11y', 'capability-bindings']
  const operationContract = {
    schemaVersion: '1.0', operationId: OPERATION_ID, version: '1.0.0', behavior: 'command',
    inputSchemaRef: 'echo.input', outputSchemaRef: 'echo.output', preconditions: [], postconditions: ['Returns the supplied message.'],
    domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short',
    cancellable: false, artifactTypes: [], provenanceFields: [],
  }
  const moduleResponse = {
    moduleId: manifest.moduleId, moduleType: manifest.moduleType, name: manifest.name, moduleVersion: manifest.moduleVersion,
    responsibility: manifest.responsibility, ownedConcerns: manifest.ownedConcerns, excludedConcerns: manifest.excludedConcerns,
    providedOperations: manifest.providedOperations, requiredOperations: [], verificationSuiteIds: manifest.verificationSuiteIds,
    runtimeAllocation: manifest.runtimeAllocation, events: [], ownedPaths: manifest.ownedPaths, configurationSchemaRef: null,
    operationContracts: [operationContract],
    dataSchemas: [
      { schemaId: 'echo.input', description: 'Echo request', fields: [{ name: 'message', type: 'string', required: false, description: 'Message to echo', constraints: [] }] },
      { schemaId: 'echo.output', description: 'Echo result', fields: [{ name: 'echo', type: 'string', required: true, description: 'Echoed message', constraints: [] }] },
    ],
    answers: detailIds.map((id) => ({ id, text: `Confirmed ${id} behavior for the packaged UI journey.`, status: 'confirmed' })),
    acceptanceCases: [{ id: 'module.accept.run', description: 'Run from the browser', expectedOutcome: 'Success is visible.' }],
    rules: [{ id: 'module.rule.boundary', text: 'Use the generated browser-local boundary.' }],
  }
  const responsesDir = path.join(root, '.e2e-responses')
  fs.mkdirSync(responsesDir, { recursive: true })
  const responseFiles = {
    product: path.join(responsesDir, 'product.json'),
    architecture: path.join(responsesDir, 'architecture.json'),
    module: path.join(responsesDir, 'module.json'),
  }
  fs.writeFileSync(responseFiles.product, JSON.stringify(product, null, 2))
  fs.writeFileSync(responseFiles.architecture, JSON.stringify(architectureProposal, null, 2))
  fs.writeFileSync(responseFiles.module, JSON.stringify(moduleResponse, null, 2))
  return { projectId, responseFiles, operationId: OPERATION_ID, uiUrl: `http://127.0.0.1:${port}` }
}
