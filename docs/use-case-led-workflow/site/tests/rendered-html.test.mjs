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
  assert.match(proposal, /^# Plan from use cases/m);
  assert.match(proposal, /## 10\. DO-178C Audit Hub example/);
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
