import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const canvas=document.getElementById("village3dCanvas");
if(canvas){
  const scene=new THREE.Scene();
  scene.background=null;
  scene.fog=new THREE.Fog(0x91a967,34,58);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;

  scene.add(new THREE.HemisphereLight(0xf4f0dc,0x536044,2.05));
  const sun=new THREE.DirectionalLight(0xffe2ac,2.7);
  sun.position.set(-10,18,12);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-19;
  sun.shadow.camera.right=19;
  sun.shadow.camera.top=19;
  sun.shadow.camera.bottom=-19;
  sun.shadow.bias=-.00025;
  scene.add(sun);

  const material=(color,roughness=.9,metalness=0,side=THREE.FrontSide)=>new THREE.MeshStandardMaterial({color,roughness,metalness,side});
  const grass=material(0x78964d),grassLight=material(0x8cae58),grassDark=material(0x597b3c);
  const courtyard=material(0xb8a27d),paving=material(0xd4c19a),pavingAlt=material(0xb9a47e);
  const padStone=material(0xc8b48c),padGold=material(0xd9ad4d,.4,.3);
  const wallStone=material(0xbba782,.92,0,THREE.DoubleSide),wallInner=material(0x8d7958,.96,0,THREE.DoubleSide);
  const wallTop=material(0xd6c49c),stoneDark=material(0x66553c),gold=material(0xd3a642,.38,.42);
  const turquoise=material(0x287d83,.48,.16),wood=material(0x624329),leaf=material(0x3d6b35),leafLight=material(0x5f8b40),rockMat=material(0x85816b);

  const ground=new THREE.Mesh(new THREE.CylinderGeometry(15.5,15.8,.72,96),grass);
  ground.position.y=-.4;ground.receiveShadow=true;scene.add(ground);
  const groundTop=new THREE.Mesh(new THREE.CylinderGeometry(15.25,15.4,.08,96),grassLight);
  groundTop.position.y=-.015;groundTop.receiveShadow=true;scene.add(groundTop);
  const yard=new THREE.Mesh(new THREE.CylinderGeometry(10.7,10.9,.16,96),courtyard);
  yard.position.y=.04;yard.receiveShadow=true;scene.add(yard);

  const plazaBase=new THREE.Mesh(new THREE.CylinderGeometry(4.35,4.48,.16,72),pavingAlt);
  plazaBase.position.y=.14;plazaBase.receiveShadow=true;scene.add(plazaBase);
  const plazaTop=new THREE.Mesh(new THREE.CylinderGeometry(4.12,4.12,.08,72),paving);
  plazaTop.position.y=.25;plazaTop.receiveShadow=true;scene.add(plazaTop);
  const plazaRing=new THREE.Mesh(new THREE.TorusGeometry(4.16,.105,10,72),gold);
  plazaRing.rotation.x=Math.PI/2;plazaRing.position.y=.31;scene.add(plazaRing);

  const buildPadPositions=[[-4.8,-6.0],[0,-7.3],[4.8,-6.0],[7.1,-2.0],[7.1,3.0],[2.8,6.6],[-2.8,6.6],[-7.1,3.0],[-7.1,-2.0]];
  const buildAnchors=buildPadPositions;
  function addPavedPath(x,z,width){
    const distance=Math.hypot(x,z),angle=Math.atan2(x,z);
    for(let d=3.8;d<distance-1.05;d+=.68){
      const tile=new THREE.Mesh(new THREE.BoxGeometry(width,.075,.54),((Math.round(d*10)+Math.round(angle*10))%2)?paving:pavingAlt);
      tile.position.set(Math.sin(angle)*d,.19,Math.cos(angle)*d);tile.rotation.y=angle;tile.receiveShadow=true;scene.add(tile);
    }
  }
  buildPadPositions.forEach(([x,z])=>addPavedPath(x,z,.88));
  for(let i=0;i<15;i++){
    const tile=new THREE.Mesh(new THREE.BoxGeometry(2.0,.08,.62),i%2?paving:pavingAlt);
    tile.position.set(0,.18,11.15+i*.31);tile.receiveShadow=true;scene.add(tile);
  }

  const padGroup=new THREE.Group();scene.add(padGroup);
  buildPadPositions.forEach(([x,z])=>{
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.48,1.54,.24,48),padStone);
    base.position.set(x,.17,z);base.castShadow=true;base.receiveShadow=true;padGroup.add(base);
    const inset=new THREE.Mesh(new THREE.CylinderGeometry(1.22,1.22,.04,48),courtyard);
    inset.position.set(x,.29,z);padGroup.add(inset);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.32,.12,12,56),padGold);
    rim.rotation.x=Math.PI/2;rim.position.set(x,.32,z);padGroup.add(rim);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,block=new THREE.Mesh(new THREE.BoxGeometry(.14,.07,.12),wallTop);
      block.position.set(x+Math.cos(a)*1.34,.38,z+Math.sin(a)*1.34);block.rotation.y=-a;padGroup.add(block);
    }
  });

  const gateHalfAngle=.205,wallStart=.205,wallLength=Math.PI*2-.41;
  const wallOuter=new THREE.Mesh(new THREE.CylinderGeometry(11.05,11.38,2.05,96,1,true,wallStart,wallLength),wallStone);
  wallOuter.position.y=1.02;wallOuter.castShadow=true;wallOuter.receiveShadow=true;scene.add(wallOuter);
  const wallInside=new THREE.Mesh(new THREE.CylinderGeometry(10.7,11.02,2.05,96,1,true,wallStart,wallLength),wallInner);
  wallInside.position.y=1.02;wallInside.receiveShadow=true;scene.add(wallInside);
  for(let i=0;i<48;i++){
    const a=wallStart+(i+.5)*wallLength/48,x=Math.sin(a)*11.22,z=Math.cos(a)*11.22;
    const coping=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.58),wallTop);
    coping.position.set(x,2.1,z);coping.rotation.y=-a;coping.castShadow=true;scene.add(coping);
    const merlon=new THREE.Mesh(new THREE.BoxGeometry(.46,.43,.5),wallTop);
    merlon.position.set(x,2.38,z);merlon.rotation.y=-a;merlon.castShadow=true;scene.add(merlon);
  }

  function addTower(x,z,scale=1){
    const group=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.88*scale,.96*scale,.28*scale,12),wallTop);
    base.position.y=.18*scale;group.add(base);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.66*scale,.8*scale,2.55*scale,12),wallStone);
    body.position.y=1.55*scale;body.castShadow=true;body.receiveShadow=true;group.add(body);
    const lowerBand=new THREE.Mesh(new THREE.CylinderGeometry(.73*scale,.73*scale,.16*scale,12),turquoise);
    lowerBand.position.y=2.08*scale;group.add(lowerBand);
    const crown=new THREE.Mesh(new THREE.CylinderGeometry(.82*scale,.78*scale,.25*scale,12),wallTop);
    crown.position.y=2.88*scale;group.add(crown);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.72*scale,.95*scale,12),turquoise);
    roof.position.y=3.47*scale;roof.castShadow=true;group.add(roof);
    const finial=new THREE.Mesh(new THREE.CylinderGeometry(.045*scale,.065*scale,.38*scale,8),gold);
    finial.position.y=4.12*scale;group.add(finial);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.09*scale,10,8),gold);
    orb.position.y=4.34*scale;group.add(orb);
    group.position.set(x,0,z);scene.add(group);
  }
  for(let i=0;i<8;i++){
    const a=gateHalfAngle+.35+i*(wallLength-.7)/8;
    addTower(Math.sin(a)*11.05,Math.cos(a)*11.05,.92);
  }
  addTower(-1.85,10.92,1.12);addTower(1.85,10.92,1.12);

  const gateFrame=new THREE.Shape();
  gateFrame.moveTo(-1.72,0);gateFrame.lineTo(-1.72,2.05);gateFrame.quadraticCurveTo(0,4.0,1.72,2.05);gateFrame.lineTo(1.72,0);gateFrame.closePath();
  const gateOpening=new THREE.Path();
  gateOpening.moveTo(-1.12,0);gateOpening.lineTo(1.12,0);gateOpening.lineTo(1.12,1.75);gateOpening.quadraticCurveTo(0,3.18,-1.12,1.75);gateOpening.closePath();
  gateFrame.holes.push(gateOpening);
  const gateArch=new THREE.Mesh(new THREE.ShapeGeometry(gateFrame),wallTop);
  gateArch.position.set(0,.04,11.28);gateArch.material.side=THREE.DoubleSide;gateArch.castShadow=true;scene.add(gateArch);
  const gateShadowShape=new THREE.Shape();
  gateShadowShape.moveTo(-1.12,0);gateShadowShape.lineTo(1.12,0);gateShadowShape.lineTo(1.12,1.75);
  gateShadowShape.quadraticCurveTo(0,3.18,-1.12,1.75);gateShadowShape.closePath();
  const gateShadow=new THREE.Mesh(new THREE.ShapeGeometry(gateShadowShape),stoneDark);
  gateShadow.position.set(0,.045,11.29);gateShadow.material.side=THREE.DoubleSide;scene.add(gateShadow);
  const gateLintel=new THREE.Mesh(new THREE.BoxGeometry(3.75,.2,.78),gold);
  gateLintel.position.set(0,3.83,11.25);scene.add(gateLintel);

  function addTree(x,z,scale=1){
    const group=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13*scale,.2*scale,1.15*scale,8),wood);
    trunk.position.y=.58*scale;trunk.castShadow=true;group.add(trunk);
    const lower=new THREE.Mesh(new THREE.ConeGeometry(.88*scale,1.55*scale,9),leaf);
    lower.position.y=1.55*scale;lower.castShadow=true;group.add(lower);
    const upper=new THREE.Mesh(new THREE.ConeGeometry(.66*scale,1.32*scale,9),leafLight);
    upper.position.y=2.35*scale;upper.castShadow=true;group.add(upper);
    group.position.set(x,0,z);scene.add(group);
  }
  [[-13,-4,.9],[-12,6,.82],[-10,-10,1],[-6,-13,.86],[0,-14,.9],[7,-12,.85],[12,-7,.95],[14,1,.85],[12,8,.92],[8,12,.8],[-7,11,.88],[-13,2,.9]].forEach(([x,z,s])=>addTree(x,z,s));

  const rockGeometry=new THREE.DodecahedronGeometry(.48,0);
  [[-11,-8,.9],[12,-9,1.1],[-14,1,.8],[13,5,1],[-10,9,.9],[9,10,.75],[-5,-14,.8],[6,-14,1.05]].forEach(([x,z,s],i)=>{
    const rock=new THREE.Mesh(rockGeometry,rockMat);
    rock.position.set(x,.25*s,z);rock.scale.set(s,s*(.65+(i%3)*.12),s*1.15);
    rock.rotation.set(.1*i,.35*i,.08*i);rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  });
  const grassBladeGeometry=new THREE.ConeGeometry(.09,.38,5);
  for(let i=0;i<44;i++){
    const a=(i*2.399)%(Math.PI*2);
    if(Math.min(a,Math.PI*2-a)<.48)continue;
    const radius=12+(i%6)*.48,blade=new THREE.Mesh(grassBladeGeometry,i%2?grassDark:leafLight);
    blade.position.set(Math.sin(a)*radius,.18,Math.cos(a)*radius);
    blade.scale.set(.75+(i%3)*.18,.8+(i%4)*.12,.75);scene.add(blade);
  }

  const buildingsGroup=new THREE.Group();scene.add(buildingsGroup);
  let atlasTexture=null;
  const atlasDataUrl="/assets/user-buildings-atlas.png";
  let latestBuildings=[];
  const assetCells={center:0,school:1,barracks:2,market:3,stonemason:4,stable:6,blacksmith:7,mill:8,farm:9,temple:1,shelter:2,archery:2,workshop:7,lumberjack:4};
  const stoneWall=material(0xd7c39b,.94),stoneLight=material(0xe7d6b2,.9),stoneShade=material(0x9a805c,.96);
  const plaster=material(0xe2d0a8,.96),plasterWarm=material(0xcab28a,.95),roofTile=material(0x287e80,.5,.12);
  const roofDeep=material(0x185e64,.54,.1),doorWood=material(0x563923,.88),doorDark=material(0x172d29,.9);
  const windowDark=material(0x233b38,.72),bannerCloth=material(0x1c7777,.7),cropGreen=material(0x789b45,.9);
  function box(group,w,h,d,mat,x,y,z,cast=true){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function cylinder(group,top,bottom,h,segments,mat,x,y,z){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function addDome(group,radius,mat,x,y,z){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(radius,24,14,0,Math.PI*2,0,Math.PI/2),mat);
    dome.position.set(x,y,z);dome.scale.y=.88;dome.castShadow=true;dome.receiveShadow=true;group.add(dome);
    cylinder(group,radius*.98,radius*.98,.16,32,gold,x,y-.04,z);
    return dome;
  }
  function addArchDoor(group,width,height,x,y,z){
    const shape=new THREE.Shape();
    shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,height*.62);
    shape.quadraticCurveTo(0,height*1.18,-width/2,height*.62);shape.closePath();
    const door=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),doorDark);
    door.position.set(x,y,z);door.castShadow=true;group.add(door);
    box(group,.07,height*.62,.15,gold,x-width*.34,y+height*.3,z-.035,false);
    box(group,.07,height*.62,.15,gold,x+width*.34,y+height*.3,z-.035,false);
  }
  function addCornerTurret(group,x,z,scale=1){
    cylinder(group,.34*scale,.42*scale,.22*scale,12,stoneLight,x,.26*scale,z);
    cylinder(group,.27*scale,.34*scale,1.18*scale,12,plasterWarm,x,.92*scale,z);
    cylinder(group,.34*scale,.31*scale,.15*scale,12,gold,x,1.55*scale,z);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.38*scale,.62*scale,12),roofTile);
    roof.position.set(x,1.92*scale,z);roof.castShadow=true;group.add(roof);
    cylinder(group,.035*scale,.05*scale,.24*scale,8,gold,x,2.34*scale,z);
  }
  function addWindow(group,x,y,z){
    box(group,.28,.52,.08,windowDark,x,y,z,false);
    box(group,.36,.07,.1,gold,x,y+.28,z-.025,false);
  }
  function createCentralPalace(group){
    box(group,4.25,.32,4.0,stoneShade,0,.22,0);
    box(group,3.95,.18,3.72,stoneLight,0,.43,0);
    box(group,3.52,2.18,3.22,plasterWarm,0,1.58,0);
    box(group,3.7,.22,3.4,stoneLight,0,2.78,0);
    box(group,3.86,.12,3.56,gold,0,2.92,0,false);
    for(const x of [-1.48,1.48])for(const z of [-1.32,1.32])addCornerTurret(group,x,z,.88);
    addArchDoor(group,1.12,1.68,0,.48,1.63);
    for(const x of [-1.18,1.18]){addWindow(group,x,1.78,1.63);box(group,.08,.75,.1,gold,x,1.78,1.55,false);}
    cylinder(group,1.46,1.52,.32,32,stoneLight,0,3.05,0);
    addDome(group,1.42,roofTile,0,3.2,0);
    cylinder(group,.055,.075,.38,10,gold,0,4.55,0);
    const crescent=new THREE.Mesh(new THREE.TorusGeometry(.16,.035,8,24,Math.PI*1.65),gold);
    crescent.position.set(0,4.78,0);crescent.rotation.z=-.45;group.add(crescent);
    for(const x of [-1.45,1.45]){
      cylinder(group,.22,.27,1.15,12,plaster,x,3.42,.05);
      const mini=new THREE.Mesh(new THREE.ConeGeometry(.3,.55,12),roofDeep);
      mini.position.set(x,4.28,.05);mini.castShadow=true;group.add(mini);
    }
    for(let i=0;i<5;i++)box(group,.32,.13,.1,gold,-.64+i*.32,2.25,1.66,false);
  }
  function createTownBuilding(type,group){
    const dims={school:[2.25,1.8,2.05],temple:[2.35,2.15,2.2],barracks:[2.55,1.75,2.1],archery:[2.5,1.65,2.05],market:[2.45,1.55,2.0],stable:[2.55,1.65,2.2],blacksmith:[2.25,1.7,2.0],workshop:[2.35,1.65,2.0],stonemason:[2.2,1.55,1.95],lumberjack:[2.2,1.55,1.95],mill:[1.85,2.25,1.85],farm:[2.55,1.15,1.9],shelter:[2.0,1.45,1.8]};
    const [w,h,d]=dims[type]||[2.2,1.6,2];
    const wall=type==="temple"||type==="school"?plaster:plasterWarm;
    box(group,w+.22,.2,d+.22,stoneShade,0,.12,0);
    box(group,w,.13,d,stoneLight,0,.27,0);
    box(group,w,h,d,wall,0,.27+h/2,0);
    box(group,w+.12,.12,d+.12,stoneLight,0,.27+h,0);
    if(type==="temple"){
      cylinder(group,w*.48,w*.52,.28,20,stoneLight,0,.27+h+.12,0);
      addDome(group,w*.48,roofTile,0,.27+h+.26,0);
      cylinder(group,.045,.06,.24,8,gold,0,.27+h+1.22,0);
    }else if(type==="market"){
      const canopy=new THREE.Mesh(new THREE.ConeGeometry(w*.78,.68,4),bannerCloth);
      canopy.position.set(0,.27+h+.35,0);canopy.rotation.y=Math.PI/4;canopy.castShadow=true;group.add(canopy);
      box(group,w*.9,.08,d*.9,gold,0,.27+h+.05,0,false);
    }else if(type==="mill"){
      const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.72,.78,8),roofTile);
      roof.position.set(0,.27+h+.39,0);roof.castShadow=true;group.add(roof);
      cylinder(group,.08,.11,.48,10,wood,0,.27+h+.2,d*.52);
      for(let i=0;i<4;i++){const blade=box(group,.11,.95,.08,stoneLight,0,.27+h+.52,d*.52,false);blade.rotation.z=i*Math.PI/2;}
    }else if(type==="farm"||type==="stable"||type==="barracks"||type==="archery"||type==="shelter"){
      const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.78,.78,4),type==="shelter"?bannerCloth:roofTile);
      roof.position.set(0,.27+h+.36,0);roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
      if(type==="shelter")for(let i=0;i<3;i++)box(group,.045,h*.9,.05,gold,-.55+i*.55,.27+h*.48,d*.5,false);
    }else{
      const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.78,.72,4),roofTile);
      roof.position.set(0,.27+h+.34,0);roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
    }
    addArchDoor(group,.56,.92,0,.28,d/2+.055);
    addWindow(group,-w*.31,.27+h*.56,d/2+.06);addWindow(group,w*.31,.27+h*.56,d/2+.06);
    if(type==="blacksmith"||type==="workshop"){
      box(group,.36,.95,.38,stoneShade,w*.34,.27+h+.45,-d*.22);
      box(group,.43,.1,.44,stoneLight,w*.34,.27+h+.95,-d*.22);
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),material(0xe68b35,.45));
      glow.position.set(-w*.34,.58,d*.52);group.add(glow);
    }
    if(type==="market"){
      for(let i=0;i<3;i++)box(group,.42,.48,.42,wood,-.72+i*.72,.55,d*.62);
    }
    if(type==="farm"){
      for(let row=0;row<3;row++)for(let i=0;i<4;i++){
        const stalk=new THREE.Mesh(new THREE.ConeGeometry(.07,.34,5),cropGreen);
        stalk.position.set(-.8+i*.52,.36,.82+row*.16);stalk.castShadow=true;group.add(stalk);
      }
    }
    if(type==="archery"){
      for(let i=0;i<3;i++){const target=cylinder(group,.2,.2,.08,16,gold,-.8+i*.8,.55,-d*.62);target.rotation.x=Math.PI/2;}
    }
    if(type==="stable"){
      box(group,.16,.95,.12,wood,-.55,.78,d*.54,false);
      box(group,.16,.95,.12,wood,.55,.78,d*.54,false);
    }
    if(type==="stonemason"||type==="lumberjack"){
      for(let i=0;i<3;i++){const pile=new THREE.Mesh(new THREE.DodecahedronGeometry(.22,0),type==="stonemason"?stoneShade:wood);pile.position.set(-.65+i*.58,.35,-d*.62);pile.castShadow=true;group.add(pile);}
    }
    if(type==="school"){
      for(const x of [-.7,.7])cylinder(group,.12,.14,1.55,10,stoneLight,x,1.04,d*.52);
      const bell=new THREE.Mesh(new THREE.ConeGeometry(.16,.28,8),gold);bell.position.set(0,.27+h+.3,0);group.add(bell);
    }
  }
  function addBuildingModel(type,x,z){
    const group=new THREE.Group();group.position.set(x,0,z);group.userData.buildingType=type;
    const radius=type==="center"?2.5:1.18;
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(radius*1.55,40),new THREE.MeshBasicMaterial({color:0x241d13,transparent:true,opacity:.24,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.renderOrder=2;group.add(shadow);
    if(type==="center")createCentralPalace(group);else createTownBuilding(type,group);
    const trim=new THREE.Mesh(new THREE.TorusGeometry(radius*.9,.045,8,48),gold);
    trim.rotation.x=Math.PI/2;trim.position.y=.34;group.add(trim);
    group.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    buildingsGroup.add(group);return group;
  }
  function disposeGroup(group){
    group.traverse(node=>{
      if(node.geometry)node.geometry.dispose();
      if(node.material){
        const mats=Array.isArray(node.material)?node.material:[node.material];
        mats.forEach(mat=>{if(mat.map)mat.map.dispose();mat.dispose();});
      }
    });
  }
  function renderBuildings(){
    while(buildingsGroup.children.length){
      const child=buildingsGroup.children[0];buildingsGroup.remove(child);disposeGroup(child);
    }
    addBuildingModel("center",0,0);
    latestBuildings.filter(b=>b.type!=="center").slice(0,9).forEach((building,index)=>{
      const explicit=Number(building.slotIndex),slot=Number.isInteger(explicit)&&explicit>=1&&explicit<=9?explicit-1:index;
      const type=String(building.type||""),anchor=buildAnchors[slot];
      if(!anchor||!assetCells.hasOwnProperty(type))return;
      addBuildingModel(type,anchor[0],anchor[1]);
    });
  }
  function projectedBuildSlots(){
    camera.updateMatrixWorld();camera.updateProjectionMatrix();
    return buildPadPositions.map(([x,z])=>{
      const p=new THREE.Vector3(x,.42,z).project(camera);
      return {x:(p.x*.5+.5)*100,y:(.5-p.y*.5)*100};
    });
  }
  function projectedCenterPosition(){
    camera.updateMatrixWorld();camera.updateProjectionMatrix();
    const p=new THREE.Vector3(0,.32,0).project(camera);
    return {x:(p.x*.5+.5)*100,y:(.5-p.y*.5)*100+3.5};
  }

  const cameraTarget=new THREE.Vector3(0,1.45,0);
  let orbitTheta=.42,orbitPhi=.92,cameraRadius=34;
  function applyCamera(){
    const sinPhi=Math.sin(orbitPhi);
    camera.position.set(cameraTarget.x+cameraRadius*sinPhi*Math.sin(orbitTheta),cameraTarget.y+cameraRadius*Math.cos(orbitPhi),cameraTarget.z+cameraRadius*sinPhi*Math.cos(orbitTheta));
    camera.lookAt(cameraTarget);camera.updateMatrixWorld();camera.updateProjectionMatrix();
    window.dispatchEvent(new Event("umaykut3dcamera"));
  }
  function resetCamera(){
    orbitTheta=.42;orbitPhi=.92;
    cameraRadius=(canvas.clientWidth/(canvas.clientHeight||1))<.78?48:34;applyCamera();
  }
  async function loadUserImages(){
    atlasTexture=await new THREE.TextureLoader().loadAsync(atlasDataUrl);
    atlasTexture.colorSpace=THREE.SRGBColorSpace;
    atlasTexture.magFilter=THREE.LinearFilter;
    atlasTexture.minFilter=THREE.LinearMipmapLinearFilter;
    renderBuildings();
    window.umaykut3d={
      getSlotPositions(){return projectedBuildSlots();},
      getCenterPosition(){return projectedCenterPosition();},
      setBuildings(buildings){latestBuildings=Array.isArray(buildings)?buildings:[];renderBuildings();},
      getBuildingPreview(type){const index=assetCells[type];return index===undefined?null:{src:atlasDataUrl,col:index%5,row:Math.floor(index/5)};},
      zoomIn(){cameraRadius=Math.max(36,cameraRadius-2.5);applyCamera();},
      zoomOut(){cameraRadius=Math.min(62,cameraRadius+2.5);applyCamera();},
      resetCamera
    };
    document.getElementById("village")?.classList.add("has-3d-village");
    window.dispatchEvent(new Event("umaykut3dready"));
  }
  function resize(){
    const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||520,aspect=w/h;
    renderer.setSize(w,h,false);camera.aspect=aspect;camera.fov=aspect<.78?54:38;
    cameraRadius=aspect<.78?48:34;applyCamera();
  }
  if("ResizeObserver" in window)new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize",resize);
  resize();

  canvas.style.touchAction="none";
  const pointers=new Map();
  let dragPoint=null,lastPinch=0;
  const pinchDistance=()=>{
    const p=[...pointers.values()];
    return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  };
  canvas.addEventListener("pointerdown",event=>{
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    if(pointers.size===1)dragPoint={x:event.clientX,y:event.clientY};
    else{dragPoint=null;lastPinch=pinchDistance();}
  });
  canvas.addEventListener("pointermove",event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1&&dragPoint){
      const dx=event.clientX-dragPoint.x,dy=event.clientY-dragPoint.y;
      orbitTheta-=dx*.0065;orbitPhi=Math.max(.62,Math.min(1.24,orbitPhi+dy*.0045));
      dragPoint={x:event.clientX,y:event.clientY};applyCamera();
    }else if(pointers.size>=2){
      const next=pinchDistance();
      if(lastPinch>0&&next>0){cameraRadius=Math.max(36,Math.min(62,cameraRadius-(next-lastPinch)*.045));applyCamera();}
      lastPinch=next;
    }
  });
  const release=event=>{
    pointers.delete(event.pointerId);
    if(pointers.size===1){const p=[...pointers.values()][0];dragPoint={x:p.x,y:p.y};}
    else dragPoint=null;
    lastPinch=pinchDistance();
  };
  canvas.addEventListener("pointerup",release);
  canvas.addEventListener("pointercancel",release);
  canvas.addEventListener("wheel",event=>{
    event.preventDefault();event.stopPropagation();
    cameraRadius=Math.max(36,Math.min(62,cameraRadius*Math.exp(event.deltaY*.001)));applyCamera();
  },{passive:false});

  let frame=0;
  function animate(){
    requestAnimationFrame(animate);frame+=.003;
    sun.position.x=-10+Math.sin(frame)*1.2;renderer.render(scene,camera);
  }
  animate();
  loadUserImages().catch(error=>console.error("Kullanıcı bina görselleri yüklenemedi; 2D köy görünümü korunuyor:",error));
  window.addEventListener("orientationchange",resize);
}
