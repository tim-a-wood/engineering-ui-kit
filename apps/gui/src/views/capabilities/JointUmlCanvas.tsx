import { useEffect, useRef } from 'react'
import type { dia } from '@joint/core'
import type {
  DiagramProjection,
  DiagramProjectionEdge,
  DiagramProjectionNode,
} from '@engineering-ui-kit/core'
import type {
  UmlDiagramLayout,
  UmlLayoutEdge,
  UmlLayoutNode,
  UmlLayoutPort,
  UmlPoint,
} from './umlDiagramLayout'
import { edgeDisplayLabel } from './umlDiagramLayout'

type Props = {
  diagram: DiagramProjection
  layout: UmlDiagramLayout
  selectionId: string
  zoom: number
  onSelect: (id: string) => void
}

type Markup = dia.MarkupJSON

type JointModule = typeof import('@joint/core')

type JointRuntime = {
  joint: JointModule
  UmlNode: dia.Cell.Constructor<dia.Element>
  UmlEdgeLabel: dia.Cell.Constructor<dia.Element>
  cellNamespace: Record<string, unknown>
}

let runtimePromise: Promise<JointRuntime> | undefined

function loadJointRuntime(): Promise<JointRuntime> {
  runtimePromise ??= import('@joint/core').then((joint) => {
    const UmlNode = joint.dia.Element.define('uml.Node')
    const UmlEdgeLabel = joint.dia.Element.define('uml.EdgeLabel')
    return {
      joint,
      UmlNode,
      UmlEdgeLabel,
      cellNamespace: {
        ...joint.shapes,
        uml: {
          Node: UmlNode,
          EdgeLabel: UmlEdgeLabel,
        },
      },
    }
  })
  return runtimePromise
}

function className(value: string): { class: string } {
  return { class: value }
}

function textAttrs(value: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: value,
    class: 'uml-joint-label',
    textAnchor: 'middle',
    textVerticalAnchor: 'middle',
    ...extra,
  }
}

function rootAttrs(node: DiagramProjectionNode): Record<string, unknown> {
  return {
    class: `uml-joint-cell uml-joint-${node.kind}`,
    role: 'button',
    tabIndex: 0,
    'aria-label': `${node.kind}: ${node.label}`,
    'data-semantic-id': node.id,
  }
}

function componentMarkup(): Markup {
  return [
    { tagName: 'rect', selector: 'shadow' },
    { tagName: 'rect', selector: 'body' },
    { tagName: 'path', selector: 'componentIconRear' },
    { tagName: 'path', selector: 'componentIconFront' },
    { tagName: 'text', selector: 'stereotype' },
    { tagName: 'text', selector: 'label' },
    { tagName: 'title', selector: 'title' },
  ]
}

function componentAttrs(node: DiagramProjectionNode): dia.Cell.Selectors {
  return {
    root: rootAttrs(node),
    shadow: {
      ...className('uml-joint-shadow'),
      x: 0,
      y: 3,
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 9,
    },
    body: {
      ...className('uml-joint-body'),
      x: 0,
      y: 0,
      width: 'calc(w)',
      height: 'calc(h)',
      rx: 9,
    },
    componentIconRear: {
      ...className('uml-joint-component-icon'),
      d: 'M calc(w - 42) 18 h 18 v 16 h -18 z',
    },
    componentIconFront: {
      ...className('uml-joint-component-icon'),
      d: 'M calc(w - 50) 25 h 18 v 16 h -18 z',
    },
    stereotype: {
      text: `«${node.stereotype ?? 'component'}»`,
      class: 'uml-joint-stereotype',
      x: 18,
      y: 24,
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
    },
    label: textAttrs(node.label, {
      x: 'calc(w / 2)',
      y: 'calc(h / 2 + 14)',
      textWrap: { width: -46, height: -58, ellipsis: true },
    }),
    title: { text: `${node.label}\n${node.description}` },
  }
}

function portMarkup(port: UmlLayoutPort): Markup {
  const provided = port.kind === 'provided-interface'
  return provided
    ? [
      { tagName: 'line', selector: 'portStem' },
      { tagName: 'circle', selector: 'portBody' },
      { tagName: 'text', selector: 'portLabel' },
      { tagName: 'title', selector: 'portTitle' },
    ]
    : [
      { tagName: 'line', selector: 'portStem' },
      { tagName: 'path', selector: 'portBody' },
      { tagName: 'text', selector: 'portLabel' },
      { tagName: 'title', selector: 'portTitle' },
    ]
}

function portAttrs(port: UmlLayoutPort): dia.Cell.Selectors {
  const provided = port.kind === 'provided-interface'
  return {
    portRoot: {
      class: `uml-joint-port uml-joint-port-${provided ? 'provided' : 'required'}`,
      role: 'button',
      tabIndex: 0,
      'aria-label': `${provided ? 'provided' : 'required'} interface: ${port.label}`,
      'data-semantic-id': port.id,
    },
    portStem: provided
      ? { class: 'uml-joint-port-stem', x1: 7, y1: 0, x2: 22, y2: 0 }
      : { class: 'uml-joint-port-stem', x1: -22, y1: 0, x2: -7, y2: 0 },
    portBody: provided
      ? {
        class: 'uml-joint-port-body',
        magnet: 'passive',
        cx: 0,
        cy: 0,
        r: 7,
      }
      : {
        class: 'uml-joint-port-body',
        magnet: 'passive',
        d: 'M 0 -9 A 9 9 0 0 0 0 9',
      },
    portLabel: {
      text: port.label,
      class: 'uml-joint-port-label',
      x: provided ? 26 : -26,
      y: -11,
      textAnchor: provided ? 'start' : 'end',
    },
    portTitle: {
      text: `${provided ? 'Provided' : 'Required'} interface: ${port.label}`,
    },
  }
}

function componentPorts(layout: UmlLayoutNode): dia.Element.Port[] {
  return layout.ports.map((port) => ({
    id: port.id,
    group: 'absolute',
    size: { width: 18, height: 18 },
    markup: portMarkup(port),
    position: {
      args: {
        x: port.x - layout.x,
        y: port.y - layout.y,
      },
    },
    attrs: portAttrs(port),
  }))
}

function simpleBox(
  node: DiagramProjectionNode,
  radius: number,
  extraMarkup: Markup = [],
  extraAttrs: dia.Cell.Selectors = {},
): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'shadow' },
      { tagName: 'rect', selector: 'body' },
      ...extraMarkup,
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      shadow: {
        class: 'uml-joint-shadow',
        x: 0,
        y: 3,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: radius,
      },
      body: {
        class: 'uml-joint-body',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: radius,
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 'calc(h / 2)',
        textWrap: { width: -34, height: -20, ellipsis: true },
      }),
      title: { text: `${node.label}\n${node.description}` },
      ...extraAttrs,
    },
  }
}

function actorDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'hit' },
      { tagName: 'circle', selector: 'head' },
      { tagName: 'path', selector: 'body' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      hit: {
        class: 'uml-joint-transparent-hit',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
      },
      head: {
        class: 'uml-joint-actor-stroke',
        cx: 'calc(w / 2)',
        cy: 22,
        r: 13,
      },
      body: {
        class: 'uml-joint-actor-stroke',
        d: 'M calc(w / 2) 35 V 72 M calc(w / 2 - 24) 49 H calc(w / 2 + 24) M calc(w / 2) 72 L calc(w / 2 - 21) 101 M calc(w / 2) 72 L calc(w / 2 + 21) 101',
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 124,
        textWrap: { width: -8, height: 48, ellipsis: true },
      }),
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function useCaseDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'ellipse', selector: 'shadow' },
      { tagName: 'ellipse', selector: 'body' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      shadow: {
        class: 'uml-joint-shadow',
        cx: 'calc(w / 2)',
        cy: 'calc(h / 2 + 3)',
        rx: 'calc(w / 2)',
        ry: 'calc(h / 2)',
      },
      body: {
        class: 'uml-joint-body',
        cx: 'calc(w / 2)',
        cy: 'calc(h / 2)',
        rx: 'calc(w / 2)',
        ry: 'calc(h / 2)',
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 'calc(h / 2)',
        textWrap: { width: -54, height: -26, ellipsis: true },
      }),
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function terminalDefinition(
  node: DiagramProjectionNode,
  final: boolean,
): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'circle', selector: 'hit' },
      ...(final ? [{ tagName: 'circle', selector: 'outer' } as const] : []),
      { tagName: 'circle', selector: 'inner' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      hit: {
        class: 'uml-joint-terminal-hit',
        cx: 13,
        cy: 13,
        r: 13,
      },
      ...(final ? {
        outer: {
          class: 'uml-joint-final-outer',
          cx: 13,
          cy: 13,
          r: 11,
        },
      } : {}),
      inner: {
        class: 'uml-joint-terminal-inner',
        cx: 13,
        cy: 13,
        r: final ? 6 : 9,
      },
      title: { text: node.label },
    },
  }
}

function decisionDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'path', selector: 'shadow' },
      { tagName: 'path', selector: 'body' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      shadow: {
        class: 'uml-joint-shadow',
        d: 'M calc(w / 2) 3 L calc(w) calc(h / 2 + 3) L calc(w / 2) calc(h + 3) L 0 calc(h / 2 + 3) Z',
      },
      body: {
        class: 'uml-joint-body',
        d: 'M calc(w / 2) 0 L calc(w) calc(h / 2) L calc(w / 2) calc(h) L 0 calc(h / 2) Z',
      },
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function forkJoinDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'hit' },
      { tagName: 'rect', selector: 'body' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      hit: {
        class: 'uml-joint-transparent-hit',
        x: -8,
        y: -8,
        width: 'calc(w + 16)',
        height: 'calc(h + 16)',
      },
      body: {
        class: 'uml-joint-fork-join-bar',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 2,
      },
      title: { text: `${node.kind === 'fork' ? 'Fork' : 'Join'}\n${node.description}` },
    },
  }
}

function swimlaneDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'header' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      body: {
        class: 'uml-joint-swimlane-body',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 7,
      },
      header: {
        class: 'uml-joint-swimlane-header',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 42,
        rx: 7,
      },
      label: {
        text: node.label,
        class: 'uml-joint-swimlane-label',
        x: 16,
        y: 25,
        textAnchor: 'start',
        textWrap: { width: -32, height: 28, ellipsis: true },
      },
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function operationDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return simpleBox(
    node,
    6,
    [
      { tagName: 'path', selector: 'operationMark' },
      { tagName: 'text', selector: 'stereotype' },
    ],
    {
      operationMark: {
        class: 'uml-joint-operation-mark',
        d: 'M 14 18 h 13 v 10 h -13 z M 10 22 h 13 v 10 h -13 z',
      },
      stereotype: {
        text: '«call»',
        class: 'uml-joint-stereotype',
        x: 'calc(w / 2)',
        y: 17,
        textAnchor: 'middle',
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 'calc(h / 2 + 10)',
        textWrap: { width: -44, height: -34, ellipsis: true },
      }),
    },
  )
}

function eventDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  const receiving = node.kind === 'receive-event'
  return simpleBox(
    node,
    6,
    [{ tagName: 'path', selector: 'eventMark' }],
    {
      eventMark: {
        class: 'uml-joint-event-mark',
        d: receiving
          ? 'M 8 8 H 34 L 27 18 L 34 28 H 8 Z'
          : 'M 8 8 H 34 V 28 H 8 L 15 18 Z',
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2 + 8)',
        y: 'calc(h / 2)',
        textWrap: { width: -54, height: -20, ellipsis: true },
      }),
    },
  )
}

function stateDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return simpleBox(
    node,
    12,
    [{ tagName: 'line', selector: 'divider' }],
    {
      divider: {
        class: 'uml-joint-state-divider',
        x1: 0,
        y1: 31,
        x2: 'calc(w)',
        y2: 31,
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 'calc(h / 2 + 12)',
        textWrap: { width: -34, height: -44, ellipsis: true },
      }),
    },
  )
}

function lifelineDefinition(
  node: DiagramProjectionNode,
  layout: UmlLayoutNode,
): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'line', selector: 'lifeline' },
      { tagName: 'rect', selector: 'headerShadow' },
      { tagName: 'rect', selector: 'header' },
      { tagName: 'text', selector: 'stereotype' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      lifeline: {
        class: 'uml-joint-lifeline-line',
        x1: 'calc(w / 2)',
        y1: 82,
        x2: 'calc(w / 2)',
        y2: layout.height - 18,
      },
      headerShadow: {
        class: 'uml-joint-shadow',
        x: 0,
        y: 3,
        width: 'calc(w)',
        height: 82,
        rx: 7,
      },
      header: {
        class: 'uml-joint-body',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 82,
        rx: 7,
      },
      stereotype: {
        text: `«${node.stereotype ?? 'participant'}»`,
        class: 'uml-joint-stereotype',
        x: 'calc(w / 2)',
        y: 20,
        textAnchor: 'middle',
      },
      label: textAttrs(node.label, {
        x: 'calc(w / 2)',
        y: 52,
        textWrap: { width: -20, height: 43, ellipsis: true },
      }),
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function boundaryDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'titlePlate' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      body: {
        class: 'uml-joint-system-boundary',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 4,
      },
      titlePlate: {
        class: 'uml-joint-boundary-title-plate',
        x: 14,
        y: 12,
        width: 'calc(w - 28)',
        height: 32,
        rx: 5,
      },
      label: {
        text: node.label,
        class: 'uml-joint-boundary-label',
        x: 28,
        y: 33,
        textAnchor: 'start',
        textWrap: { width: -56, height: 24, ellipsis: true },
      },
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function fragmentDefinition(node: DiagramProjectionNode): { markup: Markup; attrs: dia.Cell.Selectors } {
  return {
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'path', selector: 'tag' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: rootAttrs(node),
      body: {
        class: 'uml-joint-fragment',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
      },
      tag: {
        class: 'uml-joint-fragment-tag',
        d: 'M 0 0 H 74 V 22 L 62 34 H 0 Z',
      },
      label: {
        text: node.label,
        class: 'uml-joint-boundary-label',
        x: 10,
        y: 16,
        textAnchor: 'start',
      },
      title: { text: `${node.label}\n${node.description}` },
    },
  }
}

function nodeDefinition(
  node: DiagramProjectionNode,
  layout: UmlLayoutNode,
): { markup: Markup; attrs: dia.Cell.Selectors } {
  switch (node.kind) {
    case 'component':
      return { markup: componentMarkup(), attrs: componentAttrs(node) }
    case 'actor':
      return actorDefinition(node)
    case 'use-case':
      return useCaseDefinition(node)
    case 'initial':
      return terminalDefinition(node, false)
    case 'final':
      return terminalDefinition(node, true)
    case 'decision':
    case 'merge':
      return decisionDefinition(node)
    case 'fork':
    case 'join':
      return forkJoinDefinition(node)
    case 'swimlane':
      return swimlaneDefinition(node)
    case 'call-operation':
      return operationDefinition(node)
    case 'send-event':
    case 'receive-event':
      return eventDefinition(node)
    case 'state':
      return stateDefinition(node)
    case 'lifeline':
      return lifelineDefinition(node, layout)
    case 'system-boundary':
      return boundaryDefinition(node)
    case 'fragment':
      return fragmentDefinition(node)
    case 'activation':
      return simpleBox(node, 2)
    case 'action':
      return simpleBox(node, 16)
    default:
      return simpleBox(node, 9)
  }
}

function createNode(
  runtime: JointRuntime,
  node: DiagramProjectionNode,
  layout: UmlLayoutNode,
): dia.Element {
  const definition = nodeDefinition(node, layout)
  return new runtime.UmlNode({
    id: node.id,
    z: node.kind === 'system-boundary'
      ? 0
      : node.kind === 'swimlane' || node.kind === 'fragment' ? 1 : 3,
    position: { x: layout.x, y: layout.y },
    size: { width: layout.width, height: layout.height },
    markup: definition.markup,
    attrs: definition.attrs,
    ports: node.kind === 'component' ? {
      groups: {
        absolute: {
          position: { name: 'absolute' },
        },
      },
      items: componentPorts(layout),
    } : undefined,
    semanticId: node.id,
  })
}

function edgeStroke(edge: DiagramProjectionEdge): string {
  if (edge.outcome === 'failure') return 'var(--semantic-status-danger)'
  if (edge.outcome === 'recovery') return 'var(--semantic-status-info)'
  if (edge.outcome === 'alternate') return 'var(--semantic-status-warning)'
  return 'var(--semantic-text-secondary)'
}

function markerFor(edge: DiagramProjectionEdge): Record<string, unknown> {
  if (edge.kind === 'association' || edge.kind === 'assembly') {
    return { type: 'path', d: '' }
  }
  if (
    edge.kind === 'dependency'
    || edge.kind === 'reply-message'
    || edge.kind === 'include'
    || edge.kind === 'extend'
  ) {
    return {
      type: 'path',
      d: 'M 10 -5 0 0 10 5',
      fill: 'none',
      stroke: edgeStroke(edge),
      strokeWidth: 1.4,
    }
  }
  return {
    type: 'path',
    d: 'M 10 -5 0 0 10 5 Z',
    fill: edgeStroke(edge),
    stroke: edgeStroke(edge),
    strokeWidth: 1,
  }
}

function isDashed(edge: DiagramProjectionEdge): boolean {
  return edge.isLoop
    || edge.outcome === 'failure'
    || edge.outcome === 'recovery'
    || edge.kind === 'dependency'
    || edge.kind === 'reply-message'
    || edge.kind === 'include'
    || edge.kind === 'extend'
}

function createLink(
  runtime: JointRuntime,
  edge: DiagramProjectionEdge,
  layout: UmlLayoutEdge,
  nodesById: Map<string, DiagramProjectionNode>,
  layoutNodesById: Map<string, UmlLayoutNode>,
): dia.Link | undefined {
  if (layout.points.length < 2) return undefined
  const source = layout.points[0]!
  const target = layout.points.at(-1)!
  const vertices = layout.points.slice(1, -1)
  const sourceNode = nodesById.get(edge.fromId)
  const targetNode = nodesById.get(edge.toId)
  const sourceActorLayout = sourceNode?.kind === 'actor'
    ? layoutNodesById.get(sourceNode.id)
    : undefined
  const targetActorLayout = targetNode?.kind === 'actor'
    ? layoutNodesById.get(targetNode.id)
    : undefined
  const actorPoint = (
    actorLayout: UmlLayoutNode,
    routePoint: UmlPoint,
    adjacentPoint: UmlPoint,
  ): UmlPoint => {
    const centerX = actorLayout.x + actorLayout.width / 2
    const side = adjacentPoint.x >= centerX ? 1 : -1
    const relativeY = Math.max(9, Math.min(101, routePoint.y - actorLayout.y))
    let outlineOffset = 0
    if (relativeY <= 35) {
      const circleY = relativeY - 22
      outlineOffset = Math.sqrt(Math.max(0, 13 ** 2 - circleY ** 2))
    } else if (relativeY >= 42 && relativeY <= 56) {
      outlineOffset = 24
    } else if (relativeY > 72) {
      outlineOffset = ((relativeY - 72) / 29) * 21
    }
    return {
      x: centerX + side * outlineOffset,
      y: actorLayout.y + relativeY,
    }
  }
  const sourceEndpoint = sourceActorLayout
    ? actorPoint(sourceActorLayout, source, layout.points[1]!)
    : sourceNode?.parentId && (
    sourceNode.kind === 'provided-interface'
    || sourceNode.kind === 'required-interface'
    || sourceNode.kind === 'port'
  ) ? { id: sourceNode.parentId, port: sourceNode.id } : source
  const targetEndpoint = targetActorLayout
    ? actorPoint(targetActorLayout, target, layout.points.at(-2)!)
    : targetNode?.parentId && (
    targetNode.kind === 'provided-interface'
    || targetNode.kind === 'required-interface'
    || targetNode.kind === 'port'
  ) ? { id: targetNode.parentId, port: targetNode.id } : target
  return new runtime.joint.shapes.standard.Link({
    id: edge.id,
    z: 2,
    source: sourceEndpoint,
    target: targetEndpoint,
    vertices,
    connector: edge.kind === 'association'
      ? { name: 'jumpover', args: { jump: 'arc', size: 7, radius: 5 } }
      : { name: 'straight', args: { cornerType: 'cubic', cornerRadius: 7 } },
    attrs: {
      root: {
        class: [
          'uml-joint-link',
          `uml-joint-${edge.kind}`,
          edge.outcome ? `uml-joint-outcome-${edge.outcome}` : '',
          edge.isLoop ? 'uml-joint-loop' : '',
        ].filter(Boolean).join(' '),
        role: 'button',
        tabIndex: 0,
        'aria-label': `${edge.kind}${edge.label ? `: ${edge.label}` : ''}`,
        'data-semantic-id': edge.id,
      },
      wrapper: {
        cursor: 'pointer',
        stroke: 'transparent',
        strokeWidth: 15,
      },
      line: {
        class: 'uml-joint-link-line',
        fill: 'none',
        stroke: edgeStroke(edge),
        strokeWidth: 1.6,
        strokeDasharray: isDashed(edge) ? '7 5' : 'none',
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
        targetMarker: markerFor(edge),
      },
    },
    semanticId: edge.id,
  })
}

function createEdgeLabel(
  runtime: JointRuntime,
  edge: DiagramProjectionEdge,
  layout: UmlLayoutEdge,
): dia.Element | undefined {
  const displayLabel = edgeDisplayLabel(edge)
  if (!displayLabel || !layout.label) return undefined
  const label = layout.label
  return new runtime.UmlEdgeLabel({
    id: `${edge.id}:label`,
    z: 4,
    position: { x: label.x, y: label.y },
    size: { width: label.width, height: label.height },
    markup: [
      { tagName: 'rect', selector: 'shadow' },
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'title', selector: 'title' },
    ],
    attrs: {
      root: {
        class: [
          'uml-joint-edge-label',
          `uml-joint-${edge.kind}-label`,
          edge.outcome ? `uml-joint-outcome-${edge.outcome}-label` : '',
          edge.isLoop ? 'uml-joint-loop-label' : '',
        ].filter(Boolean).join(' '),
        role: 'button',
        tabIndex: 0,
        'aria-label': `${edge.kind}: ${displayLabel.replaceAll('\n', ', ')}`,
        'data-semantic-id': edge.id,
      },
      shadow: {
        class: 'uml-joint-edge-label-shadow',
        x: 0,
        y: 2,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 5,
      },
      body: {
        class: 'uml-joint-edge-label-body',
        x: 0,
        y: 0,
        width: 'calc(w)',
        height: 'calc(h)',
        rx: 5,
      },
      label: {
        text: displayLabel,
        class: 'uml-joint-edge-label-text',
        fontSize: 10,
        fontFamily: 'var(--semantic-typography-family-mono)',
        x: 'calc(w / 2)',
        y: 'calc(h / 2)',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        textWrap: { width: -14, height: -2, ellipsis: true },
      },
      title: { text: `${displayLabel}\n${edge.description}` },
    },
    semanticId: edge.id,
    semanticRole: 'edge-label',
  })
}

function semanticId(cell: dia.Cell): string {
  return String(cell.get('semanticId') ?? '')
}

function selectedPortElement(paper: dia.Paper, selectionId: string): Element | undefined {
  for (const port of paper.svg.querySelectorAll('[port]')) {
    if (port.getAttribute('port') === selectionId) return port
  }
  return undefined
}

function applySelection(paper: dia.Paper, graph: dia.Graph, selectionId: string): void {
  for (const selected of paper.svg.querySelectorAll('.selected')) selected.classList.remove('selected')
  if (!selectionId) return

  const port = selectedPortElement(paper, selectionId)
  if (port) {
    port.classList.add('selected')
    const parent = port.closest('.joint-cell')
    parent?.classList.add('selected')
    return
  }

  for (const cell of graph.getCells()) {
    if (semanticId(cell) !== selectionId) continue
    paper.findViewByModel(cell)?.el.classList.add('selected')
  }
}

function keyboardSemanticId(target: EventTarget | null): string {
  if (!(target instanceof Element)) return ''
  const semantic = target.closest('[data-semantic-id]')
  return semantic?.getAttribute('data-semantic-id') ?? ''
}

export function JointUmlCanvas({
  diagram,
  layout,
  selectionId,
  zoom,
  onSelect,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<dia.Graph | undefined>(undefined)
  const paperRef = useRef<dia.Paper | undefined>(undefined)
  const onSelectRef = useRef(onSelect)
  const selectionRef = useRef(selectionId)
  const zoomRef = useRef(zoom)

  onSelectRef.current = onSelect
  selectionRef.current = selectionId
  zoomRef.current = zoom

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const selected = keyboardSemanticId(event.target)
      if (!selected) return
      event.preventDefault()
      onSelectRef.current(selected)
    }
    mount.addEventListener('keydown', handleKeyDown)
    let disposed = false
    let disposePaper: (() => void) | undefined

    void loadJointRuntime().then((runtime) => {
      if (disposed) return
      mount.replaceChildren()
      mount.classList.remove('uml-joint-stage-error')
      const paperHost = document.createElement('div')
      mount.append(paperHost)
      const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
      const layoutNodesById = new Map(layout.nodes.map((node) => [node.id, node]))
      const layoutEdgesById = new Map(layout.edges.map((edge) => [edge.id, edge]))
      const graph = new runtime.joint.dia.Graph({}, { cellNamespace: runtime.cellNamespace })
      const initialZoom = zoomRef.current
      const paper = new runtime.joint.dia.Paper({
        el: paperHost,
        model: graph,
        cellViewNamespace: runtime.cellNamespace,
        width: layout.width * initialZoom,
        height: layout.height * initialZoom,
        gridSize: 1,
        drawGrid: false,
        background: { color: 'transparent' },
        interactive: false,
        async: false,
        sorting: runtime.joint.dia.Paper.sorting.EXACT,
        defaultConnectionPoint: { name: 'boundary' },
      })
      graphRef.current = graph
      paperRef.current = paper
      paper.el.classList.add('uml-joint-paper')
      paper.svg.setAttribute('aria-hidden', 'true')

      const cells: dia.Cell[] = []
      for (const layoutNode of layout.nodes) {
        const node = nodesById.get(layoutNode.id)
        if (node) cells.push(createNode(runtime, node, layoutNode))
      }
      for (const edge of diagram.edges) {
        const edgeLayout = layoutEdgesById.get(edge.id)
        if (!edgeLayout) continue
        const link = createLink(runtime, edge, edgeLayout, nodesById, layoutNodesById)
        if (link) cells.push(link)
        const label = createEdgeLabel(runtime, edge, edgeLayout)
        if (label) cells.push(label)
      }
      graph.resetCells(cells)
      paper.scale(initialZoom, initialZoom)

      paper.on('element:pointerclick', (view: dia.ElementView, event: Event) => {
        const selected = keyboardSemanticId(event.target) || semanticId(view.model)
        if (selected) onSelectRef.current(selected)
      })
      paper.on('link:pointerclick', (view: dia.LinkView) => {
        const selected = semanticId(view.model)
        if (selected) onSelectRef.current(selected)
      })
      paper.on('blank:pointerclick', () => onSelectRef.current(''))
      applySelection(paper, graph, selectionRef.current)

      disposePaper = () => {
        paper.remove()
        if (paperRef.current === paper) paperRef.current = undefined
        if (graphRef.current === graph) graphRef.current = undefined
      }
    }).catch((error: unknown) => {
      if (!disposed) {
        mount.textContent = error instanceof Error ? error.message : String(error)
        mount.classList.add('uml-joint-stage-error')
      }
    })

    return () => {
      disposed = true
      mount.removeEventListener('keydown', handleKeyDown)
      disposePaper?.()
    }
  }, [diagram, layout])

  useEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    paper.scale(zoom, zoom)
    paper.setDimensions(layout.width * zoom, layout.height * zoom)
  }, [layout.height, layout.width, zoom])

  useEffect(() => {
    const paper = paperRef.current
    const graph = graphRef.current
    if (paper && graph) applySelection(paper, graph, selectionId)
  }, [selectionId])

  return (
    <div
      ref={mountRef}
      className="uml-joint-stage"
      style={{ width: layout.width * zoom, height: layout.height * zoom }}
    />
  )
}
