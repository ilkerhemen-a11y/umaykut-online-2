import test from "node:test";
import assert from "node:assert/strict";
import {VILLAGE_ZOOM_MAX,clampVillageZoom,clampVillagePan,calculateVillagePan,calculateVillagePinch} from "../public/village-camera.js";

test("village zoom is clamped to the supported range",()=>{
 assert.equal(clampVillageZoom(0.5),1);
 assert.equal(clampVillageZoom(1.75),1.75);
 assert.equal(clampVillageZoom(9),VILLAGE_ZOOM_MAX);
 assert.equal(clampVillageZoom(Number.NaN),1);
});
test("pan limits use the actual fitted artwork size",()=>{
 assert.equal(clampVillagePan(500,400,2,300),100);
 assert.equal(clampVillagePan(-500,400,2,300),-100);
 assert.equal(clampVillagePan(80,400,1,300),0);
});
test("drag pan remains inside the scaled artwork",()=>{
 const result=calculateVillagePan({startPanX:20,startPanY:-10,deltaX:500,deltaY:-500,viewportWidth:400,viewportHeight:300,contentWidth:400,contentHeight:300,zoom:2});
 assert.deepEqual(result,{panX:200,panY:-150});
});
test("pinch zoom keeps the selected point under the moving midpoint",()=>{
 const result=calculateVillagePinch({
  startZoom:1,startPanX:0,startPanY:0,startDistance:100,currentDistance:200,
  startCenterX:100,startCenterY:100,currentCenterX:120,currentCenterY:110,
  viewportWidth:400,viewportHeight:300,contentWidth:400,contentHeight:300
 });
 assert.equal(result.zoom,2);
 const worldX=(100-200)/1,worldY=(100-150)/1;
 assert.equal(worldX*result.zoom+result.panX+200,120);
 assert.equal(worldY*result.zoom+result.panY+150,110);
});
test("pinch zoom respects the maximum without losing the center anchor",()=>{
 const result=calculateVillagePinch({
  startZoom:2,startPanX:0,startPanY:0,startDistance:100,currentDistance:300,
  startCenterX:200,startCenterY:150,currentCenterX:200,currentCenterY:150,
  viewportWidth:400,viewportHeight:300,contentWidth:400,contentHeight:300
 });
 assert.equal(result.zoom,VILLAGE_ZOOM_MAX);
 assert.equal(result.panX,0);
 assert.equal(result.panY,0);
});
