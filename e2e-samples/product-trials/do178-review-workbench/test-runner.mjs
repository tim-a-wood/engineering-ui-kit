import fs from 'node:fs'
import path from 'node:path'

const screenshotPath = process.env.EUIK_SCREENSHOT_PATH
const proofPath = path.resolve('scenario-proof.png')
const appPath = path.resolve('capabilities/modules/mod.experience-first/ui/index.html')
const passed = fs.existsSync(appPath) && fs.statSync(appPath).size > 0

if (passed && screenshotPath && fs.existsSync(proofPath)) {
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
  fs.copyFileSync(proofPath, screenshotPath)
}

process.stdout.write(JSON.stringify({
  passed,
  module: process.argv[2] ?? 'all',
  artifact: appPath,
}))
process.exitCode = passed ? 0 : 1
