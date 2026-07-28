// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DiagramProjection } from '@engineering-ui-kit/core'
import { UmlDiagramWorkspace } from '../src/views/capabilities/UmlDiagramWorkspace'

// JointJS deliberately checks for SVGAngle before enabling its SVG runtime.
// jsdom does not expose the otherwise-obsolete constructor, so advertise the
// SVG surface before the component's deferred JointJS import runs.
Object.defineProperty(window, 'SVGAngle', {
  configurable: true,
  value: class SVGAngle {},
})

class SVGMatrixMock {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0

  multiply(other: SVGMatrixMock): SVGMatrixMock {
    const next = new SVGMatrixMock()
    next.a = this.a * other.a + this.c * other.b
    next.b = this.b * other.a + this.d * other.b
    next.c = this.a * other.c + this.c * other.d
    next.d = this.b * other.c + this.d * other.d
    next.e = this.a * other.e + this.c * other.f + this.e
    next.f = this.b * other.e + this.d * other.f + this.f
    return next
  }

  translate(x: number, y: number): SVGMatrixMock {
    const next = new SVGMatrixMock()
    next.e = x
    next.f = y
    return this.multiply(next)
  }

  scale(x: number, y = x): SVGMatrixMock {
    const next = new SVGMatrixMock()
    next.a = x
    next.d = y
    return this.multiply(next)
  }

  rotate(angle: number): SVGMatrixMock {
    const radians = angle * Math.PI / 180
    const next = new SVGMatrixMock()
    next.a = Math.cos(radians)
    next.b = Math.sin(radians)
    next.c = -Math.sin(radians)
    next.d = Math.cos(radians)
    return this.multiply(next)
  }

  inverse(): SVGMatrixMock {
    const determinant = this.a * this.d - this.b * this.c
    const next = new SVGMatrixMock()
    next.a = this.d / determinant
    next.b = -this.b / determinant
    next.c = -this.c / determinant
    next.d = this.a / determinant
    next.e = (this.c * this.f - this.d * this.e) / determinant
    next.f = (this.b * this.e - this.a * this.f) / determinant
    return next
  }
}

Object.assign(SVGSVGElement.prototype, {
  createSVGMatrix: () => new SVGMatrixMock(),
  createSVGPoint: () => ({
    x: 0,
    y: 0,
    matrixTransform(matrix: SVGMatrixMock) {
      return {
        x: this.x * matrix.a + this.y * matrix.c + matrix.e,
        y: this.x * matrix.b + this.y * matrix.d + matrix.f,
      }
    },
  }),
  createSVGTransform: () => ({
    matrix: new SVGMatrixMock(),
    setMatrix(matrix: SVGMatrixMock) { this.matrix = matrix },
  }),
})

Object.defineProperty(SVGElement.prototype, 'transform', {
  configurable: true,
  get: () => ({
    baseVal: {
      appendItem: () => undefined,
      consolidate: () => null,
    },
  }),
})
Object.assign(SVGElement.prototype, {
  getBBox: () => ({ x: 0, y: 0, width: 120, height: 24 }),
  getCTM: () => new SVGMatrixMock(),
  getScreenCTM: () => new SVGMatrixMock(),
  getComputedTextLength() {
    return (this.textContent?.length ?? 0) * 7
  },
})
Object.defineProperty(Element.prototype, 'checkVisibility', {
  configurable: true,
  value: () => true,
})

afterEach(cleanup)

function componentProjection(withEvidence = false): DiagramProjection {
  return {
    schemaVersion: '1.0',
    id: 'diagram:component:workflow',
    kind: 'component',
    projectId: 'project:test',
    contextId: 'module:workflow',
    title: 'Workflow orchestration component diagram',
    sourceRevision: withEvidence ? '8' : '7',
    nodes: [
      {
        id: 'component:console',
        kind: 'component',
        label: 'Operations console',
        description: 'Presents workflow controls.',
        sourceRecordId: 'architecture:1',
        traceIds: ['use-case:start'],
      },
      {
        id: 'component:workflow',
        kind: 'component',
        label: 'Workflow orchestration',
        description: 'Coordinates workflow execution.',
        sourceRecordId: 'design:workflow',
        traceIds: ['use-case:start'],
      },
      {
        id: 'provided:workflow:start',
        kind: 'provided-interface',
        label: 'startWorkflow',
        description: 'Starts an approved workflow.',
        sourceRecordId: 'design:workflow',
        traceIds: ['use-case:start'],
        parentId: 'component:workflow',
      },
      ...(withEvidence ? [{
        id: 'component:evidence',
        kind: 'component' as const,
        label: 'Evidence service',
        description: 'Stores workflow evidence.',
        sourceRecordId: 'architecture:1',
        traceIds: ['use-case:start'],
      }, {
        id: 'required:workflow:evidence',
        kind: 'required-interface' as const,
        label: 'recordEvidence',
        description: 'Records evidence.',
        sourceRecordId: 'design:workflow',
        traceIds: ['use-case:start'],
        parentId: 'component:workflow',
      }] : []),
    ],
    edges: [
      {
        id: 'dependency:console:workflow',
        kind: 'dependency',
        fromId: 'component:console',
        toId: 'provided:workflow:start',
        label: '«use»',
        description: 'The console starts workflows.',
        sourceRecordId: 'architecture:1',
        traceIds: ['use-case:start'],
      },
      ...(withEvidence ? [{
        id: 'dependency:workflow:evidence',
        kind: 'dependency' as const,
        fromId: 'required:workflow:evidence',
        toId: 'component:evidence',
        label: '«use»',
        description: 'The workflow records evidence.',
        sourceRecordId: 'architecture:1',
        traceIds: ['use-case:start'],
      }] : []),
    ],
    diagnostics: [],
    textAlternative: 'Operations console uses workflow orchestration.',
    contentHash: withEvidence ? 'component-hash-8' : 'component-hash-7',
  }
}

describe('record-driven JointJS UML workspace', () => {
  it('mounts a JointJS paper with semantic cells, a real port, and routed connector', async () => {
    const { container } = render(<UmlDiagramWorkspace diagrams={[componentProjection()]} />)

    await waitFor(() => expect(container.querySelector('.uml-joint-paper svg')).toBeTruthy())
    expect(container.querySelectorAll('.uml-joint-component')).toHaveLength(2)
    expect(container.querySelectorAll('.uml-joint-link')).toHaveLength(1)
    expect(container.querySelectorAll('.uml-joint-edge-label')).toHaveLength(1)

    const port = container.querySelector('[port="provided:workflow:start"]')
    expect(port).toBeTruthy()
    expect(port?.querySelector('.uml-joint-port-body')).toBeTruthy()

    const connector = container.querySelector('.uml-joint-link-line')
    expect(connector?.getAttribute('d')).toMatch(/^M /)
    expect(connector?.getAttribute('stroke-dasharray')).toBe('7 5')
    expect(screen.getAllByText('ELK orthogonal layout')).toHaveLength(1)
    expect(screen.queryByRole('complementary', { name: 'Diagram element details' })).toBeNull()
  })

  it('selects semantic ports and connectors through the accessible inspector', async () => {
    render(<UmlDiagramWorkspace diagrams={[componentProjection()]} />)
    expect((await screen.findAllByText('ELK orthogonal layout')).length).toBeGreaterThan(0)
    await waitFor(() => expect(document.querySelector('[port="provided:workflow:start"]')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Inspect diagram element'), {
      target: { value: 'provided:workflow:start' },
    })
    expect(screen.getByRole('heading', { name: 'startWorkflow' })).toBeTruthy()
    expect(screen.getByText('Starts an approved workflow.')).toBeTruthy()
    expect(document.querySelector('[port="provided:workflow:start"]')?.classList.contains('selected')).toBe(true)

    fireEvent.change(screen.getByLabelText('Inspect diagram element'), {
      target: { value: 'dependency:console:workflow' },
    })
    expect(screen.getByRole('heading', { name: '«use»' })).toBeTruthy()
    expect(screen.getAllByText('The console starts workflows.').length).toBeGreaterThan(0)
    expect(document.querySelector('.uml-joint-link')?.classList.contains('selected')).toBe(true)
    expect(document.querySelector('.uml-joint-edge-label')?.classList.contains('selected')).toBe(true)
  })

  it('replaces the paper when the canonical projection content hash changes', async () => {
    const { container, rerender } = render(
      <UmlDiagramWorkspace diagrams={[componentProjection()]} />,
    )
    await waitFor(() => expect(container.querySelectorAll('.uml-joint-component')).toHaveLength(2))

    rerender(<UmlDiagramWorkspace diagrams={[componentProjection(true)]} />)
    await waitFor(() => expect(container.querySelectorAll('.uml-joint-component')).toHaveLength(3))
    expect(container.querySelector('[data-semantic-id="component:evidence"]')).toBeTruthy()
    expect(container.querySelector('[port="required:workflow:evidence"]')).toBeTruthy()
    expect(container.querySelectorAll('.uml-joint-link')).toHaveLength(2)
    expect(container.querySelector('[data-diagram-content-hash="component-hash-8"]')).toBeTruthy()
  })
})
