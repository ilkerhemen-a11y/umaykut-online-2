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
  const gateShadow=new THREE.Mesh(new THREE.ShapeGeometry(gateOpening),stoneDark);
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
  const assetCells={center:0,school:1,barracks:2,market:3,stonemason:4,stable:6,blacksmith:7,mill:8,farm:9};
  const assetAspect={center:.91,school:1.08,barracks:1.23,market:1.56,stonemason:1.83,stable:1.67,blacksmith:1.33,mill:.78,farm:1.56};
  const displayHeight={center:7,school:3.55,barracks:3.7,market:3.1,stonemason:2.85,stable:3,blacksmith:3.1,mill:3.8,farm:2.65};
  function cellTexture(index){
    const texture=atlasTexture.clone(),col=index%5,row=Math.floor(index/5);
    texture.repeat.set(.2,.5);texture.offset.set(col*.2,row===0?.5:0);
    texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
  }
  function imageSprite(index,type,x,z,height,group,baseY=.36){
    if(!atlasTexture)return null;
    const texture=cellTexture(index);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false}));
    sprite.scale.set(height*(assetAspect[type]||1.2),height,1);
    sprite.position.set(x,baseY+height/2,z);sprite.renderOrder=3;sprite.userData.buildingType=type;
    group.add(sprite);return sprite;
  }
  function renderBuildings(){
    while(buildingsGroup.children.length){
      const child=buildingsGroup.children.pop();
      if(child.material?.map)child.material.map.dispose();
      if(child.material)child.material.dispose();
    }
    if(!atlasTexture)return;
    imageSprite(0,"center",0,0,displayHeight.center,buildingsGroup,.34);
    latestBuildings.filter(b=>b.type!=="center").slice(0,9).forEach((building,index)=>{
      const explicit=Number(building.slotIndex),slot=Number.isInteger(explicit)&&explicit>=1&&explicit<=9?explicit-1:index;
      const type=String(building.type||""),cell=assetCells[type],anchor=buildAnchors[slot];
      if(cell===undefined||!anchor)return;
      imageSprite(cell,type,anchor[0],anchor[1],displayHeight[type]||3,buildingsGroup,.38);
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
    cameraRadius=(canvas.clientWidth/(canvas.clientHeight||1))<.78?35:30;applyCamera();
  }
  window.umaykut3d={
    getSlotPositions(){return projectedBuildSlots();},
    getCenterPosition(){return projectedCenterPosition();},
    setBuildings(buildings){latestBuildings=Array.isArray(buildings)?buildings:[];renderBuildings();},
    getBuildingPreview(type){const index=assetCells[type];return index===undefined?null:{src:atlasDataUrl,col:index%5,row:Math.floor(index/5)};},
    zoomIn(){cameraRadius=Math.max(24,cameraRadius-2.5);applyCamera();},
    zoomOut(){cameraRadius=Math.min(45,cameraRadius+2.5);applyCamera();},
    resetCamera
  };

  async function loadUserImages(){
    atlasTexture=await new THREE.TextureLoader().loadAsync(atlasDataUrl);
    atlasTexture.colorSpace=THREE.SRGBColorSpace;
    atlasTexture.magFilter=THREE.LinearFilter;
    atlasTexture.minFilter=THREE.LinearMipmapLinearFilter;
    renderBuildings();
    document.getElementById("village")?.classList.add("has-3d-village");
    window.dispatchEvent(new Event("umaykut3dready"));
  }
  function resize(){
    const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||520,aspect=w/h;
    renderer.setSize(w,h,false);camera.aspect=aspect;camera.fov=aspect<.78?48:35;
    cameraRadius=aspect<.78?35:30;applyCamera();
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
      if(lastPinch>0&&next>0){cameraRadius=Math.max(24,Math.min(45,cameraRadius-(next-lastPinch)*.045));applyCamera();}
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
    cameraRadius=Math.max(24,Math.min(45,cameraRadius*Math.exp(event.deltaY*.001)));applyCamera();
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
