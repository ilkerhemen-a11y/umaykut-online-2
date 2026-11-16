import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const canvas=document.getElementById("village3dCanvas");
if(canvas){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9bb8c8);
  scene.fog=new THREE.Fog(0x9bb8c8,34,62);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;

  scene.add(new THREE.HemisphereLight(0xf4f0dc,0x536044,2.1));
  const sun=new THREE.DirectionalLight(0xffe2ac,2.8);
  sun.position.set(-10,18,12);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  scene.add(sun);

  const material=(color,roughness=.9,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const grass=material(0x78964d);
  const courtyard=material(0xb8a27d);
  const paving=material(0xd4c19a);
  const padStone=material(0xc8b48c);
  const padGold=material(0xd9ad4d,.4,.3);
  const pathStone=material(0xa99570);

  const ground=new THREE.Mesh(new THREE.CylinderGeometry(14.5,14.8,.7,80),grass);
  ground.position.y=-.42;
  ground.receiveShadow=true;
  scene.add(ground);
  const yard=new THREE.Mesh(new THREE.CylinderGeometry(9.2,9.5,.12,80),courtyard);
  yard.position.y=.02;
  yard.receiveShadow=true;
  scene.add(yard);

  // The nine construction foundations remain interactive and are projected onto the mobile HUD.
  const buildPadPositions=[[-4.8,-6.0],[0,-7.3],[4.8,-6.0],[7.1,-2.0],[7.1,3.0],[2.8,6.6],[-2.8,6.6],[-7.1,3.0],[-7.1,-2.0]];
  const buildAnchors=buildPadPositions;
  const padGroup=new THREE.Group();
  scene.add(padGroup);
  buildPadPositions.forEach(([x,z])=>{
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.2,.2,36),padStone);
    base.position.set(x,.17,z);base.castShadow=true;base.receiveShadow=true;padGroup.add(base);
    const inset=new THREE.Mesh(new THREE.CylinderGeometry(.98,.98,.035,36),courtyard);
    inset.position.set(x,.29,z);padGroup.add(inset);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.05,.075,8,40),padGold);
    rim.rotation.x=Math.PI/2;rim.position.set(x,.32,z);padGroup.add(rim);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      const block=new THREE.Mesh(new THREE.BoxGeometry(.14,.07,.12),paving);
      block.position.set(x+Math.cos(a)*1.07,.34,z+Math.sin(a)*1.07);
      block.rotation.y=-a;padGroup.add(block);
    }
  });

  // A short stone approach keeps the centre building visually dominant.
  for(let i=0;i<12;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.72,.07,.42),i%2?paving:pathStone);
    p.position.set(0,.12,8.1-i*.62);p.receiveShadow=true;scene.add(p);
  }

  const buildingsGroup=new THREE.Group();
  scene.add(buildingsGroup);
  let atlasTexture=null;
  let atlasDataUrl=null;
  let latestBuildings=[];
  const assetCells={
    center:0,
    school:1,
    barracks:2,
    market:3,
    stonemason:4,
    stable:6,
    blacksmith:7,
    mill:8,
    farm:9
  };
  const assetAspect={
    center:.91,school:1.08,barracks:1.23,market:1.56,stonemason:1.83,
    wall:2.14,stable:1.67,blacksmith:1.33,mill:.78,farm:1.56
  };
  const displayHeight={center:5.4,school:3.55,barracks:3.7,market:3.1,stonemason:2.85,stable:3.0,blacksmith:3.1,mill:3.8,farm:2.65};

  function cellTexture(index){
    const texture=atlasTexture.clone();
    const col=index%5,row=Math.floor(index/5);
    texture.repeat.set(.2,.5);
    texture.offset.set(col*.2,row===0?.5:0);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    return texture;
  }
  function imageSprite(index,type,x,z,height,group){
    if(!atlasTexture)return null;
    const texture=cellTexture(index);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
      map:texture,transparent:true,alphaTest:.025,depthWrite:false
    }));
    const aspect=assetAspect[type]||1.2;
    sprite.scale.set(height*aspect,height,1);
    sprite.position.set(x,height/2+.02,z);
    sprite.renderOrder=3;
    sprite.userData.buildingType=type;
    group.add(sprite);
    return sprite;
  }
  function renderBuildings(){
    while(buildingsGroup.children.length){
      const child=buildingsGroup.children.pop();
      if(child.material?.map)child.material.map.dispose();
      if(child.material)child.material.dispose();
    }
    if(!atlasTexture)return;
    const center=latestBuildings.find(b=>b.type==="center");
    imageSprite(0,"center",0,0,displayHeight.center,buildingsGroup);
    // The user's own long Seljuk wall image forms the rear entrance wall.
    imageSprite(5,"wall",0,-10.2,4.25,buildingsGroup);
    latestBuildings.filter(b=>b.type!=="center").slice(0,9).forEach((building,index)=>{
      const explicit=Number(building.slotIndex);
      const slot=Number.isInteger(explicit)&&explicit>=1&&explicit<=9?explicit-1:index;
      const type=String(building.type||"");
      const cell=assetCells[type];
      if(cell===undefined)return;
      const [x,z]=buildAnchors[slot];
      imageSprite(cell,type,x,z,displayHeight[type]||3,buildingsGroup);
    });
  }

  function projectedBuildSlots(){
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return buildPadPositions.map(([x,z])=>{
      const p=new THREE.Vector3(x,.42,z).project(camera);
      return {x:(p.x*.5+.5)*100,y:(.5-p.y*.5)*100};
    });
  }

  window.umaykut3d={
    getSlotPositions(){return projectedBuildSlots();},
    setBuildings(buildings){latestBuildings=Array.isArray(buildings)?buildings:[];renderBuildings();},
    getBuildingPreview(type){
      const index=assetCells[type];
      if(index===undefined||!atlasDataUrl)return null;
      return {src:atlasDataUrl,col:index%5,row:Math.floor(index/5)};
    }
  };

  async function loadUserImages(){
    const response=await fetch("/assets/user-buildings-atlas.b64",{cache:"force-cache"});
    if(!response.ok)throw new Error("Kullanıcının bina görsel paketi yüklenemedi.");
    const encoded=(await response.text()).trim();
    const binary=atob(encoded);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const blob=new Blob([bytes],{type:"image/png"});
    atlasDataUrl=URL.createObjectURL(blob);
    atlasTexture=await new THREE.TextureLoader().loadAsync(atlasDataUrl);
    atlasTexture.colorSpace=THREE.SRGBColorSpace;
    atlasTexture.magFilter=THREE.LinearFilter;
    atlasTexture.minFilter=THREE.LinearMipmapLinearFilter;
    renderBuildings();
    document.getElementById("village")?.classList.add("has-3d-village");
    window.dispatchEvent(new Event("umaykut3dready"));
  }

  const cameraTarget=new THREE.Vector3(0,1.45,0);
  let orbitTheta=.42,orbitPhi=.92,cameraRadius=34;
  function applyCamera(){
    const sinPhi=Math.sin(orbitPhi);
    camera.position.set(
      cameraTarget.x+cameraRadius*sinPhi*Math.sin(orbitTheta),
      cameraTarget.y+cameraRadius*Math.cos(orbitPhi),
      cameraTarget.z+cameraRadius*sinPhi*Math.cos(orbitTheta)
    );
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    window.dispatchEvent(new Event("umaykut3dcamera"));
  }
  function resize(){
    const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||520,aspect=w/h;
    renderer.setSize(w,h,false);
    camera.aspect=aspect;
    if(aspect<.78){camera.fov=48;cameraRadius=35;orbitTheta=.42;orbitPhi=.92;}
    else{camera.fov=37;cameraRadius=32;orbitTheta=.48;orbitPhi=.9;}
    applyCamera();
  }
  new ResizeObserver(resize).observe(canvas);
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
      orbitTheta-=dx*.0065;
      orbitPhi=Math.max(.62,Math.min(1.24,orbitPhi+dy*.0045));
      dragPoint={x:event.clientX,y:event.clientY};
      applyCamera();
    }else if(pointers.size>=2){
      const next=pinchDistance();
      if(lastPinch>0&&next>0){
        cameraRadius=Math.max(25,Math.min(48,cameraRadius-(next-lastPinch)*.045));
        applyCamera();
      }
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
    event.preventDefault();
    cameraRadius=Math.max(25,Math.min(48,cameraRadius*Math.exp(event.deltaY*.001)));
    applyCamera();
  },{passive:false});

  let frame=0;
  function animate(){
    requestAnimationFrame(animate);
    frame+=.003;
    sun.position.x=-10+Math.sin(frame)*1.2;
    renderer.render(scene,camera);
  }
  animate();
  loadUserImages().catch(error=>{
    console.error("Kullanıcı bina görselleri yüklenemedi:",error);
  });
  window.addEventListener("orientationchange",resize);
}
