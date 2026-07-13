/**
 * Seed a Visual-refresh experiment against the PAVE PWA frontend.
 * Usage: node apps/desktop/scripts/seed-pave-experiment.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Workspace, buildContext, buildPacketManifest } from '../../../packages/core/dist/index.js'
import {
  STANDARD_CONSTRAINTS,
  buildRecommendedPrompt,
  buildStandardPackMarkdown,
  buildTaskPacketMarkdown,
} from '../dist/standardsTemplate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PAVE_FRONTEND = '/Users/timwood/Desktop/projects/PWA/PAVE/source/frontend/pwa'
const DATA_DIR = path.join(os.homedir(), 'Library/Application Support/@engineering-ui-kit/desktop/workspace')
const PROJECT_NAME = 'PAVE Frontend'

if (!fs.existsSync(PAVE_FRONTEND)) {
  throw new Error(`PAVE frontend not found at ${PAVE_FRONTEND}`)
}

const workspace = new Workspace(DATA_DIR)
const existing = workspace.listProjects().find((project) => project.name === PROJECT_NAME || project.repoPath === PAVE_FRONTEND)
const project = existing
  ? workspace.updateProject(existing.id, {
      name: PROJECT_NAME,
      repoPath: PAVE_FRONTEND,
      description: 'Experiment: apply Engineering UI Kit visual standards to the existing PAVE PWA client (source/frontend/pwa).',
      status: 'active',
      launchUrl: 'http://127.0.0.1:8765',
      launchCommand: 'bash scripts/run-backend.sh',
      verificationCommands: {},
      isSample: false,
    })
  : workspace.createProject({
      name: PROJECT_NAME,
      repoPath: PAVE_FRONTEND,
      description: 'Experiment: apply Engineering UI Kit visual standards to the existing PAVE PWA client (source/frontend/pwa).',
      status: 'active',
      launchUrl: 'http://127.0.0.1:8765',
      launchCommand: 'bash scripts/run-backend.sh',
      verificationCommands: {},
    })

const settings = workspace.getSettings()
workspace.saveSettings({ ...settings, preferredTemplate: 'standards-refresh' })

const run = workspace.createRun({ projectId: project.id, currentStep: 'prepare-context' })
const context = buildContext(project.repoPath, {
  projectId: project.id,
  packetId: run.id,
  sourceRepo: project.name,
})
const runDir = workspace.runDir(run.id)
fs.mkdirSync(runDir, { recursive: true })
const flatfilePath = path.join(runDir, 'repo-flatfile.txt')
fs.writeFileSync(flatfilePath, context.flatfileText)
const inventoryPath = workspace.saveRunArtifact(run.id, 'repo-inventory.json', context.inventory)
workspace.updateRun(run.id, {
  currentStep: 'create-task-packet',
  repoFlatfilePath: flatfilePath,
  repoInventoryPath: inventoryPath,
})

const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const fields = {
  taskTitle: `Visual refresh for ${project.name}`,
  goal: [
    `Refresh the existing UI of ${project.name} visually to Engineering UI Kit dark-first standards while preserving all existing domain behavior, data flow, and interactions.`,
    '',
    'PAVE experiment notes:',
    '- Target is the vanilla HTML/CSS/JS PWA under source/frontend/pwa (not a Vite/React app).',
    '- Primary surfaces: pages/application-shell-page.html, pages/index-page.html, and styles/*.css.',
    '- Controllers under scripts/ and API calls to the FastAPI backend must keep current behavior.',
    '- Prefer introducing a single semantic token stylesheet and remapping presentation to tokens; do not rewrite product logic.',
  ].join('\n'),
  scope: [
    'Presentation, layout, and styling only: stylesheets under styles/, page markup under pages/, and asset presentation where required.',
    'Existing script/controller structure may be touched only where presentation requires (class names, ARIA, focus hooks).',
    'Start with the primary application shell; leave secondary overlays untouched unless required for token consistency.',
  ].join('\n'),
  constraints: [
    'Preserve all existing behavior: state handling, validation, serialization, dialogs, focus management, and backend API contracts.',
    'Do not convert the app to React/Vite in this pass; keep the static PWA architecture.',
    'Do not modify the FastAPI backend or MATLAB worker.',
  ].join('\n'),
  acceptanceCriteria: [
    'Dark-first shell using semantic tokens through CSS custom properties with a single token entry stylesheet.',
    'All pre-existing interactions still work exactly as before (open/run/import/export, modals, overlays).',
    'Keyboard operation and visible focus remain intact on primary controls.',
    'Loading, empty, and error states remain readable after the visual refresh.',
  ].join('\n'),
  references: [
    'standard-pack.md (attached): applicable rule IDs, component IDs, and the semantic token table.',
    'PAVE README: app served at http://127.0.0.1:8765 via scripts/run-backend.sh from the PAVE repo root.',
  ].join('\n'),
}

const taskPacketText = buildTaskPacketMarkdown({
  packetId: run.id,
  targetApplication: project.name,
  targetAppRoot: project.repoPath,
  taskTitle: fields.taskTitle,
  goal: fields.goal,
  scope: fields.scope.split('\n').filter(Boolean),
  constraints: [...fields.constraints.split('\n').filter(Boolean), ...STANDARD_CONSTRAINTS],
  acceptanceCriteria: fields.acceptanceCriteria.split('\n').filter(Boolean),
  references: fields.references.split('\n').filter(Boolean),
  generatedAt,
})
const standardPackText = buildStandardPackMarkdown({ standardsVersion: '0.5.0', generatedAt })
const taskPacketPath = path.join(runDir, 'task-packet.md')
const standardPackPath = path.join(runDir, 'standard-pack.md')
const taskAndStandardPackPath = path.join(runDir, 'task-and-standard-pack.md')
fs.writeFileSync(taskPacketPath, taskPacketText)
fs.writeFileSync(standardPackPath, standardPackText)
fs.writeFileSync(taskAndStandardPackPath, `${taskPacketText}\n\n---\n\n${standardPackText}`)

const uploadPaths = [flatfilePath, taskAndStandardPackPath]
const manifest = buildPacketManifest(uploadPaths)
const recommendedPrompt = buildRecommendedPrompt({
  targetApplication: project.name,
  taskTitle: fields.taskTitle,
  goal: fields.goal,
  uploadFiles: manifest.map((entry) => entry.file),
})
fs.writeFileSync(path.join(runDir, 'recommended-prompt.txt'), recommendedPrompt)

workspace.updateRun(run.id, {
  currentStep: 'run-in-copilot',
  taskTitle: fields.taskTitle,
  taskPacketFields: fields,
  taskPacketBuiltAt: generatedAt,
  taskPacketPath,
  standardPackPath,
  taskAndStandardPackPath,
  uploadSetType: 'text-only',
})

const evidenceDir = path.join(__dirname, '../validation-evidence/pave-visual-refresh')
fs.mkdirSync(evidenceDir, { recursive: true })
const summary = {
  seededAt: generatedAt,
  projectId: project.id,
  projectName: project.name,
  repoPath: project.repoPath,
  runId: run.id,
  launchUrl: project.launchUrl,
  context: {
    includedFileCount: context.inventory.includedFileCount,
    excludedFileCount: context.inventory.excludedFileCount,
    warnings: context.inventory.contextWarnings,
    flatfileBytes: Buffer.byteLength(context.flatfileText),
  },
  artifacts: {
    runDir,
    flatfilePath,
    taskAndStandardPackPath,
    recommendedPromptPath: path.join(runDir, 'recommended-prompt.txt'),
  },
  note: 'There is no web-app/ folder; README canonical frontend is source/frontend/pwa. Handoff is ready for Copilot Visual refresh.',
}
fs.writeFileSync(path.join(evidenceDir, 'seed-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(JSON.stringify(summary, null, 2))
