import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

test("V2 serves the village prototype and static assets", async (t) => {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base+"/");
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/İlker'in Yurdu/);
  assert.match(html,/\/assets\/seljuk-city-map\.svg/);
  const script=await fetch(base+"/app.js");
  assert.equal(script.status,200);
  assert.match(await script.text(),/Merkez Binası/);
  const asset=await fetch(base+"/assets/seljuk-city-map.svg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/svg\+xml/);
  assert.match(await asset.text(),/<svg[\s>]/);
});
