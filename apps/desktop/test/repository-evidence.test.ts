import { describe, expect, it } from 'vitest'

import { discoverRepository } from '@engineering-ui-kit/core'
import {
  pyprojectManifestContent,
  requirementsTxtDependencies,
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
})
