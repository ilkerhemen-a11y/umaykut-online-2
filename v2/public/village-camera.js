export const VILLAGE_ZOOM_MIN=1;
export const VILLAGE_ZOOM_MAX=2.2;
export function clampVillageZoom(value){
 const numeric=Number(value);
 if(!Number.isFinite(numeric))return VILLAGE_ZOOM_MIN;
 return Math.min(VILLAGE_ZOOM_MAX,Math.max(VILLAGE_ZOOM_MIN,numeric));
}
export function clampVillagePan(offset,viewportSize,zoom,contentSize=viewportSize){
 const viewport=Math.max(0,Number(viewportSize)||0),content=Math.max(0,Number(contentSize)||0),scale=clampVillageZoom(zoom);
 const limit=Math.max(0,(content*scale-viewport)/2),value=Number(offset)||0;
 return Math.max(-limit,Math.min(limit,value));
}
export function calculateVillagePan({startPanX=0,startPanY=0,deltaX=0,deltaY=0,viewportWidth=0,viewportHeight=0,contentWidth=viewportWidth,contentHeight=viewportHeight,zoom=1}){
 const scale=clampVillageZoom(zoom);
 return {
  panX:clampVillagePan(Number(startPanX)+Number(deltaX),viewportWidth,scale,contentWidth),
  panY:clampVillagePan(Number(startPanY)+Number(deltaY),viewportHeight,scale,contentHeight)
 };
}
export function calculateVillagePinch({startZoom=1,startPanX=0,startPanY=0,startDistance=1,currentDistance=1,startCenterX=0,startCenterY=0,currentCenterX=0,currentCenterY=0,viewportWidth=0,viewportHeight=0,contentWidth=viewportWidth,contentHeight=viewportHeight}){
 const originalZoom=clampVillageZoom(startZoom),distance=Math.max(1,Number(startDistance)||1);
 const nextZoom=clampVillageZoom(originalZoom*(Math.max(1,Number(currentDistance)||distance)/distance));
 const worldX=(Number(startCenterX)-Number(viewportWidth)/2-Number(startPanX))/originalZoom;
 const worldY=(Number(startCenterY)-Number(viewportHeight)/2-Number(startPanY))/originalZoom;
 return {
  zoom:nextZoom,
  panX:clampVillagePan(Number(currentCenterX)-Number(viewportWidth)/2-worldX*nextZoom,viewportWidth,nextZoom,contentWidth),
  panY:clampVillagePan(Number(currentCenterY)-Number(viewportHeight)/2-worldY*nextZoom,viewportHeight,nextZoom,contentHeight)
 };
}
