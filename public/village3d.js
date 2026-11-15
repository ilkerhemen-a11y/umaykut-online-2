import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const canvas=document.getElementById("village3dCanvas");
if(canvas){
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x91b96c);
 scene.fog=new THREE.Fog(0x91b96c,24,48);
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);
 camera.position.set(13,17,22);camera.lookAt(0,1.4,0);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 scene.add(new THREE.HemisphereLight(0xe8f3d2,0x6b5636,2.0));
 const sun=new THREE.DirectionalLight(0xffe0a0,3.1);sun.position.set(-9,16,10);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;scene.add(sun);
 const mat=(color,roughness=.88,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const grass=mat(0x78994d),grass2=mat(0x88a957),stone=mat(0xb9a17a),stoneLight=mat(0xd8c49a),stoneDark=mat(0x766348),gold=mat(0xd5a53d,.36,.58),goldLight=mat(0xf1d477,.3,.48),tile=mat(0x287d83,.42,.12),dark=mat(0x173b3e),wood=mat(0x654326),leaf=mat(0x426d35),leaf2=mat(0x628b3e);
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

 // Player buildings: real 3D meshes synchronized with the city API.
 const playerBuildings=new THREE.Group();scene.add(playerBuildings);
 const buildingMaterials={
  wall:mat(0xc8b58f),roof:mat(0x80513a),wood:mat(0x58391f),door:mat(0x38251a),
  trim:mat(0xe0c78f),tile:mat(0x287d83,.48,.1),metal:mat(0xc69b42,.38,.55)
 };
 const buildingAnchors=[
  [-5.8,-4.4],[-.2,-6.7],[5.7,-4.3],[7.0,.7],[5.4,5.0],
  [.1,6.5],[-5.5,4.9],[-7.0,.4],[-3.2,-.3]
 ];
 function makePlayerBuilding(item,index){
  const group=new THREE.Group();
  const type=String(item.type||"").toLowerCase();
  const isMilitary=/barracks|stable|archery|workshop|siege/.test(type);
  const isStorage=/store|warehouse|depo/.test(type);
  const width=isMilitary?2.35:2.05,depth=isMilitary?2.7:2.25,height=isMilitary?1.75:1.45;
  const base=new THREE.Mesh(new THREE.BoxGeometry(width+.32,.24,depth+.32),buildingMaterials.trim);base.position.y=.12;group.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),buildingMaterials.wall);body.position.y=.24+height/2;body.castShadow=true;body.receiveShadow=true;group.add(body);
  // Timber framing and stone corner blocks.
  for(const x of [-width/2+.12,width/2-.12]){
   const beam=new THREE.Mesh(new THREE.BoxGeometry(.13,height+.08,.14),buildingMaterials.wood);beam.position.set(x,.28+height/2,depth/2+.025);group.add(beam);
  }
  const door=new THREE.Mesh(new THREE.BoxGeometry(.48,.92,.09),buildingMaterials.door);door.position.set(0,.49,depth/2+.055);group.add(door);
  for(const x of [-.62,.62]){
   const win=new THREE.Mesh(new THREE.BoxGeometry(.32,.43,.08),buildingMaterials.tile);win.position.set(x,1.02,depth/2+.06);group.add(win);
   const lintel=new THREE.Mesh(new THREE.BoxGeometry(.44,.1,.11),buildingMaterials.trim);lintel.position.set(x,1.28,depth/2+.06);group.add(lintel);
  }
  const roofGeo=new THREE.ConeGeometry(isMilitary?1.85:1.62,.95,4);
  const roof=new THREE.Mesh(roofGeo,buildingMaterials.roof);roof.rotation.y=Math.PI/4;roof.position.y=.24+height+.42;roof.scale.set(1.08,.9,depth/2/1.62);roof.castShadow=true;group.add(roof);
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.12,.13,depth+.15),buildingMaterials.metal);ridge.position.y=.24+height+.88;group.add(ridge);
  if(isMilitary){
   const tower=new THREE.Mesh(new THREE.CylinderGeometry(.36,.43,1.05,8),buildingMaterials.wall);tower.position.set(0,2.45,-.25);group.add(tower);
   const cap=new THREE.Mesh(new THREE.ConeGeometry(.48,.62,8),buildingMaterials.roof);cap.position.set(0,3.25,-.25);group.add(cap);
   const flag=new THREE.Mesh(new THREE.BoxGeometry(.55,.32,.035),buildingMaterials.tile);flag.position.set(.32,3.25,-.25);group.add(flag);
  }else if(isStorage){
   const vent=new THREE.Mesh(new THREE.BoxGeometry(.5,.32,.5),buildingMaterials.wood);vent.position.set(0,1.95,0);group.add(vent);
  }else{
   const chimney=new THREE.Mesh(new THREE.BoxGeometry(.28,.75,.3),buildingMaterials.wall);chimney.position.set(.58,2.05,-.55);group.add(chimney);
  }
  // Small stone steps and a name plaque give each structure readable scale.
  const step=new THREE.Mesh(new THREE.BoxGeometry(.82,.16,.38),buildingMaterials.trim);step.position.set(0,.08,depth/2+.25);group.add(step);
  const [x,z]=buildingAnchors[index%buildingAnchors.length];group.position.set(x,0,z);
  group.rotation.y=(index%4)*Math.PI/2;
  group.scale.setScalar(item.level>1?1+Math.min(Number(item.level)-1,5)*.035:1);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return group;
 }
 window.umaykut3d={
  setBuildings(buildings){
   while(playerBuildings.children.length)playerBuildings.remove(playerBuildings.children[0]);
   (buildings||[]).filter(b=>b.type!=="center").slice(0,9).forEach((b,i)=>playerBuildings.add(makePlayerBuilding(b,i)));
  }
 };

 // Render and resize
 function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(canvas);resize();
 let frame=0;
 function animate(){requestAnimationFrame(animate);frame+=.003;sun.position.x=-9+Math.sin(frame)*1.5;renderer.render(scene,camera);}
 animate();
 window.addEventListener("orientationchange",resize);
}
