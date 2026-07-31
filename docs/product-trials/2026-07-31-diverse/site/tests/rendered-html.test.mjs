import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);

test("publishes both mobile galleries and their evidence", async () => {
  for (const page of ["GALLERY.html", "UML-GALLERY.html"]) {
    const pageUrl = new URL(`public/${page}`, siteRoot);
    const html = await readFile(pageUrl, "utf8");

    assert.match(
      html,
      /<meta name="viewport" content="width=device-width,initial-scale=1"/,
    );

    for (const match of html.matchAll(/(?:href|src)="(\.\/evidence\/[^"]+)"/g)) {
      await access(new URL(match[1], pageUrl));
    }
  }
});

test("keeps gallery navigation local", async () => {
  const [products, diagrams] = await Promise.all([
    readFile(new URL("public/GALLERY.html", siteRoot), "utf8"),
    readFile(new URL("public/UML-GALLERY.html", siteRoot), "utf8"),
  ]);

  assert.match(products, /href="\.\/UML-GALLERY\.html"/);
  assert.match(diagrams, /href="\.\/GALLERY\.html"/);
});
