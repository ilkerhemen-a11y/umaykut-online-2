import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

test("V2 serves the uploaded village image without numbered overlays", async (t) => {
  const server=createServer({ pool: null });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;

  const page=await fetch(base+"/");
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/İlker'in Yurdu/);
  assert.match(html,/\/assets\/IMG-20261117-WA0073\.jpg/);
  assert.doesNotMatch(html,/building-points|building-point|map-hint/);

  const script=await fetch(base+"/app.js");
  assert.equal(script.status,200);
  assert.match(await script.text(),/data-faction-choice/);

  const asset=await fetch(base+"/assets/IMG-20261117-WA0073.jpg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/jpeg/);
  assert.ok(Number(asset.headers.get("content-length")) > 1_000_000);
  const bytes=new Uint8Array(await asset.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,3)),[0xff,0xd8,0xff]);
});
