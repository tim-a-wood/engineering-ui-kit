/// <reference lib="webworker" />

import type { DiagramProjection } from '@engineering-ui-kit/core'
import { layoutUmlDiagram } from './umlDiagramLayout'

type LayoutRequest = { id: string; diagram: DiagramProjection }

self.addEventListener('message', (event: MessageEvent<LayoutRequest>) => {
  void layoutUmlDiagram(event.data.diagram)
    .then((layout) => self.postMessage({ id: event.data.id, layout }))
    .catch((error: unknown) => self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : String(error),
    }))
})

