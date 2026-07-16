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
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createTypeScriptUiFixture } from './production-capabilities-fixtures.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EVIDENCE_DIR = path.join(REPO_ROOT, 'apps/desktop/validation-evidence/capabilities-production/packaged')
const BUILD = process.env.EUIK_PACKAGED_SKIP_BUILD !== '1'
const TIMEOUT = Number(process.env.EUIK_PACKAGED_TIMEOUT_MS ?? 60_000)
const JOURNEY_TIMEOUT = Number(process.env.EUIK_PACKAGED_JOURNEY_TIMEOUT_MS ?? 360_000)

fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
for (const stale of ['failure.json', 'failure.png']) fs.rmSync(path.join(EVIDENCE_DIR, stale), { force: true })

function run(command, args, cwd = REPO_ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`)
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
    const found = fs.readdirSync(path.join(REPO_ROOT, 'release'), { recursive: true })
      .map((entry) => path.join(REPO_ROOT, 'release', String(entry)))
      .find((entry) => /engineering-ui-kit$/i.test(path.basename(entry)) && fs.statSync(entry).isFile())
    if (found) return found
  }
  throw new Error(`No unpacked packaged executable found for ${process.platform}`)
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

async function selectTargetButton(page, app, targetUrl) {
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
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 50 })
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: 100, y: 50, button: 'left', clickCount: 1 })
    await guest.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 50, button: 'left', clickCount: 1 })
    return true
  }, targetUrl)
  if (!clicked) throw new Error('Target preview guest webContents was not found')
  await waitForStatus(page, 'Selected Run capability')
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
    await app.close().catch(() => {})
    stopPort(fixture.uiUrl)
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'typescript-ui.json'), JSON.stringify(evidence, null, 2) + '\n')
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
  const result = await runTypeScriptUiJourney(_electron)
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
} catch (error) {
  const failure = { passed: false, error: error instanceof Error ? error.stack : String(error), completedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'failure.json'), JSON.stringify(failure, null, 2) + '\n')
  console.error(failure.error)
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
}
