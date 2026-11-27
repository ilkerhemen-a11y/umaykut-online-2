import test from "node:test";
import assert from "node:assert/strict";
import { applyVillageFactionArt, getVillageFactionArt } from "../public/village-art.js";

test("selected faction receives its matching village illustration", () => {
  const expected = {
    gokturk: "/assets/IMG-20261117-WA0073.jpg",
    hun: "/assets/IMG-20261117-WA7162.jpg",
    seljuk: "/assets/IMG-20261117-WA0581.jpg"
  };
  for (const [faction, src] of Object.entries(expected)) {
    const image = {
      attributes: {},
      dataset: {},
      setAttribute(name, value) { this.attributes[name] = value; }
    };
    assert.equal(applyVillageFactionArt(image, faction), true);
    assert.equal(image.attributes.src, src);
    assert.equal(image.dataset.faction, faction);
    assert.match(image.attributes.alt, /köy görünümü/i);
  }
});

test("unknown faction safely falls back to the Göktürk illustration", () => {
  const image = {
    attributes: {},
    dataset: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  assert.equal(applyVillageFactionArt(image, "unknown"), true);
  assert.equal(image.attributes.src, getVillageFactionArt("gokturk").src);
  assert.equal(image.dataset.faction, "gokturk");
});

test("missing image element is ignored safely", () => {
  assert.equal(applyVillageFactionArt(null, "seljuk"), false);
});
