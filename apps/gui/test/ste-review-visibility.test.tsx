// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { installMockBridge } from '../src/mockBridge'
import { ApplicationDefinition } from '../src/views/capabilities/ApplicationDefinition'
import { ArchitectureInterview } from '../src/views/capabilities/ArchitectureInterview'
import { ModuleDesignWorkspace } from '../src/views/capabilities/ModuleDesignWorkspace'
import { ModulesView } from '../src/views/capabilities/ModulesView'

afterEach(cleanup)

const projectId = 'do-178c-audit-hub'
const moduleId = 'mod.assurance-workflow'

describe('writing review visibility', () => {
  it('shows review findings in the application workspace', async () => {
    const bridge = installMockBridge()
    render(
      <ApplicationDefinition
        bridge={bridge}
        projectId={projectId}
        projection="design"
      />,
    )

    expect((await screen.findByLabelText('Writing review items')).textContent).toContain('Writing review')
  })

  it('shows review findings in the architecture workspace', async () => {
    const bridge = installMockBridge()
    render(
      <ArchitectureInterview
        bridge={bridge}
        projectId={projectId}
        architectureApproved
        projection="design"
      />,
    )

    expect((await screen.findByLabelText('Writing review items')).textContent).toContain('Writing review')
  })

  it('shows review findings in the module workspace', async () => {
    const bridge = installMockBridge()
    const records = await bridge.capabilitiesListModules(projectId)
    render(
      <ModulesView
        bridge={bridge}
        projectId={projectId}
        architectureApproved
        projection="guided"
        records={records}
        hideModuleList
        progressive
        externalSelectedModuleId={moduleId}
      />,
    )

    expect((await screen.findByLabelText('Writing review items')).textContent).toContain('Writing review')
  })

  it('shows review findings in the module-design workspace', async () => {
    const bridge = installMockBridge()
    render(
      <ModuleDesignWorkspace
        bridge={bridge}
        projectId={projectId}
        moduleId={moduleId}
        moduleApproved
        projection="design"
      />,
    )

    expect((await screen.findByLabelText('Writing review items')).textContent).toContain('Writing review')
  })
})
