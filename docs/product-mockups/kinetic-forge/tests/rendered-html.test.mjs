import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Kinetic Forge gameplay shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Kinetic Forge · Foundry Delivery<\/title>/i);
  assert.match(html, /aria-label="Foundry Delivery gameplay scene"/);
  assert.match(html, /aria-label="Kinetic Forge home"/);
  assert.match(html, /FOUNDry Delivery/i);
  assert.match(html, /ENGAGE DRIVE/);
  assert.match(html, /background-image:url\(\.\/foundry-background-v2\.png\)/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("binds the authored hauler and cleared foundry presentation", async () => {
  const [scene, css, page, layout] = await Promise.all([
    readFile(new URL("../app/FoundryScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/foundry-background-v2.png", import.meta.url)),
    access(new URL("../public/hauler-sprite-v2.png", import.meta.url)),
  ]);

  assert.match(scene, /from "three"/);
  assert.match(scene, /hauler-sprite-v2\.png/);
  assert.match(scene, /WHEEL_CENTER_Y = 1\.1/);
  assert.match(scene, /const laneX = portrait/);
  assert.match(scene, /RUN_DISTANCE = 14\.7/);
  assert.match(css, /background-size:\s*cover/);
  assert.match(css, /background-position:\s*61% center/);
  assert.match(page, /Foundry Delivery/);
  assert.match(page, /ENGAGE DRIVE/);
  assert.match(layout, /Kinetic Forge · Foundry Delivery/);
});
