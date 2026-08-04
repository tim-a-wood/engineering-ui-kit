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
  assert.match(html, /data-renderer="threejs-real-geometry"/);
  assert.doesNotMatch(html, /foundry-background-v2|hauler-sprite-v2/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("binds a genuine GLB hauler and collision-clear live foundry", async () => {
  const [scene, css, page, layout] = await Promise.all([
    readFile(new URL("../app/FoundryScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/models/perseverance-rover.glb", import.meta.url)),
    access(new URL("../public/draco/draco_decoder.wasm", import.meta.url)),
  ]);

  assert.match(scene, /from "three"/);
  assert.match(scene, /GLTFLoader/);
  assert.match(scene, /DRACOLoader/);
  assert.match(scene, /perseverance-rover\.glb/);
  assert.match(scene, /WHEEL_CENTER_Y = 1\.19/);
  assert.match(scene, /RAIL_X - VEHICLE_HALF_WIDTH/);
  assert.match(scene, /gantrySupportStations\.some/);
  assert.match(scene, /Gantry support entered the drive corridor/);
  assert.match(scene, /wheel\.rotation\.x = wheelTurn/);
  assert.doesNotMatch(scene, /THREE\.Sprite|backgroundImage|hauler-sprite|foundry-background/);
  assert.match(css, /\.scene-canvas canvas/);
  assert.match(page, /Foundry Delivery/);
  assert.match(page, /ENGAGE DRIVE/);
  assert.match(page, /NASA\/JPL MECHANICAL DONOR/);
  assert.match(layout, /Kinetic Forge · Foundry Delivery/);
});
