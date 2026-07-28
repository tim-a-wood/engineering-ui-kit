# Capabilities schemas

Version 1 JSON Schema family for capability records.

Behavior records use three separate authorities:

- `application-workflow.schema.json` defines observable application behavior.
- `architecture-specification.schema.json` allocates workflow nodes to modules.
- `module-design-specification.schema.json` defines internal module behavior.
- `capability-workspace-index.schema.json` defines the record index and the
  behavior-model migration version.

All activity records reuse `activity-graph.schema.json`. Stored diagram
coordinates are not behavior data.
