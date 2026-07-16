/**
 * Production Capabilities packaged-app acceptance journey.
 *
 * This harness intentionally drives only rendered controls in a real packaged
 * artifact. It never calls window.euik, page.evaluate, core helpers, or an IPC
 * handler to create workflow state. A green result therefore proves that the
 * packaged renderer, preload bridge, desktop orchestrator, generators,
 * transactional apply, generated runtime, target app, and verifier cooperate.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createExistingRepositoryFixture, createMixedReactPythonFixture, createPythonHeadlessFixture, createTypeScriptUiFixture } from './production-capabilities-fixtures.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EVIDENCE_DIR = path.join(REPO_ROOT, 'apps/desktop/validation-evidence/capabilities-production/packaged')
const BUILD = process.env.EUIK_PACKAGED_SKIP_BUILD !== '1'
const TIMEOUT = Number(process.env.EUIK_PACKAGED_TIMEOUT_MS ?? 60_000)
const JOURNEY_TIMEOUT = Number(process.env.EUIK_PACKAGED_JOURNEY_TIMEOUT_MS ?? 360_000)

fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
for (const stale of ['failure.json', 'failure.png', 'python-failure.png', 'mixed-failure.png', 'existing-failure.png', 'recovery-failure.png']) fs.rmSync(path.join(EVIDENCE_DIR, stale), { force: true })

function run(command, args, cwd = REPO_ROOT) {
  const executable = process.platform === 'win32' && ['npm', 'npx', 'pnpm', 'yarn'].includes(command.toLowerCase())
    ? `${command}.cmd`
    : command
  const result = spawnSync(executable, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
}

function collectCommandLogs(dataDir, projectId, prefix) {
  const root = path.join(dataDir, 'projects', projectId, 'capabilities', 'integration', 'command-output')
  if (!fs.existsSync(root)) return []
  const sourceFiles = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && entry.name.endsWith('.combined.log')) sourceFiles.push(absolute)
    }
  }
  visit(root)
  return sourceFiles.sort().map((source, index) => {
    const destination = path.join(EVIDENCE_DIR, `${prefix}-command-${index + 1}.log`)
    // Command output is already bounded and redacted by the privileged runner.
    fs.copyFileSync(source, destination)
    return path.relative(REPO_ROOT, destination)
  })
}

function repositorySnapshot(root) {
  const ignoredDirectories = new Set(['.engineering-ui', '.git', '.venv', 'node_modules'])
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join('/')
        files.push({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') })
      }
    }
  }
  visit(root)
  return files
}

function snapshotHash(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

function invokeLegacyPython(python, root, expected) {
  const result = spawnSync(python, ['legacy.py'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`legacy behavior exited ${result.status}: ${result.stderr ?? ''}`)
  const output = (result.stdout ?? '').trim()
  if (output !== expected) throw new Error(`legacy behavior changed: expected "${expected}", received "${output}"`)
  return output
}

function packagedExecutable() {
  if (process.platform === 'darwin') {
    const candidates = [
      path.join(REPO_ROOT, 'release/mac-arm64/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
      path.join(REPO_ROOT, 'release/mac/Engineering UI Kit.app/Contents/MacOS/Engineering UI Kit'),
    ]
    const found = candidates.find((candidate) => fs.existsSync(candidate))
    if (found) return found
  }
  if (process.platform === 'win32') {
    const found = fs.readdirSync(path.join(REPO_ROOT, 'release'), { recursive: true })
      .map((entry) => path.join(REPO_ROOT, 'release', String(entry)))
      .find((entry) => entry.endsWith('.exe') && /Engineering UI Kit/i.test(path.basename(entry)))
    if (found) return found
  }
  if (process.platform === 'linux') {
    const unpacked = path.join(REPO_ROOT, 'release/linux-unpacked')
    // electron-builder derives the Linux executable name from the scoped
    // workspace package on some runners even when productName is configured.
    // Select the unpacked app executable by structure instead of display name.
    const found = fs.readdirSync(unpacked)
      .map((entry) => path.join(unpacked, entry))
      .filter((entry) => {
        const stat = fs.statSync(entry)
        return stat.isFile() && (stat.mode & 0o111) !== 0 && !/^chrome(?:-|_)/i.test(path.basename(entry))
      })
      .sort((left, right) => fs.statSync(right).size - fs.statSync(left).size)[0]
    if (found) return found
  }
  throw new Error(`No unpacked packaged executable found for ${process.platform}`)
}

function packagedLaunchArgs() {
  // GitHub-hosted Linux runners cannot configure Electron's setuid sandbox.
  // Xvfb still drives the real packaged binary; this flag changes only the
  // runner's Chromium process isolation, not application behavior or evidence.
  return process.platform === 'linux' ? ['--no-sandbox'] : []
}

async function closePackagedApp(app) {
  if (!app) return
  let settled = false
  const close = app.close().then(
    () => { settled = true },
    () => { settled = true },
  )
  await Promise.race([close, new Promise((resolve) => setTimeout(resolve, 10_000))])
  if (settled) return

  // Playwright waits for Electron to exit. On Windows a generated npm/Vite
  // descendant can retain inherited handles after the last window closes, so
  // bound shutdown and terminate the complete packaged-app process tree.
  const child = app.process()
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try { child.kill('SIGKILL') } catch { /* already exited */ }
  }
  await Promise.race([close, new Promise((resolve) => setTimeout(resolve, 5_000))])
}

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT }).catch((error) => {
    throw new Error(`${description} was not visible: ${error.message}`)
  })
  return locator
}

async function click(locator, description) {
  await expectVisible(locator, description)
  await locator.click({ timeout: TIMEOUT })
}

async function waitEnabled(locator, description) {
  const deadline = Date.now() + TIMEOUT
  await expectVisible(locator, description)
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`${description} did not become enabled within ${TIMEOUT}ms`)
}

async function waitForStatus(page, text) {
  await expectVisible(page.getByText(text, { exact: false }).last(), `status containing ${text}`)
}

async function shot(page, name) {
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return path.relative(REPO_ROOT, file)
}

async function chooseInterviewFile(page, file, regionName) {
  const region = page.getByRole('region', { name: regionName }).last()
  await expectVisible(region, regionName)
  const input = region.locator('input[type=file]').first()
  await input.setInputFiles(file)
}

async function answerFoundationQuestions(page) {
  const region = page.getByRole('region', { name: 'Foundation plan' })
  for (let attempts = 0; attempts < 10 && await region.getByRole('group', { name: 'Open foundation questions' }).count(); attempts += 1) {
    const group = region.getByRole('group', { name: 'Open foundation questions' })
    const selects = group.locator('select')
    if (await selects.count() === 0) break
    const options = await selects.first().locator('option').allTextContents()
    await selects.first().selectOption(options.includes('browser') ? { label: 'browser' } : { index: 1 })
    const answer = group.getByRole('button', { name: 'Answer' }).first()
    await waitEnabled(answer, 'foundation answer')
    await answer.click()
    const changedDeadline = Date.now() + TIMEOUT
    while (Date.now() < changedDeadline) {
      if (!await group.count() || await page.getByText('Answer recorded', { exact: false }).count()) break
      await page.waitForTimeout(100)
    }
    const approve = region.getByRole('button', { name: 'Approve foundation' })
    const deadline = Date.now() + TIMEOUT
    while (Date.now() < deadline && await approve.isDisabled() && await group.count()) await page.waitForTimeout(100)
  }
}

async function selectTargetButton(page, app, targetUrl, expectedSelection = 'Selected Run capability') {
  await click(page.getByRole('button', { name: 'Select preview element' }), 'select preview element')
  await expectVisible(page.getByRole('button', { name: 'Click an element…' }), 'active target element picker')
  const preview = page.getByLabel('Target application Preview')
  const frame = preview.locator('webview')
  const box = await frame.boundingBox()
  if (!box) throw new Error('Target preview webview has no visible bounds')
  // Playwright host-page input does not cross an Electron <webview> guest
  // boundary. Send the equivalent native mouse sequence to the real guest
  // webContents. This is an actual rendered click, not JavaScript execution,
  // state injection, or a bridge/IPC shortcut.
  const clicked = await app.evaluate(async ({ webContents }, url) => {
    const guest = webContents.getAllWebContents().find((contents) => contents.getURL().startsWith(url))
    if (!guest) return false
    if (!guest.debugger.isAttached()) guest.debugger.attach('1.3')
    const { root } = await guest.debugger.sendCommand('DOM.getDocument', { depth: 1 })
    const { nodeId } = await guest.debugger.sendCommand('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-cap-id="run-capability"]',
    })
    if (!nodeId) return false
    const { model } = await guest.debugger.sendCommand('DOM.getBoxModel', { nodeId })
    const x = (model.content[0] + model.content[2] + model.content[4] + model.content[6]) / 4
    const y = (model.content[1] + model.content[3] + model.content[5] + model.content[7]) / 4
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    return true
  }, targetUrl)
  if (!clicked) throw new Error('Target preview guest webContents was not found')
  await waitForStatus(page, expectedSelection)
}

async function generateApplyBuild(page, deployableId) {
  const card = page.getByRole('article', { name: `Integration for ${deployableId}` })
  await click(card.getByRole('button', { name: /Preview generation|Regenerate plan/ }), `Preview ${deployableId}`)
  await expectVisible(card.getByText('Generation plan is ready for review.', { exact: false }), `${deployableId} plan-ready status`)
  const acceptDirty = card.getByLabel(/I reviewed and accept applying this plan/)
  if (await acceptDirty.count()) await acceptDirty.check()
  await waitEnabled(card.getByRole('button', { name: 'Apply generation plan' }), `${deployableId} generation apply`)
  await click(card.getByRole('button', { name: 'Apply generation plan' }), `Apply ${deployableId}`)
  await expectVisible(card.getByText('Reference-architecture infrastructure applied.', { exact: false }), `${deployableId} apply status`)
  await click(card.getByRole('button', { name: 'Install, build & test' }), `Build ${deployableId}`)
  await expectVisible(card.getByText('Install, build, and test commands completed.', { exact: false }), `${deployableId} command status`)
}

function stopPort(url) {
  const port = new URL(url).port
  if (!port) return
  if (process.platform === 'win32') {
    const netstat = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).stdout ?? ''
    const pids = [...new Set(netstat.split(/\r?\n/).filter((line) => line.includes(`:${port}`) && /LISTENING/i.test(line)).map((line) => line.trim().split(/\s+/).at(-1)).filter(Boolean))]
    for (const pid of pids) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' })
    return
  }
  const output = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).stdout ?? ''
  for (const pid of output.trim().split(/\s+/).filter(Boolean)) {
    try { process.kill(Number(pid), 'SIGTERM') } catch { /* already exited */ }
  }
}

async function runTypeScriptUiJourney(electron) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-production-ui-'))
  const fixtureRepo = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(fixtureRepo, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const fixture = createTypeScriptUiFixture(fixtureRepo, 'production-ui', 55_000 + Math.floor(Math.random() * 5_000))
  const executablePath = packagedExecutable()
  const app = await electron.launch({
    executablePath,
    args: packagedLaunchArgs(),
    env: {
      ...process.env,
      EUIK_DATA_DIR: dataDir,
      EUIK_TEST_MODE: '1',
      EUIK_TEST_PICK_DIR: fixtureRepo,
      NO_PROXY: '127.0.0.1,localhost',
    },
    timeout: TIMEOUT,
  })
  const evidence = { journey: 'typescript-ui', executablePath, packaged: false, scratch, screenshots: [], passed: false }
  try {
    const page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    const packaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)
    if (!packaged) throw new Error('Electron reports app.isPackaged=false')
    evidence.packaged = true

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Production UI Journey')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production UI Journey' })

    await chooseInterviewFile(page, fixture.responseFiles.product, 'Application definition')
    await waitForStatus(page, 'Interview imported')
    await click(page.getByRole('button', { name: 'Approve definition' }), 'Approve definition')
    await waitForStatus(page, 'Approved application revision')

    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode')
    await click(page.getByRole('tab', { name: 'Architecture' }), 'Architecture tab')
    await waitEnabled(page.getByRole('button', { name: 'Export architecture interview' }), 'loaded architecture interview')
    await chooseInterviewFile(page, fixture.responseFiles.architecture, 'Architecture interview')
    await waitForStatus(page, 'Imported architecture proposal')
    await click(page.getByRole('button', { name: 'Approve architecture' }), 'Approve architecture')
    await waitForStatus(page, 'Architecture approved')
    await click(page.getByRole('button', { name: 'Propose foundation plan' }), 'Propose foundation plan')
    await expectVisible(page.getByRole('group', { name: 'Open foundation questions' }), 'foundation questions')
    await answerFoundationQuestions(page)
    await waitEnabled(page.getByRole('button', { name: 'Approve foundation' }), 'ready foundation approval')
    await click(page.getByRole('button', { name: 'Approve foundation' }), 'Approve foundation')
    await waitForStatus(page, 'Approved foundation plan')

    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab')
    const selectedModule = page.getByRole('button', { name: `Select module mod.echo.ui` })
    await expectVisible(selectedModule, 'allocated module')
    const moduleDeadline = Date.now() + TIMEOUT
    while (Date.now() < moduleDeadline && await selectedModule.getAttribute('aria-current') !== 'true') {
      await page.waitForTimeout(100)
    }
    if (await selectedModule.getAttribute('aria-current') !== 'true') throw new Error('Allocated module did not become active')
    const moduleImport = page.locator('[aria-label="Import module interview response"] input[type=file]')
    await expectVisible(page.getByLabel('Import module interview response'), 'module interview import')
    await moduleImport.first().setInputFiles(fixture.responseFiles.module)
    await waitForStatus(page, 'Imported module draft')
    await click(page.getByRole('button', { name: 'Approve module' }).first(), 'Approve module')
    await waitForStatus(page, 'Approved module')

    const factory = page.getByLabel(`Implementation factory for ${fixture.operationId}`)
    if (await factory.count()) await factory.fill('src/domain/echo_run.ts#createEchoRun')
    await click(page.getByRole('button', { name: 'Save composition factories' }), 'Save composition factories')
    await waitForStatus(page, 'Composition configuration saved')
    await waitEnabled(page.getByRole('button', { name: 'Preview generation' }), 'Preview generation')
    await click(page.getByRole('button', { name: 'Preview generation' }), 'Preview generation')
    await waitForStatus(page, 'Generation plan is ready')
    const acceptDirty = page.getByLabel(/I reviewed and accept applying this plan/)
    if (await acceptDirty.count()) await acceptDirty.check()
    await click(page.getByRole('button', { name: 'Apply generation plan' }), 'Apply generation plan')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    await click(page.getByRole('button', { name: 'Install, build & test' }), 'Install, build and test')
    await waitForStatus(page, 'Install, build, and test commands completed')
    evidence.screenshots.push(await shot(page, '01-ui-build-applied'))

    await click(page.getByRole('tab', { name: 'Connections' }), 'Connections tab')
    await click(page.getByRole('button', { name: /existing or new UI/i }), 'UI trigger choice')
    if (!await page.getByLabel('Application UI URL').count()) {
      await click(page.getByRole('button', { name: 'Change UI setup' }), 'Change UI setup')
    }
    await page.getByLabel('Application UI URL').fill(fixture.uiUrl)
    await page.getByLabel('Application UI start command').fill('npm run dev')
    await click(page.getByRole('button', { name: 'Save and use this UI' }), 'Save and use this UI')
    const useUi = page.getByRole('button', { name: 'Use this UI', exact: true })
    if (await useUi.count()) await click(useUi, 'Use this UI')
    await expectVisible(page.locator('webview'), 'target application webview')
    await page.waitForTimeout(1_500)
    await selectTargetButton(page, app, fixture.uiUrl)
    await page.getByLabel('Capability', { exact: true }).selectOption(`${fixture.operationId}@1.0.0`)
    for (const input of await page.getByRole('region', { name: 'Define visible behavior' }).locator('input').all()) {
      await input.fill('Show a clear successful result to the user.')
    }
    await page.getByLabel('Test mode').selectOption('approved-example')
    await click(page.getByRole('button', { name: 'Run simulation' }), 'Run simulation')
    await click(page.getByRole('button', { name: 'Approve connection' }), 'Approve connection')
    const configured = page.getByRole('region', { name: 'Configured entry points' })
    await expectVisible(configured, 'approved configured entry point')
    await expectVisible(configured.getByText('Approved', { exact: true }), 'approved entry-point status')

    const regenerate = page.getByRole('button', { name: 'Regenerate plan' }).last()
    await click(regenerate, 'Regenerate plan after binding')
    await waitForStatus(page, 'Generation plan is ready')
    const acceptDirtyBound = page.getByLabel(/I reviewed and accept applying this plan/).last()
    if (await acceptDirtyBound.count()) await acceptDirtyBound.check()
    await waitEnabled(page.getByRole('button', { name: 'Apply generation plan' }).last(), 'bound generation apply')
    await click(page.getByRole('button', { name: 'Apply generation plan' }).last(), 'Apply bound generation plan')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    await click(page.getByRole('button', { name: 'Install, build & test' }).last(), 'Build bound generation plan')
    await waitForStatus(page, 'Install, build, and test commands completed')
    evidence.screenshots.push(await shot(page, '02-ui-connected'))

    await click(page.getByRole('tab', { name: 'Verification' }), 'Verification tab')
    await click(page.getByRole('button', { name: 'Run real verification' }), 'Run real verification')
    await waitForStatus(page, 'real target launched')
    await expectVisible(page.getByText('pass', { exact: true }).first(), 'current passing verification evidence')
    evidence.screenshots.push(await shot(page, '03-ui-real-verification'))

    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab for rollback')
    await click(page.getByRole('button', { name: 'Roll back' }), 'Roll back')
    await waitForStatus(page, 'Generation was rolled back')
    evidence.screenshots.push(await shot(page, '04-ui-rolled-back'))
    evidence.passed = true
    return evidence
  } catch (error) {
    const page = app.windows()[0]
    if (page) {
      evidence.screenshots.push(await shot(page, 'failure').catch(() => ''))
      evidence.visibleText = await page.locator('body').innerText().catch(() => '')
    }
    evidence.error = error instanceof Error ? error.stack : String(error)
    throw error
  } finally {
    await closePackagedApp(app)
    stopPort(fixture.uiUrl)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'typescript-ui.json'), JSON.stringify(evidence, null, 2) + '\n')
  }
}

async function runPythonHeadlessJourney(electron) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-production-python-'))
  const fixtureRepo = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(fixtureRepo, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const fixture = createPythonHeadlessFixture(fixtureRepo)
  const workspacePython = path.join(REPO_ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
  const python = process.env.PYTHON ?? (fs.existsSync(workspacePython) ? workspacePython : process.platform === 'win32' ? 'python' : 'python3')
  run(python, ['-m', 'venv', path.join(fixtureRepo, '.venv')])
  const executablePath = packagedExecutable()
  const app = await electron.launch({
    executablePath,
    args: packagedLaunchArgs(),
    env: { ...process.env, EUIK_DATA_DIR: dataDir, EUIK_TEST_MODE: '1', EUIK_TEST_PICK_DIR: fixtureRepo },
    timeout: TIMEOUT,
  })
  const evidence = { journey: 'python-headless-schedule', executablePath, packaged: false, scratch, screenshots: [], passed: false }
  try {
    const page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    if (!await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)) throw new Error('Electron reports app.isPackaged=false')
    evidence.packaged = true

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Production Python Journey')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production Python Journey' })

    await chooseInterviewFile(page, fixture.responseFiles.product, 'Application definition')
    await waitForStatus(page, 'Interview imported')
    await click(page.getByRole('button', { name: 'Approve definition' }), 'Approve definition')
    await waitForStatus(page, 'Approved application revision')
    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode')
    await click(page.getByRole('tab', { name: 'Architecture' }), 'Architecture tab')
    await waitEnabled(page.getByRole('button', { name: 'Export architecture interview' }), 'loaded architecture interview')
    await chooseInterviewFile(page, fixture.responseFiles.architecture, 'Architecture interview')
    await waitForStatus(page, 'Imported architecture proposal')
    await click(page.getByRole('button', { name: 'Approve architecture' }), 'Approve architecture')
    await waitForStatus(page, 'Architecture approved')
    await click(page.getByRole('button', { name: 'Propose foundation plan' }), 'Propose foundation plan')
    await waitEnabled(page.getByRole('button', { name: 'Approve foundation' }), 'ready Python foundation approval')
    await click(page.getByRole('button', { name: 'Approve foundation' }), 'Approve foundation')
    await waitForStatus(page, 'Approved foundation plan')

    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab')
    const selectedModule = page.getByRole('button', { name: 'Select module mod.job' })
    await expectVisible(selectedModule, 'allocated Python module')
    const moduleDeadline = Date.now() + TIMEOUT
    while (Date.now() < moduleDeadline && await selectedModule.getAttribute('aria-current') !== 'true') await page.waitForTimeout(100)
    const moduleImport = page.locator('[aria-label="Import module interview response"] input[type=file]')
    await moduleImport.first().setInputFiles(fixture.responseFiles.module)
    await waitForStatus(page, 'Imported module draft')
    await click(page.getByRole('button', { name: 'Approve module' }).first(), 'Approve module')
    await waitForStatus(page, 'Approved module')

    const factory = page.getByLabel(`Implementation factory for ${fixture.operationId}`)
    await factory.fill('src/domain/run_job.py#create_job_run')
    await click(page.getByRole('button', { name: 'Save composition factories' }), 'Save composition factories')
    await waitForStatus(page, 'Composition configuration saved')
    await click(page.getByRole('button', { name: 'Preview generation' }), 'Preview generation')
    await waitForStatus(page, 'Generation plan is ready')
    const acceptDirty = page.getByLabel(/I reviewed and accept applying this plan/)
    if (await acceptDirty.count()) await acceptDirty.check()
    await click(page.getByRole('button', { name: 'Apply generation plan' }), 'Apply Python generation plan')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    await click(page.getByRole('button', { name: 'Install, build & test' }), 'Install Python runtime')
    await waitForStatus(page, 'Install, build, and test commands completed')
    evidence.screenshots.push(await shot(page, '11-python-build-applied'))

    await click(page.getByRole('tab', { name: 'Connections' }), 'Connections tab')
    if (await page.getByRole('button', { name: /Existing or new UI/i }).count()) throw new Error('Headless project incorrectly offered a UI entry point')
    await click(page.getByRole('button', { name: /Scheduled or background/i }), 'schedule trigger choice')
    await page.getByLabel('Capability', { exact: true }).selectOption(`${fixture.operationId}@1.0.0`)
    await page.getByLabel('Cron expression').fill('* * * * *')
    await page.getByLabel('Timezone').fill('UTC')
    await click(page.getByRole('button', { name: 'Approve entry point' }), 'Approve scheduled entry point')
    const configured = page.getByRole('region', { name: 'Configured entry points' })
    await expectVisible(configured, 'approved scheduled entry point')
    await expectVisible(configured.getByText('Approved', { exact: true }), 'approved scheduled status')

    await click(page.getByRole('button', { name: 'Regenerate plan' }).last(), 'Regenerate Python plan after schedule')
    await waitForStatus(page, 'Generation plan is ready')
    const acceptDirtyBound = page.getByLabel(/I reviewed and accept applying this plan/).last()
    if (await acceptDirtyBound.count()) await acceptDirtyBound.check()
    await waitEnabled(page.getByRole('button', { name: 'Apply generation plan' }).last(), 'scheduled Python generation apply')
    await click(page.getByRole('button', { name: 'Apply generation plan' }).last(), 'Apply scheduled Python plan')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    await click(page.getByRole('button', { name: 'Install, build & test' }).last(), 'Build scheduled Python plan')
    await waitForStatus(page, 'Install, build, and test commands completed')
    evidence.screenshots.push(await shot(page, '12-python-schedule-connected'))

    await click(page.getByRole('tab', { name: 'Verification' }), 'Verification tab')
    await click(page.getByRole('button', { name: 'Run real verification' }), 'Run Python schedule verification')
    await waitForStatus(page, 'real target launched')
    await expectVisible(page.getByText('pass', { exact: true }).first(), 'current Python passing evidence')
    evidence.screenshots.push(await shot(page, '13-python-real-verification'))
    evidence.passed = true
    return evidence
  } catch (error) {
    evidence.commandLogs = collectCommandLogs(dataDir, fixture.projectId, 'python-headless')
    const page = app.windows()[0]
    if (page) {
      evidence.screenshots.push(await shot(page, 'python-failure').catch(() => ''))
      evidence.visibleText = await page.locator('body').innerText().catch(() => '')
    }
    evidence.error = error instanceof Error ? error.stack : String(error)
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'python-headless.json'), JSON.stringify(evidence, null, 2) + '\n')
  }
}

async function runMixedReactPythonJourney(electron) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-production-mixed-'))
  const fixtureRepo = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(fixtureRepo, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const fixture = createMixedReactPythonFixture(fixtureRepo, 'production-mixed', 56_000 + Math.floor(Math.random() * 3_000))
  const workspacePython = path.join(REPO_ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
  const python = process.env.PYTHON ?? (fs.existsSync(workspacePython) ? workspacePython : process.platform === 'win32' ? 'python' : 'python3')
  run(python, ['-m', 'venv', path.join(fixtureRepo, '.venv')])
  const executablePath = packagedExecutable()
  const app = await electron.launch({
    executablePath,
    args: packagedLaunchArgs(),
    env: { ...process.env, EUIK_DATA_DIR: dataDir, EUIK_TEST_MODE: '1', EUIK_TEST_PICK_DIR: fixtureRepo, NO_PROXY: '127.0.0.1,localhost' },
    timeout: TIMEOUT,
  })
  const evidence = { journey: 'mixed-react-python-http', executablePath, packaged: false, scratch, screenshots: [], passed: false }
  try {
    const page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    if (!await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)) throw new Error('Electron reports app.isPackaged=false')
    evidence.packaged = true

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Production Mixed Journey')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production Mixed Journey' })
    await chooseInterviewFile(page, fixture.responseFiles.product, 'Application definition')
    await waitForStatus(page, 'Interview imported')
    await click(page.getByRole('button', { name: 'Approve definition' }), 'Approve definition')
    await waitForStatus(page, 'Approved application revision')
    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode')
    await click(page.getByRole('tab', { name: 'Architecture' }), 'Architecture tab')
    await waitEnabled(page.getByRole('button', { name: 'Export architecture interview' }), 'loaded architecture interview')
    await chooseInterviewFile(page, fixture.responseFiles.architecture, 'Architecture interview')
    await waitForStatus(page, 'Imported architecture proposal')
    await click(page.getByRole('button', { name: 'Approve architecture' }), 'Approve architecture')
    await waitForStatus(page, 'Architecture approved')
    await click(page.getByRole('button', { name: 'Propose foundation plan' }), 'Propose foundation plan')
    await waitEnabled(page.getByRole('button', { name: 'Approve foundation' }), 'ready mixed foundation approval')
    await click(page.getByRole('button', { name: 'Approve foundation' }), 'Approve foundation')
    await waitForStatus(page, 'Approved foundation plan')

    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab')
    for (const [moduleId, responseFile] of [['mod.ui', fixture.responseFiles.uiModule], ['mod.echo', fixture.responseFiles.domainModule]]) {
      const selector = page.getByRole('button', { name: `Select module ${moduleId}` })
      await click(selector, `Select ${moduleId}`)
      const deadline = Date.now() + TIMEOUT
      while (Date.now() < deadline && await selector.getAttribute('aria-current') !== 'true') await page.waitForTimeout(100)
      const moduleImport = page.locator('[aria-label="Import module interview response"] input[type=file]')
      await moduleImport.first().setInputFiles(responseFile)
      await waitForStatus(page, 'Imported module draft')
      await click(page.getByRole('button', { name: 'Approve module' }).first(), `Approve ${moduleId}`)
      await waitForStatus(page, 'Approved module')
    }

    await page.getByLabel(`Implementation factory for ${fixture.uiOperationId}`).fill('src/ui/run.ts#createUiRun')
    await click(page.getByRole('article', { name: 'Integration for browser' }).getByRole('button', { name: 'Save composition factories' }), 'Save browser factories')
    await page.getByLabel(`Implementation factory for ${fixture.domainOperationId}`).fill('src/domain/echo.py#create_echo_run')
    await click(page.getByRole('article', { name: 'Integration for http-api' }).getByRole('button', { name: 'Save composition factories' }), 'Save Python factories')
    await generateApplyBuild(page, 'browser')
    await generateApplyBuild(page, 'http-api')
    evidence.screenshots.push(await shot(page, '21-mixed-deployables-applied'))

    await click(page.getByRole('tab', { name: 'Connections' }), 'Connections tab')
    await click(page.getByRole('button', { name: /HTTP endpoint/i }), 'HTTP trigger choice')
    await page.getByLabel('Capability', { exact: true }).selectOption(`${fixture.domainOperationId}@1.0.0`)
    await page.getByLabel('HTTP path').fill('/echo')
    await click(page.getByRole('button', { name: 'Approve entry point' }), 'Approve Python HTTP entry point')
    await expectVisible(page.getByRole('region', { name: 'Configured entry points' }), 'configured HTTP entry point')

    await click(page.getByRole('button', { name: /Existing or new UI/i }), 'UI trigger choice')
    if (!await page.getByLabel('Application UI URL').count()) await click(page.getByRole('button', { name: 'Change UI setup' }), 'Change UI setup')
    await page.getByLabel('Application UI URL').fill(fixture.uiUrl)
    await page.getByLabel('Application UI start command').fill('npm run dev')
    await click(page.getByRole('button', { name: 'Save and use this UI' }), 'Save mixed UI')
    const useUi = page.getByRole('button', { name: 'Use this UI', exact: true })
    if (await useUi.count()) await click(useUi, 'Use mixed UI')
    await expectVisible(page.locator('webview'), 'mixed target application webview')
    await page.waitForTimeout(1_000)
    await selectTargetButton(page, app, fixture.uiUrl, 'Selected Run mixed capability')
    await page.getByLabel('Capability', { exact: true }).selectOption(`${fixture.uiOperationId}@1.0.0`)
    for (const input of await page.getByRole('region', { name: 'Define visible behavior' }).locator('input').all()) await input.fill('Show the cross-language outcome clearly.')
    await page.getByLabel('Test mode').selectOption('approved-example')
    await click(page.getByRole('button', { name: 'Run simulation' }), 'Run mixed simulation')
    await click(page.getByRole('button', { name: 'Approve connection' }), 'Approve mixed UI entry point')
    await expectVisible(page.getByRole('region', { name: 'Configured entry points' }).getByText('Approved', { exact: true }).last(), 'approved mixed UI status')

    await generateApplyBuild(page, 'http-api')
    await generateApplyBuild(page, 'browser')
    evidence.screenshots.push(await shot(page, '22-mixed-http-and-ui-connected'))

    await click(page.getByRole('tab', { name: 'Verification' }), 'Verification tab')
    const httpCard = page.locator('.cap-verification-card').filter({ hasText: 'http entry point' })
    await click(httpCard.getByRole('button', { name: 'Run real verification' }), 'Run Python HTTP verification')
    await expectVisible(httpCard.getByText('pass', { exact: true }), 'current HTTP passing evidence')
    const httpBindingId = (await httpCard.locator('h4').textContent())?.trim()
    if (!httpBindingId) throw new Error('HTTP verification card did not expose its binding id')
    const uiCard = page.locator('.cap-verification-card').filter({ hasText: 'ui entry point' })
    await click(uiCard.getByRole('button', { name: 'Run real verification' }), 'Run React-to-Python verification')
    await expectVisible(uiCard.getByText('pass', { exact: true }), 'current mixed passing evidence')
    await expectVisible(uiCard.getByText(httpBindingId, { exact: true }), 'cross-language outbound HTTP trace')
    evidence.screenshots.push(await shot(page, '23-mixed-cross-language-verification'))
    evidence.passed = true
    return evidence
  } catch (error) {
    evidence.commandLogs = collectCommandLogs(dataDir, fixture.projectId, 'mixed')
    const page = app.windows()[0]
    if (page) {
      evidence.screenshots.push(await shot(page, 'mixed-failure').catch(() => ''))
      evidence.visibleText = await page.locator('body').innerText().catch(() => '')
    }
    evidence.error = error instanceof Error ? error.stack : String(error)
    throw error
  } finally {
    await closePackagedApp(app)
    stopPort(fixture.uiUrl)
    stopPort('http://127.0.0.1:3000')
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'mixed-react-python.json'), JSON.stringify(evidence, null, 2) + '\n')
  }
}

async function runExistingRepositoryJourney(electron) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-production-existing-'))
  const fixtureRepo = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(fixtureRepo, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const fixture = createExistingRepositoryFixture(fixtureRepo)
  const workspacePython = path.join(REPO_ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
  const python = process.env.PYTHON ?? (fs.existsSync(workspacePython) ? workspacePython : process.platform === 'win32' ? 'python' : 'python3')
  run('git', ['init'], fixtureRepo)
  run('git', ['config', 'user.email', 'packaged-journey@example.invalid'], fixtureRepo)
  run('git', ['config', 'user.name', 'Packaged Journey'], fixtureRepo)
  run('git', ['add', '.'], fixtureRepo)
  run('git', ['commit', '-m', 'legacy baseline'], fixtureRepo)
  const baseline = repositorySnapshot(fixtureRepo)
  const baselineHash = snapshotHash(baseline)
  const legacyBefore = invokeLegacyPython(python, fixtureRepo, fixture.legacyExpected)
  const executablePath = packagedExecutable()
  const app = await electron.launch({
    executablePath,
    args: packagedLaunchArgs(),
    env: { ...process.env, EUIK_DATA_DIR: dataDir, EUIK_TEST_MODE: '1', EUIK_TEST_PICK_DIR: fixtureRepo },
    timeout: TIMEOUT,
  })
  const evidence = {
    journey: 'existing-repository-no-loss', executablePath, packaged: false, scratch,
    baselineHash, legacyBefore, screenshots: [], passed: false,
  }
  try {
    const page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    if (!await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)) throw new Error('Electron reports app.isPackaged=false')
    evidence.packaged = true

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Production Existing Repository')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production Existing Repository' })
    await chooseInterviewFile(page, fixture.responseFiles.product, 'Application definition')
    await waitForStatus(page, 'Interview imported')
    await click(page.getByRole('button', { name: 'Approve definition' }), 'Approve definition')
    await waitForStatus(page, 'Approved application revision')
    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode')
    await click(page.getByRole('tab', { name: 'Architecture' }), 'Architecture tab')
    await waitEnabled(page.getByRole('button', { name: 'Export architecture interview' }), 'loaded architecture interview')
    await chooseInterviewFile(page, fixture.responseFiles.architecture, 'Architecture interview')
    await waitForStatus(page, 'Imported architecture proposal')
    await click(page.getByRole('button', { name: 'Approve architecture' }), 'Approve architecture')
    await waitForStatus(page, 'Architecture approved')
    await click(page.getByRole('button', { name: 'Propose foundation plan' }), 'Propose foundation plan')
    const foundationQuestions = page.getByRole('group', { name: 'Open foundation questions' })
    if (await foundationQuestions.count()) await answerFoundationQuestions(page)
    await waitEnabled(page.getByRole('button', { name: 'Approve foundation' }), 'ready existing foundation approval')
    await click(page.getByRole('button', { name: 'Approve foundation' }), 'Approve foundation')
    await waitForStatus(page, 'Approved foundation plan')

    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab')
    await expectVisible(page.getByRole('article', { name: 'Integration for embedded-library' }), 'loaded existing deployable integration')
    const existingModule = page.getByRole('button', { name: 'Select module mod.job' })
    await click(existingModule, 'Select existing module')
    await expectVisible(page.getByLabel('Import module interview response'), 'existing module interview import')
    const migration = await expectVisible(page.getByRole('region', { name: 'Existing repository migration preview' }), 'existing repository migration preview')
    await expectVisible(migration.getByText('No data loss identified', { exact: true }), 'no-loss migration assessment')
    await expectVisible(migration.getByText('Repository conventions were detected without a blocking migration ambiguity.', { exact: false }), 'migration readiness')
    evidence.screenshots.push(await shot(page, '31-existing-migration-preview'))

    const moduleImport = page.locator('[aria-label="Import module interview response"] input[type=file]')
    await moduleImport.first().setInputFiles(fixture.responseFiles.module)
    await waitForStatus(page, 'Imported module draft')
    await click(page.getByRole('button', { name: 'Approve module' }).first(), 'Approve existing module')
    await waitForStatus(page, 'Approved module')
    await page.getByLabel(`Implementation factory for ${fixture.operationId}`).fill('src/domain/run_job.py#create_job_run')
    await click(page.getByRole('button', { name: 'Save composition factories' }), 'Save existing composition factory')
    await waitForStatus(page, 'Composition configuration saved')
    await click(page.getByRole('button', { name: 'Preview generation' }), 'Preview existing generation')
    await waitForStatus(page, 'Generation plan is ready')
    const acceptDirty = page.getByLabel(/I reviewed and accept applying this plan/)
    if (await acceptDirty.count()) await acceptDirty.check()
    await waitEnabled(page.getByRole('button', { name: 'Apply generation plan' }), 'existing generation apply')
    await click(page.getByRole('button', { name: 'Apply generation plan' }), 'Apply existing generation')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    const afterApply = repositorySnapshot(fixtureRepo)
    for (const original of baseline) {
      const current = afterApply.find((file) => file.path === original.path)
      if (!current || current.sha256 !== original.sha256) throw new Error(`original repository file changed during additive apply: ${original.path}`)
    }
    evidence.legacyAfterApply = invokeLegacyPython(python, fixtureRepo, fixture.legacyExpected)
    evidence.screenshots.push(await shot(page, '32-existing-additive-apply'))

    await click(page.getByRole('button', { name: 'Roll back' }), 'Roll back existing generation')
    await waitForStatus(page, 'Generation was rolled back')
    const restored = repositorySnapshot(fixtureRepo)
    evidence.restoredHash = snapshotHash(restored)
    if (JSON.stringify(restored) !== JSON.stringify(baseline)) {
      throw new Error(`rollback did not restore the exact original repository tree (${baselineHash} != ${evidence.restoredHash})`)
    }
    evidence.legacyAfterRollback = invokeLegacyPython(python, fixtureRepo, fixture.legacyExpected)
    evidence.screenshots.push(await shot(page, '33-existing-byte-identical-rollback'))
    evidence.passed = true
    return evidence
  } catch (error) {
    const page = app.windows()[0]
    if (page) {
      evidence.screenshots.push(await shot(page, 'existing-failure').catch(() => ''))
      evidence.visibleText = await page.locator('body').innerText().catch(() => '')
    }
    evidence.error = error instanceof Error ? error.stack : String(error)
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'existing-repository.json'), JSON.stringify(evidence, null, 2) + '\n')
  }
}

async function runFailureRecoveryJourney(electron) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-production-recovery-'))
  const fixtureRepo = path.join(scratch, 'repo')
  const dataDir = path.join(scratch, 'data')
  fs.mkdirSync(fixtureRepo, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })
  const fixture = createExistingRepositoryFixture(fixtureRepo, 'production-recovery')
  run('git', ['init'], fixtureRepo)
  run('git', ['config', 'user.email', 'packaged-journey@example.invalid'], fixtureRepo)
  run('git', ['config', 'user.name', 'Packaged Journey'], fixtureRepo)
  run('git', ['add', '.'], fixtureRepo)
  run('git', ['commit', '-m', 'recovery baseline'], fixtureRepo)
  const baseline = repositorySnapshot(fixtureRepo)
  const baselineHash = snapshotHash(baseline)
  const executablePath = packagedExecutable()
  const evidence = {
    journey: 'mid-transaction-failure-restart-recovery', executablePath, packaged: false, scratch,
    baselineHash, screenshots: [], passed: false,
  }
  let app
  try {
    app = await electron.launch({
      executablePath,
      args: packagedLaunchArgs(),
      env: {
        ...process.env, EUIK_DATA_DIR: dataDir, EUIK_TEST_MODE: '1', EUIK_TEST_PICK_DIR: fixtureRepo,
        EUIK_TEST_FAIL_GENERATION_RENAME_AT: '2',
      },
      timeout: TIMEOUT,
    })
    let page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    if (!await app.evaluate(({ app: electronApp }) => electronApp.isPackaged)) throw new Error('Electron reports app.isPackaged=false')
    evidence.packaged = true

    await click(page.getByRole('button', { name: 'New Project' }).first(), 'New Project')
    await page.getByLabel('Project name').fill('Production Failure Recovery')
    await click(page.getByRole('button', { name: 'Browse' }), 'repository Browse')
    await click(page.getByRole('button', { name: 'Create Project' }), 'Create Project')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production Failure Recovery' })
    await chooseInterviewFile(page, fixture.responseFiles.product, 'Application definition')
    await waitForStatus(page, 'Interview imported')
    await click(page.getByRole('button', { name: 'Approve definition' }), 'Approve definition')
    await waitForStatus(page, 'Approved application revision')
    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode')
    await click(page.getByRole('tab', { name: 'Architecture' }), 'Architecture tab')
    await waitEnabled(page.getByRole('button', { name: 'Export architecture interview' }), 'loaded architecture interview')
    await chooseInterviewFile(page, fixture.responseFiles.architecture, 'Architecture interview')
    await waitForStatus(page, 'Imported architecture proposal')
    await click(page.getByRole('button', { name: 'Approve architecture' }), 'Approve architecture')
    await waitForStatus(page, 'Architecture approved')
    await click(page.getByRole('button', { name: 'Propose foundation plan' }), 'Propose foundation plan')
    const foundationQuestions = page.getByRole('group', { name: 'Open foundation questions' })
    if (await foundationQuestions.count()) await answerFoundationQuestions(page)
    await waitEnabled(page.getByRole('button', { name: 'Approve foundation' }), 'ready recovery foundation approval')
    await click(page.getByRole('button', { name: 'Approve foundation' }), 'Approve foundation')
    await waitForStatus(page, 'Approved foundation plan')
    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab')
    await expectVisible(page.getByRole('article', { name: 'Integration for embedded-library' }), 'loaded recovery deployable integration')
    const recoveryModule = page.getByRole('button', { name: 'Select module mod.job' })
    await click(recoveryModule, 'Select recovery module')
    await expectVisible(page.getByLabel('Import module interview response'), 'recovery module interview import')
    const moduleImport = page.locator('[aria-label="Import module interview response"] input[type=file]')
    await moduleImport.first().setInputFiles(fixture.responseFiles.module)
    await waitForStatus(page, 'Imported module draft')
    await click(page.getByRole('button', { name: 'Approve module' }).first(), 'Approve recovery module')
    await waitForStatus(page, 'Approved module')
    await page.getByLabel(`Implementation factory for ${fixture.operationId}`).fill('src/domain/run_job.py#create_job_run')
    await click(page.getByRole('button', { name: 'Save composition factories' }), 'Save recovery composition factory')
    await waitForStatus(page, 'Composition configuration saved')
    await click(page.getByRole('button', { name: 'Preview generation' }), 'Preview recovery generation')
    await waitForStatus(page, 'Generation plan is ready')
    await waitEnabled(page.getByRole('button', { name: 'Apply generation plan' }), 'failure-injected generation apply')
    await click(page.getByRole('button', { name: 'Apply generation plan' }), 'Apply with injected failure')
    await waitForStatus(page, 'repository was fully restored')
    await page.getByText('repository was fully restored', { exact: false }).last().scrollIntoViewIfNeeded()
    const restoredAfterFailure = repositorySnapshot(fixtureRepo)
    evidence.afterFailureHash = snapshotHash(restoredAfterFailure)
    if (JSON.stringify(restoredAfterFailure) !== JSON.stringify(baseline)) throw new Error('mid-transaction failure did not restore the original repository exactly')
    evidence.screenshots.push(await shot(page, '41-mid-transaction-failure-restored'))
    await closePackagedApp(app)
    app = undefined

    app = await electron.launch({
      executablePath,
      args: packagedLaunchArgs(),
      env: { ...process.env, EUIK_DATA_DIR: dataDir, EUIK_TEST_MODE: '1', EUIK_TEST_PICK_DIR: fixtureRepo },
      timeout: TIMEOUT,
    })
    page = await app.firstWindow({ timeout: TIMEOUT })
    page.setDefaultTimeout(TIMEOUT)
    await page.waitForLoadState('domcontentloaded')
    await click(page.getByRole('button', { name: 'Capabilities' }), 'Capabilities navigation after restart')
    await page.getByLabel('Capabilities project').selectOption({ label: 'Production Failure Recovery' })
    await click(page.getByRole('button', { name: 'Design', exact: true }), 'Design mode after restart')
    await click(page.getByRole('tab', { name: 'Modules' }), 'Modules tab after restart')
    const card = page.getByRole('article', { name: 'Integration for embedded-library' })
    const recoveredAlert = await expectVisible(card.getByRole('alert'), 'persisted failed apply recovery')
    await recoveredAlert.scrollIntoViewIfNeeded()
    await expectVisible(card.getByText('failed', { exact: true }), 'persisted failed lifecycle status')
    const retry = card.getByRole('button', { name: 'Apply generation plan' })
    await waitEnabled(retry, 'retry generation apply after restart')
    evidence.screenshots.push(await shot(page, '42-recoverable-state-after-restart'))
    await click(retry, 'Retry generation after restart')
    await waitForStatus(page, 'Reference-architecture infrastructure applied')
    await page.getByText('Reference-architecture infrastructure applied', { exact: false }).last().scrollIntoViewIfNeeded()
    evidence.screenshots.push(await shot(page, '43-retry-succeeded'))
    await click(card.getByRole('button', { name: 'Roll back' }), 'Roll back successful retry')
    await waitForStatus(page, 'Generation was rolled back')
    const restoredAfterRetry = repositorySnapshot(fixtureRepo)
    evidence.finalHash = snapshotHash(restoredAfterRetry)
    if (JSON.stringify(restoredAfterRetry) !== JSON.stringify(baseline)) throw new Error('final rollback did not restore the original repository exactly')
    evidence.passed = true
    return evidence
  } catch (error) {
    const page = app?.windows()[0]
    if (page) {
      evidence.screenshots.push(await shot(page, 'recovery-failure').catch(() => ''))
      evidence.visibleText = await page.locator('body').innerText().catch(() => '')
    }
    evidence.error = error instanceof Error ? error.stack : String(error)
    throw error
  } finally {
    await closePackagedApp(app)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'failure-recovery.json'), JSON.stringify(evidence, null, 2) + '\n')
  }
}

const watchdog = setTimeout(() => {
  console.error(`Packaged production journey exceeded ${JOURNEY_TIMEOUT}ms`)
  process.exit(1)
}, JOURNEY_TIMEOUT)
watchdog.unref()

try {
  if (BUILD) {
    run('npm', ['run', 'build', '-w', 'packages/core'])
    run('npm', ['run', 'build', '-w', 'packages/capabilities-runtime-ts'])
    run('npm', ['run', 'build', '-w', 'apps/gui'])
    run('npm', ['run', 'build', '-w', 'apps/desktop'])
    run('npm', ['run', 'package:dir', '-w', 'apps/desktop'])
  }
  const { _electron } = await import('playwright')
  const selected = new Set((process.env.EUIK_PACKAGED_JOURNEYS ?? 'typescript-ui,python-headless,mixed,existing,recovery').split(',').map((value) => value.trim()).filter(Boolean))
  const results = []
  const runJourney = async (name, journey) => {
    console.log(`[journey:start] ${name}`)
    const result = await journey(_electron)
    console.log(`[journey:pass] ${name}`)
    return result
  }
  if (selected.has('typescript-ui')) results.push(await runJourney('typescript-ui', runTypeScriptUiJourney))
  if (selected.has('python-headless')) results.push(await runJourney('python-headless', runPythonHeadlessJourney))
  if (selected.has('mixed')) results.push(await runJourney('mixed', runMixedReactPythonJourney))
  if (selected.has('existing')) results.push(await runJourney('existing', runExistingRepositoryJourney))
  if (selected.has('recovery')) results.push(await runJourney('recovery', runFailureRecoveryJourney))
  if (results.length === 0) throw new Error('EUIK_PACKAGED_JOURNEYS did not select a known journey')
  console.log(JSON.stringify(results, null, 2))
  if (results.some((result) => !result.passed)) process.exitCode = 1
} catch (error) {
  const failure = { passed: false, error: error instanceof Error ? error.stack : String(error), completedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'failure.json'), JSON.stringify(failure, null, 2) + '\n')
  console.error(failure.error)
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
}
