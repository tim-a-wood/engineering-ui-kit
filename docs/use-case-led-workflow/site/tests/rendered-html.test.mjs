import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("../../", import.meta.url);

async function readText(url) {
  return readFile(url, "utf8");
}

test("publishes the current source artifacts", async () => {
  const pairs = [
    ["index.html", "public/briefing.html"],
    ["mockup.html", "public/mockup.html"],
    ["PROPOSAL.md", "public/PROPOSAL.md"],
  ];

  for (const [sourceName, publicName] of pairs) {
    const [source, published] = await Promise.all([
      readFile(new URL(sourceName, sourceRoot)),
      readFile(new URL(publicName, siteRoot)),
    ]);
    assert.deepEqual(published, source, `${publicName} is not current`);
  }
});

test("uses direct task labels in the briefing and mockup", async () => {
  const [briefing, mockup, proposal, layout] = await Promise.all([
    readText(new URL("public/briefing.html", siteRoot)),
    readText(new URL("public/mockup.html", siteRoot)),
    readText(new URL("public/PROPOSAL.md", siteRoot)),
    readText(new URL("app/layout.tsx", siteRoot)),
  ]);

  assert.match(briefing, /Describe the work\./);
  assert.match(briefing, /Review the system design\./);
  assert.match(mockup, /Create use-case draft/);
  assert.match(mockup, /Define the system/);
  assert.match(mockup, /Review the use-case draft/);
  assert.match(mockup, /Architecture diagram/);
  assert.match(mockup, /Relationship canvas/);
  assert.match(mockup, /class="relationship-canvas"/);
  assert.match(mockup, /<canvas class="relationship-lines"/);
  assert.match(mockup, /Focused relationships/);
  assert.match(mockup, /data-relationship-mode="focus"/);
  assert.match(mockup, /data-relationship-mode="all"/);
  assert.match(mockup, /Deployment/);
  assert.match(mockup, /Ports and adapters/);
  assert.match(mockup, /data-diagram-mode="logical"/);
  assert.match(mockup, /data-module="\$\{moduleId\}"/);
  assert.match(mockup, /const moduleRelationshipEdges/);
  assert.match(mockup, /function drawArchitectureConnections\(/);
  assert.match(mockup, /canvas\.dataset\.nodeCollisionCount/);
  assert.match(mockup, /function moduleInspector\(\)/);
  assert.match(mockup, /id="node-detail-modal"/);
  assert.match(mockup, /role="dialog"/);
  assert.match(mockup, /function openNodeDetailModal\(/);
  assert.match(mockup, /classList\.contains\('diagram-node'\)/);
  assert.match(mockup, /5 · Verify evidence/);
  assert.match(mockup, /function verificationView\(/);
  assert.match(mockup, /data-scenario="\$\{item\.id\}"/);
  assert.match(mockup, /Screenshot evidence/);
  assert.match(mockup, /Structured evidence/);
  assert.match(mockup, /id="detail-diagram-modal"/);
  assert.match(mockup, /Open UML diagrams/);
  assert.match(mockup, /UML 2\.5\.1 notation subset/);
  assert.match(mockup, /Design step only/);
  assert.match(mockup, /function componentDetailDiagram\(/);
  assert.match(mockup, /function activityDetailDiagram\(/);
  assert.match(mockup, /function stateDetailDiagram\(/);
  assert.match(mockup, /function sequenceDetailDiagram\(/);
  assert.match(mockup, /function useCaseDetailDiagram\(/);
  assert.match(mockup, /function drawUmlStage\(/);
  assert.match(mockup, /class="uml-stage-canvas"/);
  assert.match(mockup, /class="uml-fragment"/);
  assert.match(mockup, /uml-activation-node/);
  assert.match(mockup, /uml-partition/);
  assert.match(mockup, /refreshEvidence\(\)/);
  assert.match(mockup, /trigger \[guard\] \/ effect/);
  assert.match(mockup, /orthogonal routing/);
  assert.match(mockup, /data-uml-element=/);
  assert.match(mockup, /id="uml-element-modal"/);
  assert.match(mockup, /Discuss with agent/);
  assert.match(mockup, /Propose change/);
  assert.match(mockup, /Analyze impact/);
  assert.match(mockup, /Approve and assign to agent/);
  assert.match(mockup, /Required agent changes/);
  assert.match(mockup, /<b>Requirements<\/b>/);
  assert.match(mockup, /closeNodeDetailModal\(\{restoreFocus:false\}\)/);
  assert.doesNotMatch(mockup, /id="scenario-diagrams"/);
  assert.match(briefing, /AUTOMATED SCENARIOS/);
  assert.match(briefing, /Scenario evidence/);
  assert.match(briefing, /Inspect UML in Design/);
  assert.match(briefing, /impact analysis/i);
  assert.match(proposal, /^# Plan from use cases/m);
  assert.match(proposal, /## 10\. DO-178C Audit Hub example/);
  assert.match(proposal, /### 7\.3 Verify checks/);
  assert.match(proposal, /### 13\.2 Generated use-case scenario tests/);
  assert.match(proposal, /capture a screenshot when the result is visible/);
  assert.match(proposal, /### 4\.6 UML diagrams in Design/);
  assert.match(proposal, /### 4\.7 UML 2\.5\.1 notation rules/);
  assert.match(proposal, /### 4\.8 Discuss and change a visual element/);
  assert.match(proposal, /Verify does not contain design\s+diagrams/);
  assert.match(layout, /const title = "Plan from use cases"/);

  const obsoletePhrases = [
    "manufacture structure",
    "Shape the product",
    "Shape the solution",
    "Product promise",
    "Material uncertainty",
    "Solution map",
  ];

  for (const phrase of obsoletePhrases) {
    assert.doesNotMatch(briefing, new RegExp(phrase, "i"));
    assert.doesNotMatch(mockup, new RegExp(phrase, "i"));
  }
});

test("keeps mobile links relative and openable", async () => {
  const briefing = await readText(new URL("public/briefing.html", siteRoot));

  assert.match(briefing, /href="\.\/mockup\.html"/);
  assert.match(briefing, /href="\.\/PROPOSAL\.md"/);
  assert.match(
    briefing,
    /<meta name="viewport" content="width=device-width, initial-scale=1">/,
  );
});

test("publishes the social preview at its declared size", async () => {
  const image = await readFile(new URL("public/og.png", siteRoot));

  assert.equal(image.toString("ascii", 1, 4), "PNG");
  assert.equal(image.readUInt32BE(16), 1729);
  assert.equal(image.readUInt32BE(20), 910);
});
