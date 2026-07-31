import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = join(siteRoot, "..");
const repositoryRoot = join(siteRoot, "..", "..", "..");
const publicRoot = join(siteRoot, "public");
const trialRoot = join(
  repositoryRoot,
  "docs",
  "product-trials",
  "2026-07-31-diverse",
);
const publicTrialRoot = join(publicRoot, "trials");

await mkdir(publicRoot, { recursive: true });

for (const [source, destination] of [
  ["index.html", "briefing.html"],
  ["mockup.html", "mockup.html"],
  ["PROPOSAL.md", "PROPOSAL.md"],
  ["SPECIFICATION.md", "SPECIFICATION.md"],
]) {
  await copyFile(join(artifactRoot, source), join(publicRoot, destination));
}

await mkdir(publicTrialRoot, { recursive: true });

const trialPages = ["GALLERY.html", "UML-GALLERY.html"];
const trialAssets = new Set();

for (const page of trialPages) {
  const pageSource = join(trialRoot, page);
  const html = await readFile(pageSource, "utf8");

  await copyFile(pageSource, join(publicTrialRoot, page));

  for (const match of html.matchAll(/(?:href|src)="(\.\/evidence\/[^"]+)"/g)) {
    trialAssets.add(match[1].slice(2));
  }
}

await copyFile(
  join(trialRoot, "GALLERY.html"),
  join(publicTrialRoot, "index.html"),
);

for (const relativePath of trialAssets) {
  const destination = join(publicTrialRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(trialRoot, relativePath), destination);
}
