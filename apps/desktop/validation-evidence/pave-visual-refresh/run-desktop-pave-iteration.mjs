/**
 * Seed + run one Visual-refresh iteration against Desktop/pave web-client
 * (remediation/0 @ latest), not the older projects/PWA/PAVE tree.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import AdmZip from 'adm-zip'
import { Workspace, buildContext, buildPacketManifest, inspectOverlay, applyOverlay } from '../../../../packages/core/dist/index.js'
import {
  STANDARD_CONSTRAINTS,
  buildRecommendedPrompt,
  buildStandardPackMarkdown,
  buildTaskPacketMarkdown,
} from '../../dist/standardsTemplate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PAVE_ROOT = '/Users/timwood/Desktop/pave'
const PAVE_FRONTEND = path.join(PAVE_ROOT, 'web-client')
const DATA_DIR = path.join(os.homedir(), 'Library/Application Support/@engineering-ui-kit/desktop/workspace')
const PROJECT_NAME = 'PAVE Frontend'
const EVIDENCE = __dirname
const STAGE = path.join(EVIDENCE, 'overlay-stage-web-client')

function assertLatestCheckout() {
  const git = spawnSync('git', ['-C', PAVE_ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' })
  const branch = (git.stdout || '').trim()
  const tip = spawnSync('git', ['-C', PAVE_ROOT, 'log', '-1', '--oneline'], { encoding: 'utf8' }).stdout.trim()
  if (!fs.existsSync(path.join(PAVE_FRONTEND, 'ApplicationStyles.css'))) {
    throw new Error(`missing ApplicationStyles.css under ${PAVE_FRONTEND}`)
  }
  if (!fs.existsSync(path.join(PAVE_FRONTEND, 'ApplicationShell.html'))) {
    throw new Error(`missing ApplicationShell.html under ${PAVE_FRONTEND}`)
  }
  return { branch, tip }
}

function writeTokens(dest) {
  fs.writeFileSync(dest, `/**
 * Semantic token entry point — raw color values live only here.
 * Values match Engineering UI Kit standard pack v0.5.0.
 */
:root {
  color-scheme: dark;
  --semantic-surface-canvas: #07111f;
  --semantic-surface-panel: #0f172a;
  --semantic-surface-panel-raised: #111827;
  --semantic-surface-inset: #172033;
  --semantic-surface-overlay: #0f172a;
  --semantic-surface-scrim: rgba(2, 6, 23, 0.72);
  --semantic-text-primary: #f8fafc;
  --semantic-text-secondary: #cbd5e1;
  --semantic-text-muted: #94a3b8;
  --semantic-text-disabled: rgba(203, 213, 225, 0.38);
  --semantic-text-inverse: #ffffff;
  --semantic-border-subtle: rgba(148, 163, 184, 0.18);
  --semantic-border-strong: rgba(203, 213, 225, 0.34);
  --semantic-border-focus: #5478ff;
  --semantic-border-danger: #ef4444;
  --semantic-focus-ring: 0 0 0 2px #5478ff;
  --semantic-focus-ring-offset: 0 0 0 4px rgba(84, 120, 255, 0.16);
  --semantic-accent-primary: #2f5bff;
  --semantic-accent-primary-hover: #5478ff;
  --semantic-accent-primary-active: #2443cc;
  --semantic-accent-secondary: #a78bfa;
  --semantic-accent-glow: rgba(47, 91, 255, 0.22);
  --semantic-status-success: #34d399;
  --semantic-status-warning: #fbbf24;
  --semantic-status-danger: #f87171;
  --semantic-status-info: #60a5fa;
  --semantic-status-neutral: #94a3b8;
  --semantic-spacing-1: 4px;
  --semantic-spacing-2: 8px;
  --semantic-spacing-3: 12px;
  --semantic-spacing-4: 16px;
  --semantic-density-compact-control-height: 32px;
  --semantic-radius-sm: 4px;
  --semantic-radius-md: 8px;
  --semantic-radius-lg: 12px;
  --semantic-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.22);
  --semantic-shadow-md: 0 10px 24px rgba(0, 0, 0, 0.28);
  --semantic-shadow-overlay: 0 24px 72px rgba(0, 0, 0, 0.46);
  --semantic-typography-family-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --semantic-typography-family-mono: "JetBrains Mono", SFMono-Regular, Consolas, "Liberation Mono", monospace;
  --semantic-typography-size-sm: 13px;
  --semantic-typography-size-md: 14px;
  --semantic-typography-size-lg: 16px;
  --semantic-typography-weight-regular: 400;
  --semantic-typography-weight-medium: 500;
  --semantic-typography-weight-semibold: 600;
  --semantic-motion-duration-fast: 120ms;
  --semantic-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --semantic-z-index-overlay: 700;
  --semantic-z-index-modal: 800;
}
`)
}

function remapStyles(css) {
  let out = `@import url("/static/tokens.css");\n\n${css}`
  // Remap every dark-theme :root block that hardcodes --pave-bg:#001522
  out = out.replaceAll(/:root\{\s*color-scheme:dark;[\s\S]*?--pave-bg:#001522;[\s\S]*?--muted:[^;]+;\s*\}/g, () => `:root{
  color-scheme:dark;
  --pave-bg:var(--semantic-surface-canvas);
  --pave-bg-2:var(--semantic-surface-canvas);
  --pave-header:var(--semantic-surface-panel);
  --pave-panel:var(--semantic-surface-panel);
  --pave-panel-2:var(--semantic-surface-panel-raised);
  --pave-panel-3:var(--semantic-surface-inset);
  --pave-panel-4:var(--semantic-surface-canvas);
  --pave-row:var(--semantic-surface-inset);
  --pave-row-alt:var(--semantic-surface-panel-raised);
  --pave-row-hover:color-mix(in srgb, var(--semantic-surface-inset) 70%, var(--semantic-accent-primary) 30%);
  --pave-row-selected:color-mix(in srgb, var(--semantic-accent-primary) 55%, var(--semantic-surface-panel) 45%);
  --pave-border:var(--semantic-border-strong);
  --pave-border-soft:var(--semantic-border-subtle);
  --pave-accent:var(--semantic-accent-primary);
  --pave-accent-2:var(--semantic-accent-primary-hover);
  --pave-accent-soft:var(--semantic-surface-inset);
  --pave-accent-border:var(--semantic-border-subtle);
  --pave-accent-text:var(--semantic-text-primary);
  --pave-text:var(--semantic-text-primary);
  --pave-text-strong:var(--semantic-text-primary);
  --pave-muted:var(--semantic-text-muted);
  --blue:var(--semantic-accent-primary);
  --cyan:var(--semantic-accent-primary-hover);
  --bg:var(--semantic-surface-canvas);
  --panel:var(--semantic-surface-panel);
  --line:var(--semantic-border-subtle);
  --soft:var(--semantic-surface-inset);
  --text:var(--semantic-text-primary);
  --muted:var(--semantic-text-muted);
  --green:var(--semantic-status-success);
  --red:var(--semantic-status-danger);
  --warn:var(--semantic-status-warning);
}`)
  out = out.replaceAll('#001522', 'var(--semantic-surface-canvas)')
  out = out.replaceAll('#061B2C', 'var(--semantic-surface-panel)')
  out = out.replaceAll('#00AEEF', 'var(--semantic-accent-primary)')
  out = out.replaceAll('#1e7fd6', 'var(--semantic-accent-primary)')
  out += `

/* Engineering UI Kit visual refresh (Desktop/pave web-client iteration) */
:where(button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: none !important;
  box-shadow: var(--semantic-focus-ring), var(--semantic-focus-ring-offset) !important;
}
html,body,.app-shell {
  background: var(--semantic-surface-canvas) !important;
  color: var(--semantic-text-primary) !important;
  font-family: var(--semantic-typography-family-sans) !important;
  font-size: var(--semantic-typography-size-md) !important;
}
button {
  min-height: var(--semantic-density-compact-control-height) !important;
  border-radius: var(--semantic-radius-md) !important;
}
input:not([type=checkbox]):not([type=radio]), select, textarea {
  min-height: var(--semantic-density-compact-control-height) !important;
  border-radius: var(--semantic-radius-md) !important;
  background: var(--semantic-surface-inset) !important;
  border-color: var(--semantic-border-subtle) !important;
  color: var(--semantic-text-primary) !important;
}
.tab.active, .subtab.active {
  border-bottom-color: var(--semantic-accent-primary) !important;
  color: var(--semantic-text-primary) !important;
}
`
  return out
}

function patchHtml(html) {
  return html
    .replace(
      /<link rel="stylesheet" href="\/ApplicationStyles\.css\?v=[^"]+">/,
      `<link rel="stylesheet" href="/static/tokens.css?v=euik-desktop-pave-1">\n  <link rel="stylesheet" href="/ApplicationStyles.css?v=euik-desktop-pave-1">`,
    )
    .replace(/content="#001522"/, 'content="#07111f"')
}

function seedRun(workspace, project) {
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
      'PAVE experiment notes (Desktop/pave remediation/0):',
      '- Target is web-client/ (ApplicationStyles.css + shell HTML), not the older projects/PWA/PAVE source/frontend/pwa tree.',
      '- Controllers under web-client/*.js and API contracts must keep current behavior.',
      '- Introduce a single semantic token stylesheet and remap presentation to tokens.',
    ].join('\n'),
    scope: [
      'Presentation only: ApplicationStyles.css, tokens.css, ApplicationShell.html, index.html.',
      'Do not rewrite controller.js / panels / modals logic.',
    ].join('\n'),
    constraints: [
      'Preserve all existing behavior and FastAPI contracts.',
      'Do not convert the app to React/Vite in this pass.',
    ].join('\n'),
    acceptanceCriteria: [
      'Dark-first shell using semantic tokens through CSS custom properties with a single token entry stylesheet.',
      'Primary interactions still work.',
      'Visible focus indicators on interactive controls.',
    ].join('\n'),
    references: [
      'standard-pack.md (attached)',
      'Live app http://127.0.0.1:8765 from /Users/timwood/Desktop/pave',
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
  const recommendedPrompt = buildRecommendedPrompt({
    targetApplication: project.name,
    taskTitle: fields.taskTitle,
    goal: fields.goal,
    uploadFiles: buildPacketManifest([flatfilePath, taskAndStandardPackPath]).map((e) => e.file),
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
  return { run, context }
}

const checkout = assertLatestCheckout()
const workspace = new Workspace(DATA_DIR)
const existing = workspace.listProjects().find((p) => p.name === PROJECT_NAME)
const project = existing
  ? workspace.updateProject(existing.id, {
      repoPath: PAVE_FRONTEND,
      description: `Desktop/pave web-client on ${checkout.branch} (${checkout.tip})`,
      launchUrl: 'http://127.0.0.1:8765',
      launchCommand: 'PYTHONPATH=. .venv/bin/python -m uvicorn paveCore.server:app --host 127.0.0.1 --port 8765',
      verificationCommands: {},
      status: 'active',
    })
  : workspace.createProject({
      name: PROJECT_NAME,
      repoPath: PAVE_FRONTEND,
      description: `Desktop/pave web-client on ${checkout.branch} (${checkout.tip})`,
      status: 'active',
      launchUrl: 'http://127.0.0.1:8765',
      launchCommand: 'PYTHONPATH=. .venv/bin/python -m uvicorn paveCore.server:app --host 127.0.0.1 --port 8765',
      verificationCommands: {},
    })

workspace.saveSettings({ ...workspace.getSettings(), preferredTemplate: 'standards-refresh' })
const { run, context } = seedRun(workspace, project)

fs.rmSync(STAGE, { recursive: true, force: true })
fs.mkdirSync(STAGE, { recursive: true })
writeTokens(path.join(STAGE, 'tokens.css'))
fs.writeFileSync(
  path.join(STAGE, 'ApplicationStyles.css'),
  remapStyles(fs.readFileSync(path.join(PAVE_FRONTEND, 'ApplicationStyles.css'), 'utf8')),
)
for (const page of ['ApplicationShell.html', 'index.html']) {
  fs.writeFileSync(path.join(STAGE, page), patchHtml(fs.readFileSync(path.join(PAVE_FRONTEND, page), 'utf8')))
}

const zipPath = path.join(EVIDENCE, 'ui-overlay.zip')
const zip = new AdmZip()
for (const file of ['tokens.css', 'ApplicationStyles.css', 'ApplicationShell.html', 'index.html']) {
  zip.addLocalFile(path.join(STAGE, file), '', file)
}
zip.writeZip(zipPath)

const inspection = inspectOverlay(zipPath, { runId: run.id, targetRoot: PAVE_FRONTEND })
fs.writeFileSync(path.join(EVIDENCE, 'inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`)
fs.writeFileSync(path.join(workspace.runDir(run.id), 'overlay-inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`)
if (!inspection.canApply) {
  console.error(JSON.stringify({ blocked: true, hardBlockers: inspection.hardBlockers }, null, 2))
  process.exit(1)
}
const applied = applyOverlay(zipPath, inspection, {
  runId: run.id,
  targetRoot: PAVE_FRONTEND,
  acceptWarnings: true,
})
const appliedPath = path.join(workspace.runDir(run.id), 'applied-files.json')
fs.writeFileSync(appliedPath, `${JSON.stringify(applied, null, 2)}\n`)
fs.writeFileSync(path.join(EVIDENCE, 'applied-files.json'), `${JSON.stringify(applied, null, 2)}\n`)
workspace.updateRun(run.id, {
  currentStep: 'verify-review',
  overlayZipPath: zipPath,
  overlayInspectionPath: path.join(workspace.runDir(run.id), 'overlay-inspection.json'),
  appliedFilesPath: appliedPath,
})

const summary = {
  checkout,
  projectId: project.id,
  repoPath: project.repoPath,
  runId: run.id,
  context: {
    includedFileCount: context.inventory.includedFileCount,
    excludedFileCount: context.inventory.excludedFileCount,
    warnings: context.inventory.contextWarnings,
  },
  inspection: { canApply: inspection.canApply, warnings: inspection.warnings, hardBlockers: inspection.hardBlockers },
  applied: applied.files,
}
fs.writeFileSync(path.join(EVIDENCE, 'seed-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
