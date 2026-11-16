(() => {
"use strict";
const canvas=document.getElementById("village2dCanvas");
if(!canvas)return;
const ctx=canvas.getContext("2d",{alpha:false});
let W=0,H=0,D=1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function poly(p,fill,stroke="#0000",lw=1){
 ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke!=="#0000"){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
}
function oval(x,y,rx,ry,fill,stroke="#0000",lw=1){
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
 if(stroke!=="#0000"){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
}
function line(points,color,width){
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
}
function tree(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,7,18,6,"#263b21aa");
 poly([[-4,8],[-3,-23],[4,-23],[5,8]],"#76502e","#50371f",1);
 oval(-8,-25,15,16,"#2d5835","#1c4028",2);
 oval(8,-32,16,18,"#477b3d","#28502e",2);
 oval(0,-43,13,16,"#63934b","#315c36",1.5);
 oval(-5,-48,4,4,"#c1d17b");
 ctx.restore();
}
function shrub(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,4,14,5,"#263d22aa");oval(-7,-3,9,8,"#527c39","#31562c",1);
 oval(5,-6,10,9,"#6d9649","#365d31",1);ctx.restore();
}
function stone(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,4,14,5,"#293b20aa");
 poly([[-13,2],[-10,-10],[-2,-18],[10,-14],[15,0]],"#92927b","#5b624f",1.5);
 poly([[-10,-10],[-2,-18],[10,-14],[2,-7]],"#c2c1a2");ctx.restore();
}
function tower(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,5,19,7,"#24362288");
 poly([[-17,-3],[-14,-25],[0,-35],[14,-25],[17,-3],[0,7]],"#b7a17a","#594a32",2);
 poly([[-17,-25],[0,-37],[17,-25],[0,-14]],"#dfcca0","#746044",1.5);
 poly([[-8,-20],[0,-27],[8,-20],[8,-5],[-8,-5]],"#42615a","#d2bb83",1);
 poly([[-11,-29],[0,-44],[11,-29],[0,-23]],"#8a7048","#58452d",1.5);
 ctx.restore();
}
function ground(){
 const g=ctx.createLinearGradient(0,0,0,H);
 g.addColorStop(0,"#8fae59");g.addColorStop(.42,"#a9b968");g.addColorStop(1,"#668d45");
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // soft fields and natural ground patches
 for(let i=0;i<110;i++){
  const x=((i*83+17)%997)/997*W,y=((i*137+29)%991)/991*H;
  oval(x,y,8+(i%6)*4,3+(i%4)*2,i%3===0?"#e1d68b40":"#355b2b24");
 }
 // cultivated land beyond the walls
 for(let side of [-1,1]){
  ctx.save();ctx.translate(W*.5+side*W*.42,H*.53);
  for(let i=0;i<7;i++)line([[-W*.08,-H*.12+i*H*.035],[0,-H*.09+i*H*.035],[W*.07,-H*.12+i*H*.035]],"#d8c27a88",2);
  ctx.restore();
 }
 // outer tree line, deliberately outside the rampart
 [[.08,.18,.9],[.18,.11,.8],[.34,.08,.75],[.67,.08,.75],[.84,.13,.9],[.94,.22,.8],[.08,.79,.85],[.15,.91,.9],[.86,.88,.9],[.95,.76,.8],[.32,.94,.7],[.69,.94,.75]]
 .forEach(([x,y,s])=>tree(W*x,H*y,s));
 [[.04,.39],[.95,.43],[.09,.68],[.91,.68],[.28,.1],[.72,.1],[.26,.91],[.76,.92]].forEach(([x,y],i)=>stone(W*x,H*y,.55+(i%3)*.15));
}
function roads(){
 const cx=W*.5,cy=H*.515,rx=W*.405,ry=H*.345;
 // wide radial cobblestone avenues between central square and residential plots
 const ends=[[.5,.20],[.78,.31],[.88,.49],[.78,.69],[.5,.82],[.22,.69],[.12,.49],[.22,.31]];
 ends.forEach(([ex,ey],i)=>{
  const tx=W*ex,ty=H*ey;
  line([[cx,cy],[cx+(tx-cx)*.38,cy+(ty-cy)*.38],[tx,ty]],"#9a8358",Math.max(16,W*.035));
  line([[cx,cy],[cx+(tx-cx)*.38,cy+(ty-cy)*.38],[tx,ty]],"#e2d0a0",Math.max(10,W*.023));
  line([[cx,cy],[cx+(tx-cx)*.38,cy+(ty-cy)*.38],[tx,ty]],"#f1e3bd55",2);
 });
 // paved central circular plaza
 oval(cx,cy,W*.155,H*.104,"#756348");
 oval(cx,cy-3,W*.15,H*.099,"#c6b17f","#6e5b3e",3);
 oval(cx,cy-5,W*.132,H*.083,"#ddc995","#f0dfb2",2);
 oval(cx,cy-7,W*.112,H*.067,"#b6a06e","#8c744b",2);
 // stone paving on central plaza
 for(let i=0;i<28;i++){
  const a=i*Math.PI*2/28;
  const x=cx+Math.cos(a)*W*.12,y=cy-7+Math.sin(a)*H*.058;
  oval(x,y,3,2,"#6e6048aa");
 }
}
function walls(){
 const x=W*.5,y=H*.515,rx=W*.455,ry=H*.405;
 // shadow and outer berm
 oval(x,y+12,rx+9,ry+10,"#24391faa");
 oval(x,y+3,rx+3,ry+3,"#8e7952","#55442d",2);
 // rear rampart, thick stone masonry
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#55452f";ctx.lineWidth=Math.max(30,W*.075);ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,y-7,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#d7c69b";ctx.lineWidth=Math.max(22,W*.055);ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,y-8,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#8c7954";ctx.lineWidth=Math.max(7,W*.018);ctx.stroke();
 // foreground wall segments with a grand southern gate opening
 for(const [a,b] of [[0,Math.PI/2-.18],[Math.PI/2+.18,Math.PI]]){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,a,b);
  ctx.strokeStyle="#55432d";ctx.lineWidth=Math.max(31,W*.078);ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y-7,rx,ry,0,a,b);
  ctx.strokeStyle="#d3c095";ctx.lineWidth=Math.max(21,W*.053);ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y-8,rx,ry,0,a,b);
  ctx.strokeStyle="#8d7954";ctx.lineWidth=Math.max(7,W*.017);ctx.stroke();
 }
 // crenellations and evenly spaced defensive towers
 for(let i=0;i<42;i++){
  const a=2*Math.PI*i/42;
  if(Math.sin(a)>.42&&Math.abs(Math.cos(a))<.22)continue;
  const tx=x+Math.cos(a)*rx,ty=y+Math.sin(a)*ry;
  poly([[tx-5,ty-16],[tx+5,ty-16],[tx+5,ty-5],[tx-5,ty-5]],"#e2d1a5","#766344",1);
 }
 [[-.92,-.22,.9],[.92,-.22,.9],[-.62,-.78,.78],[.62,-.78,.78],[-.98,.42,.8],[.98,.42,.8]].forEach(([dx,dy,s])=>tower(x+rx*dx,y+ry*dy,s));
 // ornate gatehouse and arched opening
 const gy=y+ry*.88;
 oval(x,gy+20,W*.09,H*.025,"#26381f99");
 poly([[x-W*.095,gy-17],[x-W*.075,gy-48],[x,gy-73],[x+W*.075,gy-48],[x+W*.095,gy-17]],"#bda77c","#5a4931",3);
 poly([[x-W*.08,gy-27],[x-W*.06,gy-53],[x,gy-70],[x+W*.06,gy-53],[x+W*.08,gy-27]],"#dfcea3","#806a47",2);
 boxGate(x,gy-44,W*.043,56);
 // road leading out from the gate
 line([[x,gy+8],[x,H*1.02]],"#a48d60",Math.max(25,W*.065));
 line([[x,gy+8],[x,H*1.02]],"#dfc99a",Math.max(16,W*.041));
}
function boxGate(x,y,w,h){
 ctx.beginPath();ctx.moveTo(x-w/2,y+h/2);ctx.lineTo(x-w/2,y);ctx.arc(x,y,w/2,Math.PI,0);ctx.lineTo(x+w/2,y+h/2);ctx.closePath();
 ctx.fillStyle="#35291d";ctx.fill();ctx.strokeStyle="#f0d7a1";ctx.lineWidth=3;ctx.stroke();
 ctx.beginPath();ctx.moveTo(x,y+7);ctx.lineTo(x,y+h/2);ctx.strokeStyle="#b8995f";ctx.lineWidth=2;ctx.stroke();
}
function render(){
 if(!W||!H)return;
 ground();roads();walls();
 const shade=ctx.createRadialGradient(W*.5,H*.5,H*.12,W*.5,H*.5,W*.75);
 shade.addColorStop(.52,"#18220e00");shade.addColorStop(1,"#17240e55");
 ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
}
function resize(){
 const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
 D=clamp(devicePixelRatio||1,1,2);W=r.width;H=r.height;
 canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);
 ctx.setTransform(D,0,0,D,0,0);render();
}
if("ResizeObserver" in window)new ResizeObserver(resize).observe(canvas);
else window.addEventListener("resize",resize);
resize();
window.dispatchEvent(new Event("umaykut2dready"));
})();