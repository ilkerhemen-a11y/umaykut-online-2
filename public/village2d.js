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
function box(x,y,w,h,r,fill,stroke="#0000"){
 ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
 if(stroke!=="#0000"){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function tree(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,5,14,5,"#1d3329aa");
 poly([[-3,2],[-2,-20],[3,-20],[4,2]],"#69472b");
 oval(-6,-21,11,13,"#315c35","#24472b",1.5);
 oval(6,-26,12,14,"#477b3e","#294d2e",1.5);
 oval(0,-35,10,12,"#5c8b45","#315b35",1.2);
 oval(-4,-39,3,3,"#b3c777");
 ctx.restore();
}
function bush(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 oval(0,2,10,4,"#233d24aa");oval(-5,-3,7,6,"#47733a","#2c522d");
 oval(3,-5,8,7,"#5d8943","#315b32");ctx.restore();
}
function tower(x,y,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 poly([[-16,0],[0,-9],[16,0],[0,10]],"#b9a47c","#65543c",1);
 poly([[-12,-3],[-12,-30],[0,-38],[12,-30],[12,-3],[0,5]],"#b5a078","#65543c",1.2);
 poly([[-12,-30],[0,-40],[12,-30],[0,-22]],"#d6c59c","#6a573b",1);
 box(-3,-23,6,11,2,"#51432e");ctx.restore();
}
function ground(){
 const bg=ctx.createLinearGradient(0,0,0,H);
 bg.addColorStop(0,"#a4bf72");bg.addColorStop(.48,"#779d4d");bg.addColorStop(1,"#466e39");
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 for(let i=0;i<130;i++){
  const x=((i*83)%997)/997*W,y=((i*137+31)%991)/991*H;
  oval(x,y,8+(i%5)*3,3+(i%4)*2,i%3===0?"#d1d98a42":"#294d2c26");
 }
 // hand-laid stone courtyard, in isometric diamond courses
 ctx.save();ctx.translate(W*.5,H*.51);
 for(let r=-8;r<=8;r++)for(let c=-9;c<=9;c++){
  const x=(c-r)*W*.026,y=(c+r)*H*.017;
  if(Math.abs(x)>W*.39||Math.abs(y)>H*.33)continue;
  const shades=["#c4b17b36","#e2d09a28","#5a74422a","#d6c18a2d","#8c9a5c2b"];
  const n=((r*7+c*11)%5+5)%5;
  poly([[x,y-7],[x+W*.026,y],[x,y+7],[x-W*.026,y]],shades[n],"#71634222",.5);
 }
 ctx.restore();
 // roads to the keep and the entrance
 ctx.lineCap="round";ctx.lineJoin="round";
 ctx.beginPath();ctx.moveTo(W*.5,H*1.03);ctx.bezierCurveTo(W*.47,H*.83,W*.52,H*.68,W*.5,H*.51);
 ctx.strokeStyle="#9d855d";ctx.lineWidth=Math.max(24,W*.078);ctx.stroke();
 ctx.strokeStyle="#d5c398";ctx.lineWidth=Math.max(16,W*.052);ctx.stroke();
 ctx.beginPath();ctx.moveTo(W*.5,H*.53);ctx.bezierCurveTo(W*.32,H*.5,W*.24,H*.4,W*.1,H*.35);
 ctx.strokeStyle="#ad956a";ctx.lineWidth=Math.max(14,W*.045);ctx.stroke();
 ctx.beginPath();ctx.moveTo(W*.5,H*.53);ctx.bezierCurveTo(W*.68,H*.5,W*.76,H*.4,W*.9,H*.35);ctx.stroke();
 // cultivated strips outside the central ring
 for(const side of [-1,1]){
  const x=W*(side<0?.12:.88),y=H*.52;
  ctx.save();ctx.translate(x,y);
  for(let i=0;i<5;i++){
   box(-W*.045+i*2,-H*.055+i*H*.004,W*.09,6,3,i%2?"#9b8a4d":"#b9a15e","#76653d");
  }
  for(let i=0;i<5;i++)bush((i-2)*W*.018,H*.07+(i%2)*5,.7);
  ctx.restore();
 }
}
function walls(){
 const x=W*.5,y=H*.51,rx=W*.405,ry=H*.315;
 oval(x,y+8,rx+6,ry+6,"#1d3325aa");
 // far rampart
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#594a35";ctx.lineWidth=Math.max(20,W*.052);ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,y-4,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#d2c29a";ctx.lineWidth=Math.max(13,W*.034);ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,y-5,rx,ry,0,Math.PI,Math.PI*2);
 ctx.strokeStyle="#8d7954";ctx.lineWidth=Math.max(5,W*.012);ctx.stroke();
 // near wall, with a broad southern gate
 for(const [a,b] of [[0,Math.PI/2-.2],[Math.PI/2+.2,Math.PI]]){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,a,b);
  ctx.strokeStyle="#514431";ctx.lineWidth=Math.max(21,W*.054);ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y-5,rx,ry,0,a,b);
  ctx.strokeStyle="#c8b68c";ctx.lineWidth=Math.max(13,W*.033);ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y-6,rx,ry,0,a,b);
  ctx.strokeStyle="#8e7a55";ctx.lineWidth=Math.max(4,W*.011);ctx.stroke();
 }
 for(let i=0;i<32;i++){
  const a=2*Math.PI*i/32,tx=x+Math.cos(a)*rx,ty=y+Math.sin(a)*ry;
  if(Math.sin(a)>0&&Math.abs(Math.cos(a))<.17)continue;
  box(tx-4,ty-14,8,12,2,"#d2c19a","#756447");
 }
  tower(x-rx*.96,y-ry*.1,.95);tower(x+rx*.96,y-ry*.1,.95);
 tower(x-rx*.58,y-ry*.82,.82);tower(x+rx*.58,y-ry*.82,.82);
}
function details(){
 // Broad stone dais directly beneath the central Seljuk keep.
 oval(W*.5,H*.535,W*.155,H*.082,"#17291e88");
 oval(W*.5,H*.525,W*.15,H*.075,"#9b8a68","#554a35",2);
 oval(W*.5,H*.516,W*.128,H*.06,"#c7b58b","#e2d2a8",2);
 oval(W*.5,H*.51,W*.105,H*.047,"#8d9a6b","#6b7952",1);
 [[.07,.22,.9],[.15,.15,.72],[.92,.2,.85],[.84,.14,.7],[.07,.8,.8],[.92,.78,.9],[.18,.89,.68],[.82,.89,.7],[.29,.15,.55],[.72,.15,.58]]
 .forEach(([x,y,s])=>tree(W*x,H*y,s));
 [[.2,.4],[.8,.4],[.18,.58],[.82,.58],[.34,.83],[.66,.83],[.27,.22],[.73,.22]]
 .forEach(([x,y],i)=>bush(W*x,H*y,.7+(i%3)*.1));
}
function render(){
 if(!W||!H)return;
 ground();walls();details();
 const shade=ctx.createRadialGradient(W*.5,H*.48,H*.12,W*.5,H*.5,W*.72);
 shade.addColorStop(.45,"#101b0c00");shade.addColorStop(1,"#101b0c55");
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