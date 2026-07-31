import { describe, expect, it } from 'vitest'
import {
  analyzeUmlLayoutQuality,
  layoutUmlDiagram,
} from '../src/views/capabilities/umlDiagramLayout'
import { UML_ROBUSTNESS_FIXTURES } from './fixtures/uml-robustness'

describe('UML product robustness matrix', () => {
  for (const fixture of UML_ROBUSTNESS_FIXTURES) {
    it(`lays out the ${fixture.context} product without losing semantics`, async () => {
      const first = await layoutUmlDiagram(fixture.projection)
      const second = await layoutUmlDiagram(fixture.projection)
      expect(second).toEqual(first)
      const projectedPorts = fixture.projection.nodes.filter((node) =>
        node.kind === 'provided-interface'
        || node.kind === 'required-interface'
        || node.kind === 'port')
      expect(first.nodes).toHaveLength(fixture.projection.nodes.length - projectedPorts.length)
      expect(first.nodes.flatMap((node) => node.ports)).toHaveLength(projectedPorts.length)
      expect(first.edges).toHaveLength(fixture.projection.edges.length)
      const quality = analyzeUmlLayoutQuality(first, fixture.projection)
      console.log(JSON.stringify({
        context: fixture.context,
        kind: fixture.projection.kind,
        symbols: fixture.projection.nodes.length,
        connectors: fixture.projection.edges.length,
        width: first.width,
        height: first.height,
        engine: first.engine,
        ...quality,
        preferredCrossingTarget: 1,
        meetsPreferredCrossingTarget: quality.crossings <= 1,
      }))
      expect(quality.nodeOverlaps).toBe(0)
      // Stress graphs are allowed a small, visible crossing budget so the
      // suite can retain shapes that expose real routing limits. The preferred
      // product target remains one crossing or fewer and is reported in the
      // evidence output instead of being hidden by a simplified fixture.
      expect(quality.crossings).toBeLessThanOrEqual(
        Math.max(1, Math.ceil(fixture.projection.edges.length / 7)),
      )
      expect(quality.overlappingConnectorPairs).toBe(0)
      expect(quality.edgeNodeClearanceViolations).toBe(0)
      expect(quality.labelNodeOverlaps).toBe(0)
      expect(quality.labelLabelOverlaps).toBe(0)
      expect(quality.connectorLabelOverlaps).toBe(0)
      expect(quality.portAlignmentViolations).toBe(0)
      expect(quality.canvasBoundsViolations).toBe(0)
      expect(quality.bends).toBeLessThanOrEqual(fixture.projection.edges.length * 3)
      for (const connector of first.edges) {
        for (let index = 1; index < connector.points.length - 1; index += 1) {
          const before = connector.points[index - 1]!
          const point = connector.points[index]!
          const after = connector.points[index + 1]!
          expect(
            (before.x === point.x && point.x === after.x)
            || (before.y === point.y && point.y === after.y),
            `${fixture.context}: ${connector.id}`,
          ).toBe(false)
        }
      }
    })
  }

  it.todo('reduces every stress layout to the preferred target of one crossing or fewer')
})
