import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { discoverRepository } from '@engineering-ui-kit/core'
import {
  pyprojectManifestContent,
  requirementsTxtDependencies,
  buildRepositoryEvidence,
} from '../src/capabilities/repositoryEvidence.js'

describe('desktop repository dependency evidence', () => {
  it('detects PEP 621 dependencies from multiline pyproject arrays', () => {
    const content = pyprojectManifestContent(`
[project]
name = "mixed-app"
dependencies = [
  "fastapi>=0.116", # production HTTP host
  "uvicorn[standard]~=0.35",
]
`)

    const discovery = discoverRepository({
      repositoryId: 'mixed-app',
      files: [{ path: 'pyproject.toml' }, { path: 'src/app.py' }],
      manifests: [{ path: 'pyproject.toml', content }],
    })

    expect(discovery.frameworks).toContain('fastapi')
  })

  it('detects Poetry dependencies without treating Python itself as a package', () => {
    expect(pyprojectManifestContent(`
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.116"
"internal-library" = { path = "../internal" }
`)).toEqual({
      tool: { poetry: { dependencies: { fastapi: '', 'internal-library': '' } } },
    })
  })

  it('keeps requirements parsing conservative and ignores options and comments', () => {
    expect(requirementsTxtDependencies(`
-r base.txt
fastapi[standard]>=0.116 # web host
uvicorn~=0.35; python_version >= "3.11"
    `)).toEqual({ fastapi: '', uvicorn: '' })
  })

  it('collects bounded live evidence without traversing generated dependency trees', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euik-repository-evidence-'))
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true })
      fs.mkdirSync(path.join(root, 'node_modules', 'hidden'), { recursive: true })
      fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const legacy = true\n')
      fs.writeFileSync(path.join(root, 'node_modules', 'hidden', 'ignored.ts'), 'ignored\n')
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }))

      const evidence = buildRepositoryEvidence(root)

      expect(evidence.files.map((file) => file.path)).toContain('src/index.ts')
      expect(evidence.files.map((file) => file.path)).not.toContain('node_modules/hidden/ignored.ts')
      expect(discoverRepository(evidence).frameworks).toContain('react')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
