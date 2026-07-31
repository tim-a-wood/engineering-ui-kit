import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { inspectOverlay } from '@engineering-ui-kit/core'
import { checkSteText } from '@engineering-ui-kit/core/browser'

const appSourceRoot = path.resolve(process.cwd(), 'src')
const sourceRoot = path.join(appSourceRoot, 'views')

function source(relativePath: string): string {
  return fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8')
}

describe('STE static workflow copy', () => {
  it('does not use an em dash in frontend source', () => {
    const violations: string[] = []
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (/ 2\.[^.]+$/i.test(entry.name)) continue
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) visit(absolutePath)
        else if (/\.(?:html|jsx|tsx|vue|svelte|astro|js|ts|json)$/i.test(entry.name)) {
          const content = fs.readFileSync(absolutePath, 'utf8')
          if (content.includes('\u2014')) {
            violations.push(path.relative(appSourceRoot, absolutePath).replaceAll(path.sep, '/'))
          }
        }
      }
    }
    visit(appSourceRoot)

    expect(violations).toEqual([])
  })

  it('blocks deterministic STE defects in all generated-code text sinks', () => {
    const sourceFiles: string[] = []
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) visit(absolutePath)
        else if (
          !/ 2\.[^.]+$/i.test(entry.name)
          && /\.(?:html|jsx|tsx|vue|svelte|astro|js|ts)$/i.test(entry.name)
        ) sourceFiles.push(absolutePath)
      }
    }
    visit(appSourceRoot)

    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-gui-ste-'))
    const findings: string[] = []
    try {
      for (const absolutePath of sourceFiles) {
        const relativePath = path.relative(appSourceRoot, absolutePath).replaceAll(path.sep, '/')
        const zipPath = path.join(temporaryRoot, `${findings.length}-${path.basename(absolutePath)}.zip`)
        const zip = new AdmZip()
        zip.addFile(relativePath, fs.readFileSync(absolutePath))
        zip.writeZip(zipPath)
        const summary = inspectOverlay(zipPath, {
          runId: 'gui-static-copy',
          targetRoot: temporaryRoot,
        })
        findings.push(...summary.hardBlockers
          .filter((item) => item.ruleId === 'AI-HANDOFF-STE-001')
          .map((item) => `${item.path}: ${item.message}`))
      }
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true })
    }

    expect(findings).toEqual([])
  })

  it('keeps corrected workflow descriptions free of deterministic defects', () => {
    const descriptions = [
      'Click to browse. The application checks the zip before it applies changes.',
      'Paste the prompt and the same two upload files into a new Copilot session.',
      'The prompt lists each violation and requests a corrected ui-overlay.zip.',
      'Saving creates a new application revision. The current approved record remains immutable.',
      'No action allocations are recorded. Module design cannot show the responsible module.',
    ]

    for (const text of descriptions) {
      expect(checkSteText(text, { textClass: 'description' }).diagnostics).toEqual([])
    }

    const ambiguousAction = checkSteText('Continue', { textClass: 'action-label' })
    expect(ambiguousAction.diagnostics).toEqual([])
    expect(ambiguousAction.reviewDiagnostics).toContainEqual(expect.objectContaining({
      code: 'STE-REVIEW-ACTION-FORM',
    }))
  })

  it('uses the corrected copy in each affected view', () => {
    expect(source('build/OverlayWorkspace.tsx')).toContain(
      'The application checks the zip before it applies changes.',
    )
    expect(source('build/OverlayWorkspace.tsx')).toContain(
      'The prompt lists each violation and requests a corrected',
    )
    expect(source('capabilities/UseCaseAnalysisPanel.tsx')).toContain(
      'The current approved record remains immutable.',
    )
    expect(source('capabilities/ArchitectureView.tsx')).toContain(
      'Module design cannot show the responsible module.',
    )
    expect(source('capabilities/ModuleDesignWorkspace.tsx')).toContain(
      "? 'Continue' : 'Save'",
    )
  })
})
