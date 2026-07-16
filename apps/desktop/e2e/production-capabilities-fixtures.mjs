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
  // GitHub's Windows temporary directory is exposed through an 8.3 path
  // containing `~`. Vite deliberately rejects every such path while its
  // default filesystem policy is strict, even when it is the configured
  // project root. This isolated fixture serves only its generated repository.
  fs.writeFileSync(path.join(root, 'vite.config.js'), [
    "import { defineConfig } from 'vite'",
    'export default defineConfig({ server: { fs: { strict: false } } })',
    '',
  ].join('\n'))
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

export function createPythonHeadlessFixture(root, projectId = 'production-python') {
  fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
  fs.writeFileSync(path.join(root, 'pyproject.toml'), [
    '[project]',
    'name = "euik-production-python-fixture"',
    'version = "0.0.0"',
    'requires-python = ">=3.11"',
    'dependencies = []',
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'src/domain/run_job.py'), [
    'from engineering_ui_capabilities_runtime.core import Outcome',
    'class JobRunOperation:',
    '    def execute(self, input, context):',
    '        return Outcome.success({"ran": True})',
    'def create_job_run():',
    '    return JobRunOperation()',
    '',
  ].join('\n'))

  const product = {
    schemaVersion: '1.0', projectId, id: 'app.production-python', revision: '1', status: 'draft',
    purpose: 'Run an approved background capability without a user interface.',
    outcomes: ['The scheduled job executes through the approved Python boundary.'],
    actors: [{ id: 'scheduler', text: 'Background scheduler' }], goals: [{ id: 'run', text: 'Run the background job' }],
    useCases: [{ id: 'use.run', text: 'Run a scheduled background job' }],
    scenarios: [{ id: 'scenario.run', text: 'The scheduler triggers the job and records success' }],
    information: [{ id: 'job-result', text: 'Job execution result' }],
    rules: [{ id: 'rule.headless', text: 'The application has no user interface.' }], externalSystems: [],
    constraints: [{ id: 'constraint.python', text: 'Runs locally using Python 3.11 or newer.' }],
    scope: { inScope: ['Scheduled Python operation'], outOfScope: ['User interface'] },
    acceptanceCases: [{ id: 'accept.run', description: 'Trigger the scheduled job', expectedOutcome: 'The operation reports ran=true.' }],
    sources: [{ id: 'source.fixture', text: 'Packaged production headless journey fixture' }], unresolvedQuestions: [], contentHash: 'pending',
  }
  const manifest = {
    schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.job', moduleVersion: '1.0.0', moduleType: 'domain',
    name: 'Background job', responsibility: 'Execute the approved background job operation.',
    ownedConcerns: ['job-execution'], excludedConcerns: ['presentation'],
    providedOperations: [{ operationId: 'job.run', contractVersion: '1.0.0' }], requiredOperations: [],
    verificationSuiteIds: ['suite.job'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/domain'],
  }
  const architecture = {
    schemaVersion: '1.0', projectId, id: 'arch.production-python', revision: '1', status: 'proposed',
    applicationSpecId: product.id, applicationSpecRevision: product.revision, applicationSpecHash: 'pending',
    capabilityProjections: [{ id: 'cap.job', name: 'Background job', moduleIds: [manifest.moduleId] }],
    moduleIds: [manifest.moduleId], dependencyEdges: [],
    operationAllocations: [{ operationId: 'job.run', moduleId: manifest.moduleId }], adapterAllocations: [],
    workflowTraces: [{ useCaseId: 'use.run', moduleIds: [manifest.moduleId] }], proposals: [], unresolvedQuestions: [],
    gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
  }
  const architectureProposal = {
    architecture, manifests: [manifest], moduleNeedTraces: [{ moduleId: manifest.moduleId, needIds: ['use.run'] }],
    moduleJustifications: [{ moduleId: manifest.moduleId, justification: 'distinct-rules' }],
  }
  const domainDetailIds = [
    'responsibility', 'exclusions', 'vocabulary', 'inputs-outputs', 'units-ranges', 'rules-invariants',
    'preconditions-postconditions', 'exceptional-outcomes', 'worked-examples', 'sources-assumptions', 'required-capabilities',
  ]
  const moduleResponse = {
    moduleId: manifest.moduleId, moduleType: manifest.moduleType, name: manifest.name, moduleVersion: manifest.moduleVersion,
    responsibility: manifest.responsibility, ownedConcerns: manifest.ownedConcerns, excludedConcerns: manifest.excludedConcerns,
    providedOperations: manifest.providedOperations, requiredOperations: [], verificationSuiteIds: manifest.verificationSuiteIds,
    runtimeAllocation: manifest.runtimeAllocation, events: [], ownedPaths: manifest.ownedPaths, configurationSchemaRef: null,
    operationContracts: [{
      schemaVersion: '1.0', operationId: 'job.run', version: '1.0.0', behavior: 'command',
      inputSchemaRef: 'job.input', outputSchemaRef: 'job.output', preconditions: [], postconditions: ['Reports successful execution.'],
      domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [], idempotency: 'idempotent', timeoutClass: 'short',
      cancellable: false, artifactTypes: [], provenanceFields: [],
    }],
    dataSchemas: [
      { schemaId: 'job.input', description: 'Scheduled job input', fields: [] },
      { schemaId: 'job.output', description: 'Scheduled job result', fields: [{ name: 'ran', type: 'boolean', required: true, description: 'Whether the job ran', constraints: [] }] },
    ],
    answers: domainDetailIds.map((id) => ({ id, text: `Confirmed ${id} behavior for the packaged headless journey.`, status: 'confirmed' })),
    acceptanceCases: [{ id: 'module.accept.run', description: 'Run on schedule', expectedOutcome: 'Returns ran=true.' }],
    rules: [{ id: 'module.rule.headless', text: 'No UI dependency is introduced.' }],
  }
  const responsesDir = path.join(root, '.e2e-responses')
  fs.mkdirSync(responsesDir, { recursive: true })
  const responseFiles = {
    product: path.join(responsesDir, 'product.json'), architecture: path.join(responsesDir, 'architecture.json'), module: path.join(responsesDir, 'module.json'),
  }
  fs.writeFileSync(responseFiles.product, JSON.stringify(product, null, 2))
  fs.writeFileSync(responseFiles.architecture, JSON.stringify(architectureProposal, null, 2))
  fs.writeFileSync(responseFiles.module, JSON.stringify(moduleResponse, null, 2))
  return { projectId, responseFiles, operationId: 'job.run' }
}

export function createExistingRepositoryFixture(root, projectId = 'production-existing') {
  const fixture = createPythonHeadlessFixture(root, projectId)
  fs.writeFileSync(path.join(root, 'legacy-data.txt'), 'preserved\n')
  fs.writeFileSync(path.join(root, 'legacy.py'), [
    'from pathlib import Path',
    'value = Path(__file__).with_name("legacy-data.txt").read_text(encoding="utf-8").strip()',
    'print(f"LEGACY_BEHAVIOR:{value}")',
    '',
  ].join('\n'))
  return { ...fixture, legacyExpected: 'LEGACY_BEHAVIOR:preserved' }
}

export function createMixedReactPythonFixture(root, projectId = 'production-mixed', uiPort = 56100) {
  fs.mkdirSync(path.join(root, 'src/ui'), { recursive: true })
  fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'euik-production-mixed-fixture', private: true, type: 'module',
    scripts: { dev: `vite --host 127.0.0.1 --port ${uiPort} --strictPort` },
    dependencies: { react: '^19.1.0' }, devDependencies: { vite: '^6.4.0' },
  }, null, 2) + '\n')
  fs.writeFileSync(path.join(root, 'vite.config.js'), [
    "import { defineConfig } from 'vite'",
    "export default defineConfig({ server: { fs: { strict: false }, proxy: { '/echo': 'http://127.0.0.1:3000' } } })",
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'pyproject.toml'), [
    '[project]', 'name = "euik-production-mixed-fixture"', 'version = "0.0.0"',
    'requires-python = ">=3.11"', 'dependencies = ["fastapi>=0.110"]', '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head><title>Mixed Capability UI</title><style>body{margin:0}#run-capability{position:absolute;left:20px;top:20px;width:220px;height:60px}h1{margin:100px 20px 10px}output{margin:20px}</style></head><body><main><button id="run-capability" data-cap-id="run-capability">Run mixed capability</button><h1>Mixed React and Python</h1><output id="result">Not run</output></main><script type="module" src="/src/main.js"></script></body></html>\n')
  fs.writeFileSync(path.join(root, 'src/main.js'), [
    "const generatedClients = import.meta.glob('./generated/browser/inbound/*.g.ts')",
    "document.querySelector('#run-capability').addEventListener('click', async () => {",
    '  const loadGeneratedClient = Object.values(generatedClients)[0]',
    "  if (!loadGeneratedClient) throw new Error('No generated UI binding is available yet')",
    '  const generated = await loadGeneratedClient()',
    "  const createClient = Object.entries(generated).find(([name, value]) => name.startsWith('create') && name.endsWith('Client') && typeof value === 'function')?.[1]",
    "  if (!createClient) throw new Error('Generated UI binding does not export a client factory')",
    '  const outcome = await createClient().call({})',
    "  document.querySelector('#result').textContent = outcome.kind === 'success' ? outcome.value.echo : outcome.kind",
    '})', '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'src/vite-env.d.ts'), [
    'interface ImportMeta {',
    '  glob(pattern: string): Record<string, () => Promise<Record<string, unknown>>>',
    '}', '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'src/ui/run.ts'), [
    "import type { Outcome } from '@engineering-ui-kit/capabilities-runtime'",
    'type RemoteClient = (input: Record<string, unknown>, options: { baseUrl: string }) => Promise<Outcome<{ echo: string }, never, string>>',
    'export function createUiRun() {',
    '  return {',
    "    code: 'ui.run',",
    '    async execute() {',
    "      const clients = import.meta.glob('../generated/browser/clients/remote-http.g.ts')",
    '      const load = Object.values(clients)[0]',
    "      if (!load) throw new Error('Generated remote HTTP client is unavailable')",
    '      const generated = await load()',
    "      const client = Object.entries(generated).find(([name, value]) => name.endsWith('Client') && typeof value === 'function')?.[1] as RemoteClient | undefined",
    "      if (!client) throw new Error('Generated remote HTTP client factory was not found')",
    '      return client({}, { baseUrl: globalThis.location.origin })',
    '    },',
    '  }',
    '}', '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'src/domain/echo.py'), [
    'from engineering_ui_capabilities_runtime.core import Outcome',
    'class EchoRunOperation:',
    '    def execute(self, input, context):',
    '        return Outcome.success({"echo": input.get("message", "mixed-success")})',
    'def create_echo_run():',
    '    return EchoRunOperation()', '',
  ].join('\n'))

  const product = {
    schemaVersion: '1.0', projectId, id: 'app.production-mixed', revision: '1', status: 'draft',
    purpose: 'Invoke a Python domain capability from a browser user interface through an approved HTTP boundary.',
    outcomes: ['The browser displays the result returned by the Python operation.'],
    actors: [{ id: 'user', text: 'Application user' }], goals: [{ id: 'run', text: 'Run the mixed-language capability' }],
    useCases: [{ id: 'use.run', text: 'Invoke Python from the browser' }], scenarios: [{ id: 'scenario.run', text: 'User clicks Run and sees the Python result' }],
    information: [{ id: 'echo', text: 'Echo request and response' }], rules: [{ id: 'rule.http', text: 'Language boundaries use the approved HTTP contract.' }],
    externalSystems: [], constraints: [{ id: 'constraint.languages', text: 'React and Python remain separate deployables.' }],
    scope: { inScope: ['Browser UI', 'Python HTTP operation'], outOfScope: ['External cloud services'] },
    acceptanceCases: [{ id: 'accept.run', description: 'Activate the mixed capability', expectedOutcome: 'The browser receives mixed-success.' }],
    sources: [{ id: 'source.fixture', text: 'Packaged production mixed journey fixture' }], unresolvedQuestions: [], contentHash: 'pending',
  }
  const uiManifest = {
    schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.ui', moduleVersion: '1.0.0', moduleType: 'experience',
    name: 'Mixed user experience', responsibility: 'Trigger the mixed-language workflow and present its result.',
    ownedConcerns: ['browser-presentation'], excludedConcerns: ['domain-echo'],
    providedOperations: [{ operationId: 'ui.run', contractVersion: '1.0.0' }],
    requiredOperations: [{ operationId: 'echo.run', contractVersion: '1.0.0' }],
    verificationSuiteIds: ['suite.mixed.ui'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/ui'],
  }
  const domainManifest = {
    schemaVersion: '1.0', architectureVersion: '1.0', moduleId: 'mod.echo', moduleVersion: '1.0.0', moduleType: 'domain',
    name: 'Python echo domain', responsibility: 'Return the approved echo result from Python.',
    ownedConcerns: ['echo-domain'], excludedConcerns: ['presentation'],
    providedOperations: [{ operationId: 'echo.run', contractVersion: '1.0.0' }], requiredOperations: [],
    verificationSuiteIds: ['suite.mixed.python'], runtimeAllocation: 'local-embedded', events: [], ownedPaths: ['src/domain'],
  }
  const architecture = {
    schemaVersion: '1.0', projectId, id: 'arch.production-mixed', revision: '1', status: 'proposed',
    applicationSpecId: product.id, applicationSpecRevision: product.revision, applicationSpecHash: 'pending',
    capabilityProjections: [{ id: 'cap.mixed', name: 'Mixed capability', moduleIds: [uiManifest.moduleId, domainManifest.moduleId] }],
    moduleIds: [uiManifest.moduleId, domainManifest.moduleId],
    dependencyEdges: [{ fromModuleId: uiManifest.moduleId, toModuleId: domainManifest.moduleId, reason: 'The UI workflow invokes the Python echo operation through an HTTP port.' }],
    operationAllocations: [
      { operationId: 'ui.run', moduleId: uiManifest.moduleId }, { operationId: 'echo.run', moduleId: domainManifest.moduleId },
    ], adapterAllocations: [], workflowTraces: [{ useCaseId: 'use.run', moduleIds: [uiManifest.moduleId, domainManifest.moduleId] }],
    proposals: [], unresolvedQuestions: [], gateResult: { gateId: 'CAP-GATE-002', passed: false, diagnostics: [] }, contentHash: 'pending',
  }
  const architectureProposal = {
    architecture, manifests: [uiManifest, domainManifest],
    moduleNeedTraces: [
      { moduleId: uiManifest.moduleId, needIds: ['use.run'] }, { moduleId: domainManifest.moduleId, needIds: ['use.run'] },
    ],
    moduleJustifications: [
      { moduleId: uiManifest.moduleId, justification: 'distinct-rules' }, { moduleId: domainManifest.moduleId, justification: 'distinct-rules' },
    ],
  }
  const uiDetails = ['responsibility', 'exclusions', 'supported-workflows', 'required-information', 'actions-results', 'loading-empty-error', 'responsive-a11y', 'capability-bindings']
  const domainDetails = ['responsibility', 'exclusions', 'vocabulary', 'inputs-outputs', 'units-ranges', 'rules-invariants', 'preconditions-postconditions', 'exceptional-outcomes', 'worked-examples', 'sources-assumptions', 'required-capabilities']
  const operation = (operationId, inputSchemaRef, outputSchemaRef) => ({
    schemaVersion: '1.0', operationId, version: '1.0.0', behavior: 'command', inputSchemaRef, outputSchemaRef,
    preconditions: [], postconditions: ['Returns a successful result.'], domainRejections: [], technicalErrors: ['unexpected'], sideEffects: [],
    idempotency: 'idempotent', timeoutClass: 'short', cancellable: false, artifactTypes: [], provenanceFields: [],
  })
  const uiResponse = {
    ...uiManifest, operationContracts: [operation('ui.run', 'ui.input', 'ui.output')],
    dataSchemas: [
      { schemaId: 'ui.input', description: 'UI request', fields: [] },
      { schemaId: 'ui.output', description: 'UI result', fields: [{ name: 'echo', type: 'string', required: true, description: 'Python result', constraints: [] }] },
    ], answers: uiDetails.map((id) => ({ id, text: `Confirmed ${id} for the mixed browser module.`, status: 'confirmed' })),
    acceptanceCases: [{ id: 'ui.accept', description: 'Click Run', expectedOutcome: 'Python result is visible.' }], rules: [], configurationSchemaRef: null,
  }
  const domainResponse = {
    ...domainManifest, operationContracts: [operation('echo.run', 'echo.input', 'echo.output')],
    dataSchemas: [
      { schemaId: 'echo.input', description: 'Echo request', fields: [{ name: 'message', type: 'string', required: false, description: 'Optional message', constraints: [] }] },
      { schemaId: 'echo.output', description: 'Echo result', fields: [{ name: 'echo', type: 'string', required: true, description: 'Echo value', constraints: [] }] },
    ], answers: domainDetails.map((id) => ({ id, text: `Confirmed ${id} for the mixed Python module.`, status: 'confirmed' })),
    acceptanceCases: [{ id: 'echo.accept', description: 'Invoke echo', expectedOutcome: 'Returns mixed-success.' }], rules: [], configurationSchemaRef: null,
  }
  const responsesDir = path.join(root, '.e2e-responses')
  fs.mkdirSync(responsesDir, { recursive: true })
  const responseFiles = {
    product: path.join(responsesDir, 'product.json'), architecture: path.join(responsesDir, 'architecture.json'),
    uiModule: path.join(responsesDir, 'module-ui.json'), domainModule: path.join(responsesDir, 'module-domain.json'),
  }
  fs.writeFileSync(responseFiles.product, JSON.stringify(product, null, 2))
  fs.writeFileSync(responseFiles.architecture, JSON.stringify(architectureProposal, null, 2))
  fs.writeFileSync(responseFiles.uiModule, JSON.stringify(uiResponse, null, 2))
  fs.writeFileSync(responseFiles.domainModule, JSON.stringify(domainResponse, null, 2))
  return { projectId, responseFiles, uiPort, uiUrl: `http://127.0.0.1:${uiPort}`, uiOperationId: 'ui.run', domainOperationId: 'echo.run' }
}
