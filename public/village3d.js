import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const canvas=document.getElementById("village3dCanvas");
if(canvas){
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0xb8d3e8);
 scene.fog=new THREE.Fog(0xb8d3e8,28,58);
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);
 camera.position.set(13,17,22);camera.lookAt(0,1.4,0);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 scene.add(new THREE.HemisphereLight(0xe8f3d2,0x6b5636,2.0));
 const sun=new THREE.DirectionalLight(0xffe0a0,3.1);sun.position.set(-9,16,10);sun.castShadow=true;
 sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;scene.add(sun);
 const mat=(color,roughness=.88,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 function makeSurfaceTexture(kind){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d");
  const p=kind==="stone"?["#b8a27e","#cbb58e","#9e8968"]:kind==="roof"?["#7b4130","#9b5740","#67372d"]:kind==="wood"?["#4a2d19","#684326","#805a35"]:["#718b45","#829b50","#627d3b"];
  ctx.fillStyle=p[0];ctx.fillRect(0,0,256,256);
  if(kind==="stone"){for(let y=0;y<256;y+=32){const o=(Math.floor(y/32)%2)*22;for(let x=-30;x<286;x+=54){ctx.fillStyle=p[(Math.floor(x/54)+Math.floor(y/32)+1)%p.length];ctx.fillRect(x+o+2,y+2,50,27);ctx.strokeStyle="#5f503b";ctx.lineWidth=2;ctx.strokeRect(x+o+2,y+2,50,27);}}}
  else if(kind==="roof"){for(let y=0;y<256;y+=22)for(let x=-18;x<280;x+=32){const xx=x+(Math.floor(y/22)%2)*16;ctx.fillStyle=p[(Math.floor(x/32)+Math.floor(y/22))%p.length];ctx.beginPath();ctx.roundRect(xx+2,y+2,27,18,5);ctx.fill();ctx.strokeStyle="#4a2a24";ctx.lineWidth=1.5;ctx.stroke();}}
  else if(kind==="wood"){for(let i=0;i<90;i++){ctx.strokeStyle=i%3?"#2d1b12":"#b18a52";ctx.globalAlpha=.12+(i%4)*.04;ctx.lineWidth=1+(i%3);ctx.beginPath();const y=i*3;ctx.moveTo(0,y);ctx.bezierCurveTo(70,y-7,150,y+8,256,y-2);ctx.stroke();}ctx.globalAlpha=1;}
  else{for(let i=0;i<1800;i++){ctx.fillStyle=i%2?"#d5e29b":"#354f2b";ctx.globalAlpha=.12;ctx.fillRect((i*73)%256,(i*137)%256,2,2);}ctx.globalAlpha=1;}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);return t;
 }
 const stoneTexture=makeSurfaceTexture("stone"),roofTexture=makeSurfaceTexture("roof"),woodTexture=makeSurfaceTexture("wood"),grassTexture=makeSurfaceTexture("grass");
 const grass=mat(0x78994d),grass2=mat(0x88a957),stone=mat(0xb9a17a),stoneLight=mat(0xd8c49a),stoneDark=mat(0x766348),gold=mat(0xd5a53d,.36,.58),goldLight=mat(0xf1d477,.3,.48),tile=mat(0x287d83,.42,.12),dark=mat(0x173b3e),wood=mat(0x654326),leaf=mat(0x426d35),leaf2=mat(0x628b3e);
 grass.map=grassTexture;stone.map=stoneTexture;stoneLight.map=stoneTexture;stoneDark.map=stoneTexture;wood.map=woodTexture;tile.map=roofTexture;[grass,stone,stoneLight,stoneDark,wood,tile].forEach(m=>m.needsUpdate=true);
 function mesh(geo,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
 function box(x,y,z,sx,sy,sz,material){return mesh(new THREE.BoxGeometry(sx,sy,sz),material,x,y,z);}
 // rolling earth platform and grass detailing
 mesh(new THREE.CylinderGeometry(13.5,14,1,80),grass,0,-.55,0,1,1,.86);
 mesh(new THREE.CylinderGeometry(12.7,13,0.08,80),grass2,0,-.02,0,1,1,.86);
 for(let i=0;i<100;i++){const a=i*2.399,r=2.5+(i%17)*.57;mesh(new THREE.SphereGeometry(.035,5,4),i%3?grass:leaf,Math.cos(a)*r,.035,Math.sin(a)*r,.7,1,.7);}
 // stone circular fortification wall, crenellations and gate
 mesh(new THREE.CylinderGeometry(9.8,10.2,1.45,72,1,true),stone,0,.78,0,1,1,.82);
 mesh(new THREE.CylinderGeometry(10.05,10.35,.18,72,1,true),stoneLight,0,1.52,0,1,1,.82);
 for(let i=0;i<48;i++){const a=i*Math.PI*2/48,x=Math.sin(a)*9.95,z=Math.cos(a)*8.15;box(x,1.83,z,.48,.55,.48,stoneLight);}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.sin(a)*9.95,z=Math.cos(a)*8.15;
  mesh(new THREE.CylinderGeometry(.72,.86,2.65,12),stoneLight,x,1.22,z);
  mesh(new THREE.CylinderGeometry(.86,.8,.22,12),gold,x,2.62,z);
  mesh(new THREE.ConeGeometry(.7,.85,12),stone,x,3.12,z);
 }
 // monumental gate on the front side
 box(0,1.15,9.0,3.5,2.6,.75,stoneLight);
 box(0,.85,8.58,1.55,1.95,.18,dark);
 mesh(new THREE.TorusGeometry(.8,.12,10,32,Math.PI),gold,0,1.85,8.48);
 box(-1.45,2.62,9,.5,.65,.6,stone);box(1.45,2.62,9,.5,.65,.6,stone);
 // central palace stepped foundations
 box(0,.25,0,7.2,.5,6.4,stoneDark);box(0,.55,0,6.8,.18,6.0,stoneLight);
 box(0,1.55,0,5.7,2.0,4.9,stone);
 // decorative turquoise belt and cornice
 box(0,2.22,0,5.85,.25,5.05,tile);box(0,2.43,0,6.05,.16,5.25,gold);
 // front facade panels and arched entrance
 box(0,1.12,2.48,1.6,1.75,.12,dark);
 mesh(new THREE.TorusGeometry(.8,.13,12,36,Math.PI),goldLight,0,1.95,2.48);
 for(const x of [-1.9,1.9]){box(x,1.3,2.49,.62,1.35,.14,tile);box(x,1.3,2.58,.12,1.15,.08,gold);}
 // palace side wings and windows
 for(const side of [-1,1]){box(side*3.05,1.15,0,1.0,1.6,4.8,stoneLight);
  for(const z of [-1.35,0,1.35])box(side*3.57,1.3,z,.08,.8,.5,dark);
 }
 // dome drum, ribbed golden dome, finial
 mesh(new THREE.CylinderGeometry(1.85,2.1,1.2,12),tile,0,2.95,0);
 mesh(new THREE.CylinderGeometry(2.08,2.08,.18,12),gold,0,3.57,0);
 const domeProfile=[new THREE.Vector2(0,0),new THREE.Vector2(1.92,0),new THREE.Vector2(1.72,.55),new THREE.Vector2(1.35,1.05),new THREE.Vector2(.78,1.48),new THREE.Vector2(.25,1.72),new THREE.Vector2(0,1.76)];
 mesh(new THREE.LatheGeometry(domeProfile,48),gold,0,3.62,0);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const rib=mesh(new THREE.TorusGeometry(1.55,.025,5,24,Math.PI/2),goldLight,0,4.18,0);rib.rotation.y=a;}
 mesh(new THREE.CylinderGeometry(.055,.08,.55,8),goldLight,0,5.48,0);
 mesh(new THREE.SphereGeometry(.12,12,8),goldLight,0,5.8,0);
 // Fortified corner towers and a carved royal balcony crown the central palace.
 for(const [tx,tz] of [[-2.65,-2.2],[2.65,-2.2],[-2.65,2.2],[2.65,2.2]]){
  mesh(new THREE.BoxGeometry(.72,2.05,.72),stoneLight,tx,2.18,tz);
  mesh(new THREE.BoxGeometry(.9,.18,.9),gold,tx,3.27,tz);
  mesh(new THREE.ConeGeometry(.58,.82,8),tile,tx,3.76,tz);
  mesh(new THREE.SphereGeometry(.09,8,6),goldLight,tx,4.2,tz);
 }
 box(0,2.55,2.72,2.15,.16,.48,stoneLight);
 for(const bx of [-.82,-.42,0,.42,.82])box(bx,2.37,2.72,.08,.22,.12,gold);
 
 // twin minarets with balconies, turquoise bands, pointed roofs and crescents
 function minaret(x,z){
  mesh(new THREE.CylinderGeometry(.48,.68,4.3,12),stoneLight,x,2.35,z);
  mesh(new THREE.CylinderGeometry(.68,.68,.2,12),tile,x,3.5,z);
  mesh(new THREE.CylinderGeometry(.57,.57,.16,12),gold,x,4.1,z);
  mesh(new THREE.ConeGeometry(.52,.95,12),tile,x,4.62,z);
  mesh(new THREE.CylinderGeometry(.07,.1,.55,8),goldLight,x,5.34,z);
  const crescent=mesh(new THREE.TorusGeometry(.22,.055,8,24),goldLight,x,5.68,z);crescent.scale.set(.8,1.2,.5);
 }
 minaret(-4.1,-1.5);minaret(4.1,-1.5);
 // small Seljuk kiosks, trees and courtyard paths
 for(const [x,z] of [[-6,-5],[6,-5],[-6,4],[6,4],[-3,-7],[3,-7]]){
  mesh(new THREE.CylinderGeometry(.12,.18,1.1,7),wood,x,.55,z);
  mesh(new THREE.SphereGeometry(.85,10,8),leaf,x,1.45,z,1,1.1,1);
  mesh(new THREE.SphereGeometry(.55,9,7),leaf2,x+.35,1.75,z-.15);
 }
 for(let i=0;i<10;i++){const x=(i-4.5)*.72;box(x,.12,6.6,.42,.16,.42,stoneLight);}

 // Seljuk architectural detailing: carved facade, stone courses and nine true 3D build pads.
 const carvedStone=mat(0xe4d2a8), turquoise=mat(0x1b7778,.48,.16), shadowStone=mat(0x4b4030);
 // Layered masonry courses on the central palace.
 for(let y=.82;y<2.25;y+=.34){
  for(let side of [-1,1]){
   for(let x=-2.55;x<=2.55;x+=.72){
    if(Math.abs(x)<.48 && y>1.05) continue;
    const block=box(x,y,side*2.515,.66,.045,.035,y%2?carvedStone:stoneLight);
    block.castShadow=false;
   }
  }
 }
 // Carved portal frame and turquoise geometric spandrels.
 for(const x of [-1.05,1.05]){
  box(x,1.45,2.61,.16,1.9,.18,carvedStone);
  box(x,2.42,2.61,.34,.14,.2,gold);
 }
 box(0,2.88,2.55,2.35,.16,.18,turquoise);
 for(let i=-4;i<=4;i++){
  const motif=mesh(new THREE.OctahedronGeometry(.13,0),goldLight,i*.43,2.88,2.68,.9,1.15,.35);
 }
 // Repeated arched windows with deep reveals.
 for(const x of [-2.15,2.15]){
  for(const z of [-1.35,0,1.35]){
   box(x,1.52,z, .52,.86,.13,dark);
   mesh(new THREE.TorusGeometry(.25,.065,8,20,Math.PI),carvedStone,x,1.95,z+.08);
   box(x,1.1,z,.68,.1,.2,gold);
  }
 }
 // Nine circular, stone-rimmed construction foundations around the keep.
 const buildPadPositions=[[-4.8,-6.0],[0,-7.3],[4.8,-6.0],[7.1,-2.0],[7.1,3.0],[2.8,6.6],[-2.8,6.6],[-7.1,3.0],[-7.1,-2.0]];
 const padBase=mat(0x9b8969), padInner=mat(0x6d7950), padGlow=mat(0xd8b45d,.42,.35);
 buildPadPositions.forEach(([x,z],i)=>{
  const base=mesh(new THREE.CylinderGeometry(1.22,1.28,.22,40),padBase,x,.12,z);
  const inset=mesh(new THREE.CylinderGeometry(1.04,1.04,.035,40),padInner,x,.245,z);
  const rim=mesh(new THREE.TorusGeometry(1.12,.095,10,48),padGlow,x,.28,z);
  rim.rotation.x=Math.PI/2;
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4;
   mesh(new THREE.BoxGeometry(.16,.08,.12),carvedStone,x+Math.cos(a)*1.13,.31,z+Math.sin(a)*1.13);
  }
  const marker=mesh(new THREE.CylinderGeometry(.13,.13,.025,16),goldLight,x,.29,z);
  marker.userData.buildSlot=i+1;
 });
 // Stone paths link the keep to the gate and outer construction ring.
 for(let i=0;i<13;i++){
  const z=7.9-i*.58;
  const p=mesh(new THREE.BoxGeometry(.72,.08,.48),i%2?stoneLight:carvedStone,0,.035,z);
  p.rotation.y=(i%2?.025:-.025);
 }


 // Premium environment pass: textured courtyard, layered paths, vegetation, banners and lighting.
 const earthMat=mat(0x92794e), pavingA=mat(0xc9b58e), pavingB=mat(0xa99570), moss=mat(0x526f37), shrubMat=mat(0x315b32), shrubLight=mat(0x648b43), bannerRed=mat(0x8d3028), bannerGold=mat(0xd5ad54,.48,.22);
 // Slightly raised inner courtyard with irregular stone paving, not a flat coloured disk.
 mesh(new THREE.CylinderGeometry(8.95,9.15,.12,72),earthMat,0,.055,0,1,1,.82);
 for(let ring=0;ring<5;ring++){
  const radius=2.25+ring*1.05;
  for(let i=0;i<Math.floor(radius*5);i++){
   const a=i/Math.floor(radius*5)*Math.PI*2+(ring%2)*.11;
   const x=Math.cos(a)*radius,z=Math.sin(a)*radius*.82;
   const p=mesh(new THREE.BoxGeometry(.48+((i+ring)%3)*.08,.055,.36),((i+ring)%2)?pavingA:pavingB,x,.13,z);
   p.rotation.y=-a+.15;p.rotation.z=(i%3-1)*.018;
  }
 }
 // Main ceremonial road: stone pavers widen towards the gate.
 for(let i=0;i<17;i++){
  const z=8.05-i*.43;
  const width=.74+Math.max(0,5-i)*.11;
  for(const side of [-1,1]){
   const p=mesh(new THREE.BoxGeometry(width,.09,.38),i%3===0?pavingA:pavingB,side*width*.53,.16,z);
   p.rotation.y=side*.035;
  }
 }
 // Small side paths and decorative drainage channels.
 for(const side of [-1,1]){
  for(let i=0;i<7;i++){
   const z=4.4-i*.58;
   const p=mesh(new THREE.BoxGeometry(.42,.06,.34),pavingA,side*(2.25+i*.1),.14,z);
   p.rotation.y=side*.16;
  }
 }
 // Layered broadleaf trees with visible trunks, roots and varied crowns.
 function makeTree(x,z,s=1,variant=0){
  const trunk=mesh(new THREE.CylinderGeometry(.12*s,.22*s,1.45*s,9),wood,x,.72*s,z);
  trunk.rotation.z=(variant%2?.08:-.07);
  for(let r=0;r<4;r++){
   const angle=r*Math.PI/2+variant*.7;
   const root=mesh(new THREE.CylinderGeometry(.035*s,.13*s,.62*s,7),wood,x+Math.cos(angle)*.22*s,.2*s,z+Math.sin(angle)*.2*s);
   root.rotation.z=Math.cos(angle)*.55;root.rotation.x=Math.sin(angle)*.55;
  }
  const crownMat=variant%2?leaf:leaf2;
  for(const [dx,dy,dz,sc] of [[0,1.65,0,1],[-.38,1.45,.12,.72],[.34,1.5,-.12,.78],[0,2.05,.08,.68]]){
   mesh(new THREE.IcosahedronGeometry(.68*s,1),crownMat,x+dx*s,dy*s,z+dz*s,sc,sc*.92,sc);
  }
  // Small sunlit leaf clusters create a less uniform silhouette.
  for(let k=0;k<7;k++){
   const a=k*2.4+variant;
   mesh(new THREE.SphereGeometry(.12*s,7,5),k%2?leaf2:leaf,x+Math.cos(a)*.55*s,1.75*s+(k%3)*.16*s,z+Math.sin(a)*.42*s);
  }
 }
 // Keep the central courtyard clear; trees frame the fortification and outer approach.
 [[-10,-5,1.05],[-10,1,.9],[-9,6,.85],[10,-5,1],[10,1,.9],[9,6,.82],[-6,-9,.85],[6,-9,.9],[-6,9,.82],[6,9,.82]].forEach((v,i)=>makeTree(v[0],v[1],v[2],i));
 // Shrub clusters, rocks and tufts break up empty ground around the walls.
 for(let i=0;i<34;i++){
  const a=i*2.399,r=8.5+(i%5)*.62,x=Math.cos(a)*r,z=Math.sin(a)*r*.82;
  if(Math.abs(x)<8&&Math.abs(z)<7)continue;
  for(let j=0;j<3;j++)mesh(new THREE.IcosahedronGeometry(.22+(j%2)*.07,0),j%2?shrubMat:shrubLight,x+(j-1)*.22,.22,z+((j%2)-.5)*.22,1,.72,1);
 }
 for(let i=0;i<20;i++){
  const a=i*2.1,r=7.7+(i%4)*.55,x=Math.cos(a)*r,z=Math.sin(a)*r*.8;
  const rock=mesh(new THREE.DodecahedronGeometry(.22+(i%3)*.08,0),i%2?stoneDark:stone,x,.18,z,1,.65,.85);
  rock.rotation.set(i*.2,i*.7,i*.13);
 }
 // Seljuk standards at the gate and beside the keep.
 function makeBanner(x,z){
  mesh(new THREE.CylinderGeometry(.045,.065,3.7,8),gold,x,1.85,z);
  mesh(new THREE.SphereGeometry(.09,8,6),goldLight,x,3.75,z);
  const cloth=mesh(new THREE.BoxGeometry(.72,1.0,.045),bannerRed,x+.34,3.05,z);
  cloth.rotation.z=-.06;
  for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(.74,.045,.055),bannerGold,x+.34,3.42-i*.3,z+.035);
  mesh(new THREE.TorusGeometry(.16,.035,7,20),goldLight,x+.34,3.05,z+.05);
 }
 makeBanner(-2.65,7.8);makeBanner(2.65,7.8);
 // Warm courtyard lanterns with gold housings and softly glowing glass.
 const lanternGlass=new THREE.MeshStandardMaterial({color:0xffd47a,emissive:0xffa52c,emissiveIntensity:.55,roughness:.3});
 for(const [x,z] of [[-5.4,-3.8],[5.4,-3.8],[-5.4,4.2],[5.4,4.2],[-2.4,7.1],[2.4,7.1]]){
  mesh(new THREE.CylinderGeometry(.055,.075,1.05,8),wood,x,.55,z);
  mesh(new THREE.BoxGeometry(.34,.38,.34),gold,x,1.22,z);
  mesh(new THREE.BoxGeometry(.23,.27,.23),lanternGlass,x,1.22,z);
  mesh(new THREE.ConeGeometry(.25,.2,8),gold,x,1.5,z);
 }
 // A subtle turquoise water basin adds a focal point without obstructing building pads.
 mesh(new THREE.CylinderGeometry(.86,.96,.22,24),stoneLight,-5.35, .2,-.1);
 mesh(new THREE.CylinderGeometry(.68,.68,.035,24),mat(0x3d9290,.22,.18),-5.35,.33,-.1);
 mesh(new THREE.CylinderGeometry(.1,.14,.62,8),gold,-5.35,.62,-.1);
 mesh(new THREE.SphereGeometry(.16,10,8),goldLight,-5.35,.98,-.1);
 // Decorative carved stone caps on the main gate and wall towers.
 for(const x of [-1.65,1.65]){
  mesh(new THREE.ConeGeometry(.34,.48,8),tile,x,2.55,9.02);
  mesh(new THREE.SphereGeometry(.11,8,6),goldLight,x,2.83,9.02);
 }
 // Add a few irregular stone courses around the outer wall to give it depth.
 for(let i=0;i<72;i++){
  const a=i*Math.PI*2/72,x=Math.sin(a)*10.02,z=Math.cos(a)*8.2;
  const block=mesh(new THREE.BoxGeometry(.42,.16,.12),i%3?stoneLight:carvedStone,x,.52,z);
  block.rotation.y=a;
 }

 // Player buildings: real 3D meshes synchronized with the city API.
 const playerBuildings=new THREE.Group();scene.add(playerBuildings);
 const buildingMaterials={
  wall:mat(0xc8b58f),roof:mat(0x80513a),wood:mat(0x58391f),door:mat(0x38251a),
  trim:mat(0xe0c78f),tile:mat(0x287d83,.48,.1),metal:mat(0xc69b42,.38,.55)
 };
 buildingMaterials.wall.map=stoneTexture;buildingMaterials.roof.map=roofTexture;buildingMaterials.wood.map=woodTexture;buildingMaterials.tile.map=roofTexture;Object.values(buildingMaterials).forEach(m=>m.needsUpdate=true);
 const buildingAnchors=[
  [-4.8,-6.0],[0,-7.3],[4.8,-6.0],[7.1,-2.0],[7.1,3.0],
  [2.8,6.6],[-2.8,6.6],[-7.1,3.0],[-7.1,-2.0]
 ];
 function makePlayerBuilding(item,index){
  const group=new THREE.Group();
  const type=String(item.type||"").toLowerCase();
  const M=buildingMaterials;
  const addBox=(w,h,d,x,y,z,material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);group.add(o);return o;};
  const addMesh=(geo,material,x,y,z)=>{const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);group.add(o);return o;};
  const addRoof=(w,d,y,material=M.roof)=>{
   const roof=addMesh(new THREE.ConeGeometry(Math.max(w,d)*.76,.9,4),material,0,y,0);
   roof.rotation.y=Math.PI/4;roof.scale.set(w/2.1,.9,d/2.1);
   addBox(.12,.12,d+.12,0,y+.43,0,M.metal);
  };
  const long=/stable|lumberjack|workshop/.test(type);
  const w=long?2.5:2.12,d=long?2.9:2.35,h=type==="temple"?1.55:1.42;
  // Raised dressed-stone plinth and corner quoins.
  addBox(w+.42,.25,d+.42,0,.125,0,M.trim);
  addBox(w+.16,.1,d+.16,0,.29,0,M.metal);
  addBox(w,h,d,0,.34+h/2,0,M.wall);
  for(const x of [-w/2+.09,w/2-.09])for(const z of [-d/2+.09,d/2-.09])
   addBox(.17,h+.04,.17,x,.34+h/2,z,M.trim);
  // Timber frame, carved lintel and recessed arched entrance.
  for(const x of [-w/2+.18,w/2-.18])addBox(.12,h+.06,.13,x,.36+h/2,d/2+.035,M.wood);
  addBox(.58,.98,.10,0,.79,d/2+.065,M.door);
  addBox(.78,.13,.15,0,1.31,d/2+.07,M.trim);
  addMesh(new THREE.TorusGeometry(.29,.055,8,20,Math.PI),M.metal,0,1.28,d/2+.12).rotation.z=Math.PI;
  for(const x of [-.68,.68]){
   addBox(.34,.43,.09,x,1.12,d/2+.065,M.tile);
   addBox(.48,.09,.13,x,1.38,d/2+.07,M.trim);
   addBox(.08,.5,.11,x,1.12,d/2+.12,M.metal);
  }
  // Distinct architectural silhouette for every building family.
  if(type==="temple"){
   addBox(w+.22,.18,d+.22,0,1.98,0,M.trim);
   addBox(1.18,.85,1.18,0,2.38,0,M.tile);
   addMesh(new THREE.CylinderGeometry(.72,.82,.38,12),M.metal,0,2.98,0);
   addMesh(new THREE.SphereGeometry(.78,16,12),M.metal,0,3.42,0).scale.y=.68;
   addMesh(new THREE.ConeGeometry(.12,.45,8),M.metal,0,4.0,0);
   for(const x of [-.82,.82]){addMesh(new THREE.CylinderGeometry(.16,.2,.8,8),M.trim,x,2.45,-.55);addMesh(new THREE.ConeGeometry(.23,.42,8),M.tile,x,3.02,-.55);}
  }else if(type==="school"){
   addRoof(w+.15,d+.15,2.25,M.tile);
   addBox(.95,.08,.18,0,2.03,d/2+.09,M.metal);
   for(let i=0;i<3;i++)addBox(.12,.55,.12,-.38+i*.38,1.0,d/2+.12,M.metal);
  }else if(type==="barracks"){
   addRoof(w+.2,d+.2,2.24);
   for(const x of [-.78,.78]){addMesh(new THREE.CylinderGeometry(.23,.28,.85,8),M.trim,x,2.35,-.45);addMesh(new THREE.ConeGeometry(.34,.5,8),M.roof,x,3.0,-.45);}
   addBox(.58,.36,.07,0,2.7,d/2+.12,M.tile);
  }else if(type==="archery"){
   addRoof(w+.15,d+.15,2.2);
   for(const x of [-.72,.72]){
    addMesh(new THREE.TorusGeometry(.22,.045,8,20),M.metal,x,1.75,d/2+.15);
    addBox(.08,.72,.08,x,1.75,d/2+.15,M.wood);
   }
   addBox(.72,.12,.12,0,2.0,d/2+.15,M.trim);
  }else if(type==="stable"){
   addRoof(w+.2,d+.2,2.18);
   for(const x of [-.72,0,.72]){addBox(.09,1.0,.12,x,.85,d/2+.12,M.wood);addBox(.62,.1,.12,x,.43,d/2+.12,M.trim);}
   addMesh(new THREE.TorusGeometry(.28,.055,8,20),M.metal,.72,1.5,d/2+.17);
  }else if(type==="workshop"||type==="blacksmith"){
   addRoof(w+.15,d+.15,2.18);
   addBox(.48,.8,.46,.7,2.0,-.62,M.wall);
   addBox(.58,.13,.56,.7,2.44,-.62,M.trim);
   addMesh(new THREE.CylinderGeometry(.12,.16,.5,8),M.wood,-.72,1.85,.35);
   addBox(.62,.16,.52,-.62,1.42,.35,M.metal);
   addMesh(new THREE.CylinderGeometry(.12,.12,.55,8),M.metal,-.62,1.78,.35);
  }else if(type==="stonemason"){
   addRoof(w+.1,d+.1,2.16);
   for(let i=0;i<3;i++)addBox(.48,.36,.42,-.72+i*.72,.58+i*.16,d/2+.28,M.trim);
   addMesh(new THREE.ConeGeometry(.22,.55,6),M.metal,.72,1.85,d/2+.2);
  }else if(type==="lumberjack"){
   addRoof(w+.15,d+.15,2.16);
   for(let i=0;i<4;i++)addMesh(new THREE.CylinderGeometry(.15,.18,.78,8),M.wood,-.85+i*.45,1.05,-.8);
   addMesh(new THREE.CylinderGeometry(.18,.18,.12,10),M.trim,.5,1.7,d/2+.2);
   addBox(.65,.12,.16,.5,1.55,d/2+.2,M.metal);
  }else if(type==="mill"){
   addRoof(w+.1,d+.1,2.12);
   addMesh(new THREE.CylinderGeometry(.2,.2,.18,12),M.metal,0,2.2,d/2+.16);
   const sail=new THREE.Group();sail.position.set(0,2.2,d/2+.23);group.add(sail);
   for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.2,1.25,.07),M.trim);blade.position.y=.72;blade.rotation.z=i*Math.PI/2;sail.add(blade);}
   sail.userData.rotates=true;
  }else if(type==="farm"){
   addBox(w+.2,.12,d+.2,0,.08,0,M.trim);
   for(let i=0;i<5;i++){
    const row=addBox(.12,.13,d-.3,-.78+i*.39,.22,0,M.wood);row.rotation.z=-.05;
    for(let j=0;j<4;j++)addMesh(new THREE.ConeGeometry(.08,.35,5),M.tile,-.78+i*.39,.43,-.78+j*.5);
   }
   addBox(.55,.8,.55,.72,.5,-.65,M.wood);
  }else if(type==="market"){
   addBox(w+.12,.14,d+.12,0,1.78,0,M.wood);
   for(const x of [-.88,.88])for(const z of [-.9,.9])addBox(.12,1.55,.12,x,1.0,z,M.wood);
   addBox(w+.25,.13,d+.25,0,2.0,0,M.tile);
   for(let i=0;i<5;i++)addBox(.36,.08,d+.28,-.9+i*.45,2.08,0,i%2?M.trim:M.tile);
   for(const x of [-.62,0,.62])addBox(.42,.35,.42,x,.72,d/2+.2,M.trim);
  }else if(type==="wall"){
   addBox(w+.25,.75,.65,0,.72,0,M.trim);
   for(let x=-.9;x<=.91;x+=.6)addBox(.35,.42,.72,x,1.3,0,M.wall);
   addMesh(new THREE.ConeGeometry(.18,.38,4),M.roof,0,1.75,0);
  }else{
   addRoof(w+.15,d+.15,2.16);
   addBox(.32,.7,.32,.72,2.05,-.62,M.wall);
   addBox(.4,.1,.4,.72,2.42,-.62,M.trim);
  }
  // Signature props: each trade building receives a readable 3D identity.
  const sign=(material=M.tile)=>{addBox(.82,.3,.09,0,1.92,d/2+.17,material);addBox(.92,.07,.12,0,2.1,d/2+.17,M.metal);};
  if(type==="shelter"){
   addMesh(new THREE.CylinderGeometry(1.18,1.28,1.25,16),M.wall,0,1.0,0);
   addMesh(new THREE.ConeGeometry(1.34,.9,16),M.roof,0,2.08,0);
   addMesh(new THREE.CylinderGeometry(.22,.24,.16,12),M.trim,0,2.62,0);
   for(let a=0;a<8;a++){const ang=a*Math.PI/4;const rib=addBox(.07,.82,.08,Math.cos(ang)*.58,2.08,Math.sin(ang)*.58,M.metal);rib.rotation.y=-ang;}
   addBox(.62,.78,.08,0,.9,1.18,M.door);
  }else if(type==="school"){
   sign();for(let x=-.65;x<=.66;x+=.32){addBox(.1,.55,.1,x,.9,d/2+.17,M.wood);addBox(.18,.07,.12,x,1.2,d/2+.18,M.trim);}
   addBox(.72,.08,.18,0,2.62,0,M.metal);addMesh(new THREE.OctahedronGeometry(.2,0),M.metal,0,2.82,0);
  }else if(type==="barracks"){
   sign(M.roof);for(let x=-.72;x<=.73;x+=.48){addBox(.12,.62,.13,x,.88,-d/2-.12,M.wood);addMesh(new THREE.TorusGeometry(.19,.045,7,18),M.metal,x,1.22,-d/2-.2);}
   addMesh(new THREE.ConeGeometry(.24,.34,5),M.metal,0,2.8,0);
  }else if(type==="archery"){
   sign();for(const x of [-.68,.68]){const target=addMesh(new THREE.CylinderGeometry(.32,.32,.08,24),M.trim,x,.95,-d/2-.22);target.rotation.x=Math.PI/2;const ring=addMesh(new THREE.TorusGeometry(.22,.035,7,24),M.roof,x,.95,-d/2-.16);ring.rotation.y=Math.PI/2;addMesh(new THREE.SphereGeometry(.07,8,6),M.metal,x,.95,-d/2-.11);}
   for(let i=0;i<3;i++){const arrow=addBox(.045,.85,.045,-.75+i*.15,1.25,d/2+.25,M.metal);arrow.rotation.z=-.28;}
  }else if(type==="stable"){
   sign(M.roof);for(const hx of [-.62,.62]){
    addMesh(new THREE.SphereGeometry(.3,10,8),M.wood,hx,.82,-.15).scale.set(1.25,.72,.65);
    addMesh(new THREE.SphereGeometry(.16,8,6),M.wood,hx+.24,1.1,.02).scale.set(.7,1.2,.7);
    for(const [lx,lz] of [[-.12,-.23],[.15,-.23],[.28,-.1],[-.27,-.1]])addMesh(new THREE.CylinderGeometry(.055,.07,.5,7),M.wood,hx+lx,.42,lz);
   }
  }else if(type==="workshop"||type==="blacksmith"){
   sign(M.roof);addBox(.58,.62,.12,0,.82,d/2+.18,M.door);
   const fire=new THREE.MeshStandardMaterial({color:0xff7b22,emissive:0xff4a08,emissiveIntensity:1.25});
   addMesh(new THREE.SphereGeometry(.2,10,8),fire,0,.75,d/2+.27).scale.set(1,.65,.5);
   addBox(.34,1.0,.34,-.78,2.15,-.55,M.wall);addBox(.46,.12,.46,-.78,2.7,-.55,M.metal);
   addMesh(new THREE.CylinderGeometry(.16,.2,.36,8),M.metal,.62,1.38,.18);addBox(.72,.13,.5,.62,1.58,.18,M.metal);
  }else if(type==="stonemason"){
   sign();for(let i=0;i<3;i++){const block=addBox(.42,.38,.42,-.7+i*.7,.65,-d/2-.22,M.trim);block.rotation.y=(i-1)*.18;}
   addMesh(new THREE.ConeGeometry(.18,.62,6),M.metal,.72,1.65,d/2+.2);
  }else if(type==="lumberjack"){
   sign(M.roof);for(let i=0;i<4;i++){const log=addMesh(new THREE.CylinderGeometry(.14,.14,.88,9),M.wood,-.75+i*.42,-.1,-.72);log.rotation.z=Math.PI/2;}
   const axe=addBox(.1,.72,.08,.78,1.0,d/2+.2,M.metal);axe.rotation.z=-.55;addBox(.36,.12,.12,.58,1.28,d/2+.2,M.wood);
  }else if(type==="mill"){
   sign();for(let i=0;i<4;i++){const blade=addBox(.18,1.5,.08,0,2.15,d/2+.29,M.trim);blade.rotation.z=i*Math.PI/2;}
  }else if(type==="farm"){
   for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=-.78+row*.5,z=-.7+col*.55;const stalk=addBox(.035,.5,.035,x,.48,z,M.trim);stalk.rotation.z=col%2?.12:-.12;addMesh(new THREE.SphereGeometry(.08,6,5),M.metal,x,.75,z);}
  }else if(type==="market"){
   sign(M.roof);for(let i=0;i<3;i++){addMesh(new THREE.CylinderGeometry(.2,.24,.22,10),M.wood,-.65+i*.65,.62,d/2+.26);addMesh(new THREE.SphereGeometry(.12,8,6),i%2?M.trim:M.metal,-.65+i*.65,.8,d/2+.26);}
  }else if(type==="temple"){
   for(let x=-.82;x<=.83;x+=.41){addMesh(new THREE.CylinderGeometry(.075,.09,.9,8),M.trim,x,1.85,d/2+.2);addMesh(new THREE.CylinderGeometry(.13,.13,.08,8),M.metal,x,2.33,d/2+.2);}
  }else if(type==="wall"){
   for(let i=0;i<5;i++)addBox(.22,.25,.78,-.9+i*.45,1.85,0,M.trim);
   addMesh(new THREE.CylinderGeometry(.12,.12,.4,8),M.metal,0,2.12,0);
  }

  // Stone stair, lantern and level-up crown details.
  addBox(.92,.15,.42,0,.075,d/2+.28,M.trim);
  addBox(.12,.48,.12,-w/2-.12,1.0,d/2+.04,M.metal);
  addMesh(new THREE.SphereGeometry(.12,8,6),M.metal,-w/2-.12,1.28,d/2+.04);
  const level=Math.max(1,Math.min(10,Number(item.level)||1));
  if(level>1){
   addBox(w+.28,.1,d+.28,0,.43+h,0,M.metal);
   for(const x of [-w/2,w/2])addMesh(new THREE.ConeGeometry(.16,.32,6),M.tile,x,2.35,-d/2);
  }
  const [x,z]=buildingAnchors[index%buildingAnchors.length];
  group.position.set(x,.31,z);
  group.rotation.y=(index%4)*Math.PI/2;
  group.scale.setScalar(1+Math.min(level-1,5)*.025);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return group;
 }
 function projectedBuildSlots(){
  camera.updateMatrixWorld();camera.updateProjectionMatrix();
  return buildPadPositions.map(([x,z])=>{
   const p=new THREE.Vector3(x,.38,z).project(camera);
   return {x:(p.x*.5+.5)*100,y:(.5-p.y*.5)*100};
  });
 }
 window.umaykut3d={
  getSlotPositions(){return projectedBuildSlots();},
  setBuildings(buildings){
   while(playerBuildings.children.length)playerBuildings.remove(playerBuildings.children[0]);
   const slots=projectedBuildSlots();
   (buildings||[]).filter(b=>b.type!=="center").slice(0,9).forEach((b,i)=>{
    const px=Number(b.x),py=Number(b.y);
    const nearest=slots.map((p,index)=>({index,d:Math.hypot(p.x-px,p.y-py)})).sort((a,b)=>a.d-b.d)[0];
    playerBuildings.add(makePlayerBuilding(b,nearest&&nearest.d<8?nearest.index:i));
   });
  }
 };

 // Render and resize
 function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(canvas);resize();
 window.dispatchEvent(new Event("umaykut3dready"));
 let frame=0;
 function animate(){requestAnimationFrame(animate);frame+=.003;sun.position.x=-9+Math.sin(frame)*1.5;playerBuildings.traverse(o=>{if(o.userData.rotates)o.rotation.z+=.012;});renderer.render(scene,camera);}
 animate();
 window.addEventListener("orientationchange",resize);
}
