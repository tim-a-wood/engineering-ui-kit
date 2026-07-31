# UML stress matrix

## Purpose

This matrix tests the production UML layout system with different graph shapes.
The fixtures contain semantic nodes and relationships only. They do not contain
coordinates, bend points, layout options, or fixture-specific routing rules.

Each fixture passes through `layoutUmlDiagram` and `UmlDiagramWorkspace`. The
test runs each layout two times and checks that the result is deterministic.

## New stress fixtures

| Context | UML type | Shape | Symbols | Connectors | Crossings | Bends | Canvas |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Satellite command | Component | Long chain with return paths | 12 | 15 | 0 | 22 | 920 × 2194 |
| Identity brokerage | Component | Asymmetric boundary with 12 interfaces | 25 | 12 | 0 | 20 | 1147 × 966 |
| Analytics processing | Component | Wide split and merge graph | 14 | 19 | 0 | 30 | 2690 × 693 |
| Emergency response | Activity | Five-way fan-out and fan-in with loops | 17 | 23 | 0 | 34 | 2300 × 1072 |
| Batch processing | Activity | Deep linear behavior chain | 18 | 17 | 0 | 0 | 920 × 2302 |
| Device connectivity | State machine | Cyclic lifecycle with recovery paths | 14 | 21 | 0 | 30 | 977 × 1574 |
| Incident coordination | Sequence | Ten lifelines, 26 messages, and one fragment | 11 | 26 | 0 | 2 | 1926 × 1796 |
| Hospital access | Use case | Seven actors and 14 linked use cases | 22 | 26 | 4 | 56 | 1869 × 1380 |

All eight layouts have zero node overlaps, zero shared connector trunks, zero
node-clearance defects, zero label overlaps, zero port-alignment defects, and
zero canvas-bound defects.

## Result

Seven of the eight new fixtures meet the preferred target of one crossing or
fewer. The hospital access fixture does not meet the target. It keeps four
crossings after the bounded production candidate search.

The fixture remains in the matrix. The test records a follow-up item for the
preferred crossing target. It does not remove relationships, add coordinates,
or run an expensive exhaustive search to make the result appear better.

## System changes found by the matrix

- A failed ELK strategy no longer stops all candidate layouts. The system keeps
  the successful candidates and selects the best valid result.
- State machines now compare node placement, layering, and cycle-breaking
  strategies. The device lifecycle improved from five crossings to zero.
- Candidate selection now uses the final rendered geometry. It checks nodes,
  labels, ports, connector crossings, bends, route length, and canvas area.
- Large use-case diagrams now compare contiguous, alternating, and interleaved
  actor partitions. The search stays bounded for interactive use.
