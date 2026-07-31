/**
 * Packaged-app portfolio trial.
 *
 * Every product starts with a brief and a test runner. This script uses only
 * rendered controls in the packaged application to create approved intent,
 * design the product, apply its implementation, map the real UI, run the
 * approved scenarios, and inspect immutable evidence.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { productTrialSystems } from './product-trials/systems.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SAMPLE_TEMPLATE_ROOT = path.join(REPO_ROOT, 'e2e-samples/product-trials')
const OVERLAY_ROOT = SAMPLE_TEMPLATE_ROOT
const OUTPUT_ROOT = path.join(REPO_ROOT, 'docs/product-trials/2026-07-31-diverse/evidence')
const TIMEOUT = Number(process.env.EUIK_PRODUCT_TRIAL_TIMEOUT_MS ?? 70_000)
const JOURNEY_TIMEOUT = Number(process.env.EUIK_PRODUCT_TRIAL_JOURNEY_TIMEOUT_MS ?? 720_000)

function appRelativePath(system) {
  return `capabilities/modules/${system.architecture.uiModuleId}/ui/index.html`
}

function exactText(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

function designModuleOrder(system) {
  const modules = [
    ...system.architecture.modules.map((module) => ({ id: module[0], name: module[1], responsibility: module[3] })),
    ...(system.architecture.structure === 'Experience-first'
      ? [{ id: 'mod.experience-first', name: 'User workspace', responsibility: 'Presents the approved user tasks and visible results.' }]
      : []),
  ]
  const byId = new Map(modules.map((module) => [module.id, module]))
  const targets = new Map()
  for (const [fromModuleId, toModuleId] of system.architecture.dependencies) {
    targets.set(fromModuleId, [...(targets.get(fromModuleId) ?? []), toModuleId])
  }
  const result = []
  const visited = new Set()
  const active = new Set()
  const visit = (moduleId) => {
    if (visited.has(moduleId) || active.has(moduleId)) return
    active.add(moduleId)
    for (const targetId of targets.get(moduleId) ?? []) visit(targetId)
    active.delete(moduleId)
    visited.add(moduleId)
    const module = byId.get(moduleId)
    if (module) result.push(module)
  }
  for (const module of modules) visit(module.id)
  return result
}

function selectedSystems() {
  const requested = new Set(
    String(process.env.EUIK_PRODUCT_TRIALS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
  if (requested.size === 0) return productTrialSystems
  const selected = productTrialSystems.filter((system) => requested.has(system.slug))
  const missing = [...requested].filter((slug) => !selected.some((system) => system.slug === slug))
  if (missing.length) throw new Error(`Unknown product trial: ${missing.join(', ')}`)
  return selected
}

function packagedExecutable() {
  const candidates = [
    path.join(REPO_ROOT, 'release/mac-arm64/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
    path.join(REPO_ROOT, 'release/mac/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
  ]
  const executable = candidates.find((candidate) => fs.existsSync(candidate))
  if (!executable) throw new Error('Run the desktop package:dir script before this trial.')
  return executable
}

function prepareOverlay(system, scratchRoot) {
  const overlayZip = path.join(scratchRoot, `${system.slug}-overlay.zip`)
  execFileSync('zip', ['-q', '-r', overlayZip, 'capabilities'], {
    cwd: path.join(OVERLAY_ROOT, system.slug),
  })
  return overlayZip
}

function prepareSample(system, scratchRoot) {
  const sourceRoot = path.join(SAMPLE_TEMPLATE_ROOT, system.slug)
  const sampleRoot = path.join(scratchRoot, system.slug)
  fs.mkdirSync(sampleRoot, { recursive: true })
  for (const fileName of ['README.md', 'package.json', 'test-runner.mjs', 'product-trial.json']) {
    fs.copyFileSync(path.join(sourceRoot, fileName), path.join(sampleRoot, fileName))
  }
  return sampleRoot
}

async function visible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT }).catch((error) => {
    throw new Error(`${description} was not visible: ${error.message}`)
  })
  return locator
}

async function waitEnabled(locator, description, timeout = TIMEOUT) {
  await visible(locator, description)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return locator
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error(`${description} did not become enabled`)
}

async function click(locator, description, audit) {
  await visible(locator, description)
  await locator.click({ timeout: TIMEOUT })
  audit.clicks += 1
}

async function shot(page, outputDir, name, audit, options = {}) {
  const outputPath = path.join(outputDir, `${name}.png`)
  await page.waitForTimeout(options.delay ?? 220)
  await page.screenshot({
    path: outputPath,
    fullPage: options.fullPage ?? false,
  })
  audit.screenshots.push(path.relative(REPO_ROOT, outputPath))
  return outputPath
}

async function runPhase(audit, name, task) {
  const startedAt = Date.now()
  const firstClick = audit.clicks
  process.stdout.write(`[${audit.slug}] ${name}\n`)
  try {
    const result = await task()
    audit.phases.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      clicks: audit.clicks - firstClick,
    })
    return result
  } catch (error) {
    audit.phases.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      clicks: audit.clicks - firstClick,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function addFinding(audit, finding) {
  audit.findings.push(finding)
}

function observeRenderer(page, audit) {
  page.setDefaultTimeout(TIMEOUT)
  page.on('pageerror', (error) => {
    audit.rendererErrors.push({ source: 'pageerror', message: error.message })
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      audit.rendererErrors.push({ source: 'console', message: message.text() })
    }
  })
}

async function closePackagedApp(app) {
  if (!app) return
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 10_000)),
  ])
  try {
    if (!app.process().killed) app.process().kill('SIGKILL')
  } catch {
    // The normal close path already ended the process.
  }
}

async function completeModuleDesign(page, outputDir, audit, system, module) {
  const moduleName = module.name
  const moduleSlug = moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await click(page.getByRole('button', { name: 'Create module draft' }), 'Create module draft', audit)
  await visible(
    page.locator('.design-session > .design-session-header h2', { hasText: moduleName }),
    `${moduleName} design session`,
  )

  for (let guard = 0; guard < 14; guard += 1) {
    const session = page.locator('.design-session')
    const currentStep = session.locator('.design-session-step.current')
    const currentText = (await currentStep.textContent())?.trim() ?? ''

    if (/Review diagrams/i.test(currentText)) {
      const fullScreen = page.getByRole('button', { name: 'Full screen', exact: true })
      if (await fullScreen.count()) await click(fullScreen, `Open ${moduleName} diagram review`, audit)
      for (const diagramName of ['Component', 'Activity', 'State machine', 'Sequence', 'Use case']) {
        const tab = page.getByRole('tab', { name: diagramName })
        if (!await tab.count()) continue
        await click(tab, `Review ${moduleName} ${diagramName}`, audit)
        await shot(
          page,
          outputDir,
          `06-${moduleSlug}-${diagramName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          audit,
        )
      }
      const exitFullScreen = page.getByRole('button', { name: 'Exit full screen', exact: true })
      if (await exitFullScreen.count()) await click(exitFullScreen, `Close ${moduleName} diagram review`, audit)
    }

    if (/Approve module/i.test(currentText)) break

    const questions = session.locator('.design-required-question')
    if (await questions.count()) {
      const count = await questions.count()
      for (let index = 0; index < count; index += 1) {
        const question = questions.nth(index)
        await question.locator('textarea').fill(
          `${module.responsibility} Use the approved repository path. Show a clear result. Preserve the last approved state after a failure.`,
        )
        await click(question.getByRole('button', { name: 'Save answer' }), 'Save module answer', audit)
      }
      continue
    }

    const primary = session.locator('.design-session-primary-action').getByRole('button').first()
    const label = (await primary.textContent())?.trim() ?? ''
    if (!label) throw new Error(`No module action was available at ${currentText}`)
    if (/Fix \d+ design error/i.test(label)) {
      throw new Error(`The module design reported an unrecoverable action: ${label}`)
    }
    await click(primary, label, audit)
    await page.waitForTimeout(150)
  }

  const approve = page.locator('.design-step-panel').getByRole('button', {
    name: 'Approve module',
    exact: true,
  })
  await waitEnabled(approve, `${moduleName} approval`)
  await click(approve, `Approve ${moduleName}`, audit)
  await visible(page.getByText(/Approved by /).last(), `${moduleName} approval identity`)
  await shot(page, outputDir, `07-${moduleSlug}-approved`, audit)
}

async function captureProductUi(chromium, outputDir, audit, sampleRoot, system) {
  const appPath = path.join(sampleRoot, appRelativePath(system))
  if (!fs.existsSync(appPath)) throw new Error(`The applied app is missing: ${appPath}`)

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    audit.productErrors.push({ source: 'pageerror', message: error.message })
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      audit.productErrors.push({ source: 'console', message: message.text() })
    }
  })

  try {
    await page.goto(pathToFileURL(appPath).href, { waitUntil: 'domcontentloaded' })
    await visible(page.getByRole('heading', { name: system.headline }), `${system.shortName} primary workspace`)
    const workspace = await shot(page, outputDir, `10-${system.layout}-workspace`, audit)
    fs.copyFileSync(workspace, path.join(sampleRoot, 'scenario-proof.png'))

    for (let index = 0; index < system.scenarios.length; index += 1) {
      const scenario = system.scenarios[index]
      await click(
        page.locator(`[data-scenario-action="${scenario.actionId}"]`),
        `${scenario.name} in product`,
        audit,
      )
      await visible(
        page.locator(`[data-scenario-result="${scenario.actionId}"].is-visible`),
        `${scenario.name} result`,
      )
      if (index === 0 || index === system.scenarios.length - 1) {
        await shot(page, outputDir, index === 0 ? '11-product-action' : '12-product-protected-action', audit)
      }
    }

    await page.keyboard.press('Meta+k')
    await visible(page.getByRole('dialog', { name: 'Command menu' }), 'command menu')
    await shot(page, outputDir, '13-product-command-menu', audit)
    await page.keyboard.press('Escape')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.setViewportSize({ width: 390, height: 844 })
    await click(page.getByRole('button', { name: 'Open menu' }), 'Open mobile menu', audit)
    await shot(page, outputDir, '14-product-mobile', audit)
    audit.timeToProductProofMs = Date.now() - Date.parse(audit.startedAt)
  } finally {
    await browser.close()
  }
}

async function waitForSummaryCount(page, label, predicate, description) {
  const cell = page.locator('.design-verify-summary > div').filter({ hasText: label }).first()
  await visible(cell, description)
  const deadline = Date.now() + TIMEOUT * 3
  while (Date.now() < deadline) {
    const value = Number(await cell.locator('strong').textContent())
    if (Number.isFinite(value) && predicate(value)) return value
    await page.waitForTimeout(160)
  }
  throw new Error(`${description} did not reach the expected count`)
}

async function runJourney(electron, chromium, system) {
  const outputDir = path.join(OUTPUT_ROOT, system.slug)
  fs.mkdirSync(outputDir, { recursive: true })

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `euik-${system.slug}-`))
  const sampleRoot = prepareSample(system, scratch)
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const overlayZip = prepareOverlay(system, scratch)
  const audit = {
    slug: system.slug,
    product: system.name,
    category: system.category,
    buyer: system.buyer,
    commercialJob: system.commercialJob,
    useFrequency: system.useFrequency,
    passed: false,
    packaged: false,
    clicks: 0,
    screenshots: [],
    phases: [],
    findings: [],
    warningReview: undefined,
    rendererErrors: [],
    productErrors: [],
    startedAt: new Date().toISOString(),
    repositoryRoot: sampleRoot,
    sampleTemplateRoot: path.join(SAMPLE_TEMPLATE_ROOT, system.slug),
  }
  const launchOptions = {
    executablePath: packagedExecutable(),
    args: ['--window-size=1440,1000'],
    env: {
      ...process.env,
      EUIK_DATA_DIR: dataDir,
      EUIK_TEST_MODE: '1',
      EUIK_TEST_PICK_DIR: sampleRoot,
      EUIK_TEST_PICK_ZIP: overlayZip,
    },
    timeout: TIMEOUT,
  }
  let app
  let page

  try {
    app = await electron.launch(launchOptions)
    page = await app.firstWindow({ timeout: TIMEOUT })
    observeRenderer(page, audit)
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.waitForLoadState('domcontentloaded')
    audit.packaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)
    if (!audit.packaged) throw new Error('Electron did not launch the packaged app.')

    await runPhase(audit, 'Create project', async () => {
      await click(page.getByRole('button', { name: 'New project' }).first(), 'New project entry', audit)
      await page.getByLabel('Project name').fill(system.name)
      await page.getByLabel('Description (optional)').fill(system.description)
      await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse', audit)
      await click(
        page.getByRole('dialog', { name: 'Create project' }).getByRole('button', { name: 'Create project' }),
        'Create project',
        audit,
      )
      await visible(page.getByText(system.name).first(), 'new project dashboard')
      await shot(page, outputDir, '02-project-dashboard', audit)
    })

    await runPhase(audit, 'Configure workflow', async () => {
      await click(page.getByRole('button', { name: 'Capabilities', exact: true }), 'Capabilities navigation', audit)
      const projectPicker = page.getByLabel('Capabilities workflow project')
      await visible(projectPicker, 'workflow project picker')
      await projectPicker.selectOption({ label: system.name })
      await click(page.getByRole('button', { name: 'Review project setup' }), 'Review project setup', audit)
      await visible(page.getByRole('heading', { name: /Complete project setup|Setup complete/ }), 'Project setup')
      const setupAction = page.getByRole('button', { name: 'Complete setup' })
      if (await setupAction.count()) {
        await waitEnabled(setupAction, 'Complete project setup')
        await click(setupAction, 'Complete project setup', audit)
      }
      await visible(page.getByRole('heading', { name: 'Setup complete' }), 'completed project setup')
      await click(page.getByRole('button', { name: 'Guided', exact: true }), 'Guided workflow', audit)
      await visible(page.getByRole('heading', { name: 'Describe user work' }), 'Plan input')
      await shot(page, outputDir, '03-plan-input', audit)
    })

    await runPhase(audit, 'Define use cases', async () => {
      await page.getByLabel('Work description').fill(system.workDescription)
      await page.getByLabel('Examples').fill(system.examples.join('\n'))
      await page.getByRole('radio', { name: /Separate user tasks/ }).check()
      await page.getByLabel('Prohibited results').fill(system.prohibited)
      await click(page.getByRole('button', { name: 'Add repository reference' }), 'Add project source', audit)
      const source = page.locator('.design-plan-source-drafts li').first()
      await source.getByLabel('Name').fill('Product brief')
      await source.getByLabel('Repository-relative reference').fill('README.md')
      await source.getByLabel('Required').check()
      await click(source.getByRole('button', { name: 'Check source' }), 'Check project source', audit)
      await visible(source.getByText('✓ Available'), 'available project source')
      await click(page.getByRole('button', { name: 'Create use-case draft' }), 'Create use-case draft', audit)
      await visible(page.getByRole('heading', { name: 'Check use cases' }), 'Plan review')
      await shot(page, outputDir, '04-plan-decomposed', audit)

      const approval = page.getByRole('button', { name: 'Approve this revision' })
      await waitEnabled(approval, 'Plan approval')
      await click(approval, 'Approve Plan revision', audit)
      await visible(page.getByText(/Approved by /).first(), 'Plan approval identity')
      await shot(page, outputDir, '05-plan-approved', audit)
    })

    await runPhase(audit, 'Review application workflow', async () => {
      await click(
        page.getByRole('button', { name: 'Continue to application workflows' }),
        'Continue to application workflows',
        audit,
      )
      await visible(page.getByRole('heading', { name: 'Check application behavior' }), 'application workflow')
      await visible(page.getByText('Workflow checks pass'), 'application workflow result')
      await shot(page, outputDir, '05a-application-workflow', audit)
    })

    await runPhase(audit, 'Approve system design', async () => {
      await click(page.locator('#design-workspace-tab-design'), 'Design stage', audit)
      await visible(page.getByRole('heading', { name: 'Choose system structure' }), 'system structure choices')
      await page.getByRole('radio', { name: new RegExp(system.architecture.structure, 'i') }).check()
      await click(page.getByRole('button', { name: 'Create this design' }), 'Create system design', audit)
      await visible(page.getByRole('heading', { name: 'Review system structure' }), 'system structure review')

      const inspector = page.locator('.design-structure-editor')
      await inspector.locator('header select').first().selectOption({ label: system.architecture.seedModule })
      await click(inspector.getByRole('button', { name: 'Split module' }), `Split ${system.architecture.seedModule}`, audit)
      const boundaryEditor = page.locator('.design-boundary-editor')
      await visible(boundaryEditor, 'module boundary editor')
      while (await boundaryEditor.locator('.design-boundary-card').count() < system.architecture.modules.length) {
        await click(boundaryEditor.getByRole('button', { name: 'Add boundary' }), 'Add architecture boundary', audit)
      }
      const boundaryCards = boundaryEditor.locator('.design-boundary-card')
      for (let index = 0; index < system.architecture.modules.length; index += 1) {
        const [moduleId, name, moduleType, responsibility] = system.architecture.modules[index]
        const card = boundaryCards.nth(index)
        await card.getByLabel('Module ID').fill(moduleId)
        await card.getByLabel('Module name').fill(name)
        await card.getByLabel('Module type').selectOption(moduleType)
        await card.getByLabel('Responsibility').fill(responsibility)
      }
      const ownerFields = boundaryEditor.locator('.design-boundary-operations select')
      for (let index = 0; index < await ownerFields.count(); index += 1) {
        await ownerFields.nth(index).selectOption(system.architecture.modules[index % system.architecture.modules.length][0])
      }
      await click(boundaryEditor.getByRole('button', { name: 'Apply module split' }), 'Apply architecture boundaries', audit)

      const expectedModuleCount = system.architecture.modules.length + (system.architecture.structure === 'Experience-first' ? 1 : 0)
      const moduleSummary = page.locator('.design-structure-summary > div').filter({ hasText: 'Modules' }).first().locator('strong')
      await page.waitForFunction(
        ([selector, expected]) => Number(document.querySelector(selector)?.textContent) === expected,
        ['.design-structure-summary > div:first-child strong', expectedModuleCount],
        { timeout: TIMEOUT },
      )
      if (Number(await moduleSummary.textContent()) !== expectedModuleCount) {
        throw new Error(`Expected ${expectedModuleCount} architecture modules.`)
      }

      const dependencyEditor = page.locator('.design-dependency-editor')
      const removeButtons = dependencyEditor.getByRole('button', { name: /^Remove dependency / })
      while (await removeButtons.count()) {
        const before = await removeButtons.count()
        await click(removeButtons.first(), 'Remove generated dependency', audit)
        await page.waitForFunction(
          ([selector, count]) => document.querySelectorAll(selector).length < count,
          ['.design-dependency-list li', before],
          { timeout: TIMEOUT },
        )
      }

      for (const [fromModuleId, toModuleId, reason] of system.architecture.dependencies) {
        await dependencyEditor.getByLabel('Dependency source').selectOption(fromModuleId)
        await dependencyEditor.getByLabel('Dependency target').selectOption(toModuleId)
        await dependencyEditor.getByLabel('Dependency reason').fill(reason)
        const before = await dependencyEditor.locator('.design-dependency-list li').count()
        await click(dependencyEditor.getByRole('button', { name: 'Add dependency' }), `Add ${fromModuleId} dependency`, audit)
        await page.waitForFunction(
          ([selector, count]) => document.querySelectorAll(selector).length > count,
          ['.design-dependency-list li', before],
          { timeout: TIMEOUT },
        )
      }

      await page.locator('.main').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
      await shot(page, outputDir, '05b-system-structure-refined', audit, { fullPage: true })
      const approval = page.getByRole('button', { name: 'Approve system structure' })
      await waitEnabled(approval, 'system structure approval')
      await click(approval, 'Approve system structure', audit)
      await visible(page.getByRole('heading', { name: 'System structure' }), 'approved system structure')
    })

    await runPhase(audit, 'Design modules', async () => {
      const modules = designModuleOrder(system)
      for (const module of modules) {
        const moduleRow = page.locator('.design-queue-row').filter({
          has: page.locator('.design-queue-row-name', { hasText: exactText(module.name) }),
        })
        await click(
          moduleRow.locator('.design-queue-row-button'),
          `Select ${module.name}`,
          audit,
        )
        await completeModuleDesign(page, outputDir, audit, system, module)
      }
    })

    await runPhase(audit, 'Build product', async () => {
      await click(page.locator('#design-workspace-tab-build'), 'Build stage', audit)
      await visible(page.getByRole('heading', { name: 'Prepare module delivery' }), 'Build handoff')
      for (const label of ['Create Design baseline', 'Approve Design baseline']) {
        const action = page.getByRole('button', { name: label })
        await waitEnabled(action, label)
        await click(action, label, audit)
      }
      await visible(page.getByRole('heading', { name: 'Baseline approved' }), 'approved design baseline')
      await click(
        page.getByRole('button', { name: 'Create implementation handoff' }).last(),
        'Create implementation handoff',
        audit,
      )
      await visible(page.getByText('Created an implementation handoff packet.'), 'implementation handoff')
      await click(page.getByRole('button', { name: 'Open build' }), 'Open build', audit)
      await visible(page.getByRole('heading', { name: 'Build', exact: true }), 'Build workspace')
      await click(page.getByRole('button', { name: 'Generate', exact: true }), 'Generate handoff', audit)
      await visible(page.locator('.status-line').filter({ hasText: 'Handoff ready:' }).first(), 'Build handoff result')
      await click(page.getByRole('button', { name: /Select .*zip/i }).first(), 'Select returned overlay', audit)
      await visible(page.getByRole('heading', { name: 'Inspection result' }), 'overlay inspection')

      const blockers = page.getByText('Apply blockers', { exact: true })
      if (await blockers.count()) {
        await shot(page, outputDir, '08-build-blocked', audit)
        const blockerText = (await page.locator('.validation-summary').textContent())?.trim() ?? ''
        addFinding(audit, {
          id: 'BUILD-OVERLAY-BLOCKED',
          severity: 'high',
          area: 'Build',
          title: 'The product implementation did not pass the overlay gate.',
          evidence: blockerText.slice(0, 1500),
        })
        throw new Error(`Overlay inspection blocked the product UI: ${blockerText}`)
      }

      const warningBox = page.getByText('Overlay warnings', { exact: true })
      if (await warningBox.count()) {
        const warningPanel = warningBox.locator('..')
        const warningText = (await warningPanel.textContent())?.trim() ?? ''
        audit.warningReview = {
          status: 'accepted-for-product-trial',
          evidence: warningText.slice(0, 1500),
        }
        addFinding(audit, {
          id: 'BUILD-OVERLAY-WARNING',
          severity: 'medium',
          area: 'Build',
          title: 'The implementation required a manual warning acceptance.',
          evidence: warningText.slice(0, 800),
        })
        await warningPanel.getByLabel('Accept all warnings').check()
      } else {
        await visible(page.getByText('Pass', { exact: true }), 'passing overlay')
      }

      const apply = page.getByRole('button', { name: 'Apply changes' })
      await waitEnabled(apply, 'Apply changes')
      await click(apply, 'Apply changes', audit)
      await visible(page.getByRole('heading', { name: 'Build ready' }), 'build-ready result')
      await shot(page, outputDir, '08-build-applied', audit)
    })

    await runPhase(audit, 'Exercise product UI', async () => {
      await captureProductUi(chromium, outputDir, audit, sampleRoot, system)
    })

    await runPhase(audit, 'Connect entry point', async () => {
      await click(page.getByRole('button', { name: 'Back to Capabilities' }), 'Back to Capabilities', audit)
      await visible(page.getByRole('heading', { name: 'Product delivery' }), 'Product delivery')
      await click(page.locator('#design-workspace-tab-connect'), 'Connect stage', audit)
      await visible(page.getByRole('heading', { name: 'Connect entry points' }), 'Connect workspace')
      await page.getByRole('radio', { name: /User interface/ }).check()
      await page.getByLabel('Local UI').fill(appRelativePath(system))
      await page.getByLabel('Ready selector').fill('.app-shell')
      await page.getByLabel('Capture target').fill('main')
      await click(page.getByRole('button', { name: 'Suggest selectors' }), 'Suggest scenario selectors', audit)

      const scenarioFields = page.locator('.design-connect-ui-steps > fieldset')
      if (await scenarioFields.count() !== system.scenarios.length) {
        throw new Error(`Expected ${system.scenarios.length} UI scenario mappings, found ${await scenarioFields.count()}.`)
      }
      for (const scenario of system.scenarios) {
        const fields = scenarioFields.filter({
          has: page.locator(`legend:text-is("${scenario.name}")`),
        })
        if (await fields.count() !== 1) throw new Error(`Expected one mapping row for ${scenario.name}.`)
        const suggestedAction = await fields.getByLabel(/^Action selector for step /).inputValue()
        const suggestedResult = await fields.getByLabel(/^Result selector for step /).inputValue()
        if (suggestedAction !== `[data-scenario-action="${scenario.actionId}"]`) {
          throw new Error(`The suggested action selector is not stable for ${scenario.name}: ${suggestedAction}`)
        }
        if (suggestedResult !== `[data-scenario-result="${scenario.actionId}"]`) {
          throw new Error(`The suggested result selector is not stable for ${scenario.name}: ${suggestedResult}`)
        }
        await fields.getByLabel(/^Expected text for step /).fill(scenario.result)
      }
      const save = page.getByRole('button', { name: 'Save binding' })
      await waitEnabled(save, 'Save binding')
      await click(save, 'Save binding', audit)
      await visible(page.getByText('Ready to verify'), 'saved binding')
      const verify = page.getByRole('button', { name: 'Verify connection' })
      await waitEnabled(verify, 'Verify connection')
      await click(verify, 'Verify connection', audit)
      await visible(page.getByText('Connection proved'), 'proved connection')
      await page.locator('.main').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
      await shot(page, outputDir, '16-connect-verified', audit)
    })

    await runPhase(audit, 'Verify scenarios', async () => {
      await click(page.locator('#design-workspace-tab-verify'), 'Verify stage', audit)
      await visible(page.getByRole('heading', { name: 'Approved scenarios' }), 'Verify workspace')
      const scenarioCount = await waitForSummaryCount(page, 'Scenarios', (value) => value > 0, 'scenario count')
      await click(page.getByRole('button', { name: 'Run all current scenarios' }), 'Run all scenarios', audit)
      await waitEnabled(
        page.getByRole('button', { name: 'Run all current scenarios' }),
        'completed scenario run',
        TIMEOUT * 2,
      )
      const passedCount = await waitForSummaryCount(
        page,
        'Recorded passed',
        (value) => value === scenarioCount,
        'passed scenario count',
      )
      const failedCount = await waitForSummaryCount(
        page,
        'Recorded failed',
        (value) => value === 0,
        'failed scenario count',
      )
      audit.scenarioSummary = { scenarioCount, passedCount, failedCount }
      const approve = page.getByRole('button', { name: 'Approve this exact result' })
      await waitEnabled(approve, 'verification approval')
      await click(approve, 'Approve verification result', audit)
      await visible(page.getByText('Verification approved'), 'verification approval')
      await shot(page, outputDir, '17-verify-passed', audit)
    })

    await runPhase(audit, 'Review evidence', async () => {
      await click(page.getByRole('button', { name: 'Open immutable evidence' }), 'Open immutable evidence', audit)
      await visible(page.getByRole('heading', { name: 'Trace result evidence' }), 'Evidence workspace')
      await visible(page.getByText('current · passed').first(), 'current evidence')
      await click(
        page.locator('[aria-label="Recorded runs"] button').filter({
          hasText: system.failureScenario,
        }).first(),
        `Select ${system.failureScenario} evidence`,
        audit,
      )
      await visible(
        page.locator('.design-evidence-run-heading h3', { hasText: system.failureScenario }),
        `${system.failureScenario} evidence`,
      )
      await shot(page, outputDir, '18-evidence-trace', audit)
      await click(
        page.getByRole('button', { name: 'Open Original screenshot at full resolution' }).first(),
        'Open original screenshot',
        audit,
      )
      await visible(page.getByRole('dialog', { name: 'Original screenshot' }), 'original screenshot dialog')
      await shot(page, outputDir, '19-evidence-original', audit)
    })

    audit.rendererErrors = audit.rendererErrors.filter((entry) => !/favicon/i.test(entry.message))
    if (audit.rendererErrors.length) {
      addFinding(audit, {
        id: 'APP-RENDERER-ERROR',
        severity: 'high',
        area: 'Application',
        title: 'The packaged application reported a renderer error.',
        evidence: JSON.stringify(audit.rendererErrors).slice(0, 1200),
      })
    }
    if (audit.productErrors.length) {
      addFinding(audit, {
        id: 'PRODUCT-RENDERER-ERROR',
        severity: 'high',
        area: 'Built product',
        title: 'The built product reported a renderer error.',
        evidence: JSON.stringify(audit.productErrors).slice(0, 1200),
      })
    }
    audit.passed = audit.rendererErrors.length === 0 && audit.productErrors.length === 0
    audit.completedAt = new Date().toISOString()
    audit.durationMs = Date.parse(audit.completedAt) - Date.parse(audit.startedAt)
    return audit
  } catch (error) {
    audit.error = error instanceof Error ? error.stack : String(error)
    audit.completedAt = new Date().toISOString()
    audit.durationMs = Date.parse(audit.completedAt) - Date.parse(audit.startedAt)
    try {
      const failurePage = page ?? (await app?.windows())?.[0]
      if (failurePage) await shot(failurePage, outputDir, 'failure', audit, { fullPage: true })
    } catch {
      // Failure evidence is best effort.
    }
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(
      path.join(outputDir, 'audit-manifest.json'),
      `${JSON.stringify(audit, null, 2)}\n`,
    )
    if (audit.passed || process.env.EUIK_KEEP_PRODUCT_TRIAL_SCRATCH !== '1') {
      fs.rmSync(scratch, { recursive: true, force: true })
    }
  }
}

fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
const trials = selectedSystems()
const results = []
const { _electron, chromium } = await import('playwright')

for (const system of trials) {
  const watchdog = setTimeout(() => {
    process.stderr.write(`${system.name} exceeded ${JOURNEY_TIMEOUT}ms\n`)
    process.exit(1)
  }, JOURNEY_TIMEOUT)
  watchdog.unref()
  try {
    results.push(await runJourney(_electron, chromium, system))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    results.push({
      slug: system.slug,
      product: system.name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
    if (process.env.EUIK_PRODUCT_TRIAL_CONTINUE !== '1') break
  } finally {
    clearTimeout(watchdog)
    fs.writeFileSync(
      path.join(OUTPUT_ROOT, 'portfolio-manifest.json'),
      `${JSON.stringify(results, null, 2)}\n`,
    )
  }
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
if (results.some((result) => !result.passed)) process.exitCode = 1
