import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = join(siteRoot, "..");
const publicRoot = join(siteRoot, "public");

await mkdir(publicRoot, { recursive: true });

for (const [source, destination] of [
  ["index.html", "briefing.html"],
  ["mockup.html", "mockup.html"],
  ["PROPOSAL.md", "PROPOSAL.md"],
]) {
  await copyFile(join(artifactRoot, source), join(publicRoot, destination));
}
