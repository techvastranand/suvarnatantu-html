const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const body = document.body;
const pre = document.getElementById('preloader');
const dismissPreloader = () => { if (pre) pre.classList.add('hide'); };
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(dismissPreloader, 650);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(dismissPreloader, 650), {once:true});
  window.addEventListener('load', () => setTimeout(dismissPreloader, 650), {once:true});
}
setTimeout(dismissPreloader, 1600);

/* custom cursor */
const cur=document.querySelector('.cursor'), dot=document.querySelector('.cursor-dot');
let cx=0,cy=0,tx=0,ty=0;
addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;if(dot){dot.style.left=tx+'px';dot.style.top=ty+'px'}});
function cursorTick(){cx+=(tx-cx)*.16;cy+=(ty-cy)*.16;if(cur){cur.style.left=cx+'px';cur.style.top=cy+'px'}requestAnimationFrame(cursorTick)} cursorTick();
document.querySelectorAll('.hoverable').forEach(el=>{el.addEventListener('mouseenter',()=>body.classList.add('is-hover'));el.addEventListener('mouseleave',()=>body.classList.remove('is-hover'))});

/* reveals */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on')}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* progress + rail */
const progress=document.getElementById('progress'), railFill=document.getElementById('railFill'), railNum=document.getElementById('railNum');
const sections=[...document.querySelectorAll('[data-index]')];
function updateGlobal(){
  const h=document.documentElement.scrollHeight-innerHeight,p=Math.max(0,Math.min(1,scrollY/Math.max(1,h)));
  progress.style.width=(p*100)+'%';railFill.style.height=(p*100)+'%';
  let current='01';
  sections.forEach(s=>{const r=s.getBoundingClientRect();if(r.top<innerHeight*.45)current=s.dataset.index});
  railNum.textContent=current;
}
addEventListener('scroll',updateGlobal,{passive:true});updateGlobal();

/* canvas util */
function setup(c){
 if(!c) return null;
 const d=Math.min(window.devicePixelRatio||1,1.7),r=c.getBoundingClientRect();
 c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);
 const x=c.getContext('2d'); if(!x) return null;
 x.setTransform(d,0,0,d,0,0);return{x,w:r.width,h:r.height}
}

/* hero responsive filament field */
let heroState,mouseX=.55,mouseY=.42;
addEventListener('pointermove',e=>{mouseX=e.clientX/innerWidth;mouseY=e.clientY/innerHeight},{passive:true});
function drawHero(t){
 const c=document.getElementById('heroThreads'); if(!heroState)heroState=setup(c); if(!heroState)return;
 const{x,w,h}=heroState;x.clearRect(0,0,w,h);
 const par=scrollY/Math.max(1,innerHeight);
 for(let j=0;j<15;j++){
  x.beginPath();
  for(let px=-40;px<w+40;px+=7){
   const u=px*.012+t*.00055+j*.25;
   const y=h*(.46+(mouseY-.5)*.18)+Math.sin(u)*64+Math.sin(u*.31)*20+(j-7)*6+(mouseX-.5)*42+par*20;
   if(px===-40)x.moveTo(px,y);else x.lineTo(px,y);
  }
  x.strokeStyle=`rgba(216,174,91,${.025+j*.022})`;x.lineWidth=j===7?2.2:1;x.stroke();
 }
}

/* hero image parallax */
const heroPhoto=document.getElementById('heroPhoto');
function updateHeroParallax(){
 const home=document.getElementById('home'); if(!home || !heroPhoto)return;
 const rect=home.getBoundingClientRect();
 const p=Math.max(0,Math.min(1,-rect.top/innerHeight));
 heroPhoto.style.transform=`scale(1.06) translate3d(${(mouseX-.5)*-12}px,${-p*26+(mouseY-.5)*-10}px,0)`;
}

/* story parallax */
const story=document.getElementById('story'),storyImage=document.getElementById('storyImage');
function updateStory(){
 const r=story.getBoundingClientRect(), total=story.offsetHeight-innerHeight;
 const p=Math.max(0,Math.min(1,-r.top/Math.max(1,total)));
 storyImage.style.transform=`translateY(${-10+p*18}%) scale(${1.02+p*.03})`;
}

/* Manufacturing rail follows normal document scroll without controlling it. */
const journey=document.getElementById('journey'),journeyStage=document.querySelector('.journeyStage'),journeyRail=document.getElementById('journeyRail');
const journeyMotionQuery=window.matchMedia('(max-width: 640px), (prefers-reduced-motion: reduce)');
let journeyFrame=0;
function updateJourneyRail(){
 journeyFrame=0;
 if(!journey||!journeyStage||!journeyRail)return;
 if(journeyMotionQuery.matches){journeyRail.style.transform='';return}
 const r=journey.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight;
 const p=Math.max(0,Math.min(1,(vh-r.top)/Math.max(1,r.height+vh)));
 const travel=Math.max(0,journeyRail.scrollWidth-journeyStage.clientWidth);
 journeyRail.style.transform=`translate3d(${-p*travel}px,0,0)`;
}
function queueJourneyRail(){if(!journeyFrame)journeyFrame=requestAnimationFrame(updateJourneyRail)}
addEventListener('scroll',queueJourneyRail,{passive:true});
addEventListener('resize',queueJourneyRail,{passive:true});
if(journeyMotionQuery.addEventListener)journeyMotionQuery.addEventListener('change',queueJourneyRail);else journeyMotionQuery.addListener(queueJourneyRail);
queueJourneyRail();

/* machine background */
let machineState;
function drawMachine(t){
 const c=document.getElementById('machineLines');if(!machineState)machineState=setup(c);if(!machineState)return;
 const{x,w,h}=machineState;x.clearRect(0,0,w,h);
 for(let i=0;i<24;i++){
   const yy=(i/23)*h;
   x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy);
   x.strokeStyle='rgba(199,154,76,.035)';x.stroke();
 }
 for(let j=0;j<12;j++){
   x.beginPath();
   for(let px=-10;px<w+10;px+=8){
     const y=h*.48+Math.sin(px*.007+t*.00025+j*.2)*110+(j-6)*9;
     if(px<0)x.moveTo(px,y);else x.lineTo(px,y)
   }
   x.strokeStyle=`rgba(199,154,76,${.018+j*.008})`;x.stroke()
 }
}

/* Zari Lab */
const palette={gold:[199,154,76],silver:[210,210,214],rose:[197,130,116],copper:[176,103,71],gunmetal:[108,115,120]};
let colorKey='gold',dir='S',tpm=3200,denier=85;
const roColor=document.getElementById('roColor'),roDir=document.getElementById('roDir'),roTPM=document.getElementById('roTPM'),roDenier=document.getElementById('roDenier');
document.querySelectorAll('#colorBtns button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#colorBtns button').forEach(x=>x.classList.remove('active'));b.classList.add('active');colorKey=b.dataset.color;roColor.textContent=b.textContent});
document.querySelectorAll('#dirBtns button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#dirBtns button').forEach(x=>x.classList.remove('active'));b.classList.add('active');dir=b.dataset.dir;roDir.textContent=b.textContent});
document.getElementById('tpmRange').oninput=e=>{tpm=+e.target.value;roTPM.textContent=tpm};
document.getElementById('denierRange').oninput=e=>{denier=+e.target.value;roDenier.textContent=denier};
let filState,coneState;
function drawFilament(t){
 const c=document.getElementById('filamentCanvas');if(!filState)filState=setup(c);if(!filState)return;
 const{x,w,h}=filState;x.clearRect(0,0,w,h);const col=palette[colorKey],sign=dir==='S'?1:-1;
 const density=.008+(tpm-1800)/2400*.012,amp=30+(170-denier)*.08,thick=1.2+denier/62;
 const g=x.createRadialGradient(w*.5,h*.5,20,w*.5,h*.5,190);g.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},.15)`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
 for(let s=0;s<11;s++){
   x.beginPath();
   for(let px=18;px<w-18;px+=4){
     const u=px*density*sign+t*.00115+s*.48,y=h/2+Math.sin(u)*amp+(s-5)*5.5;
     if(px===18)x.moveTo(px,y);else x.lineTo(px,y)
   }
   x.strokeStyle=`rgba(${col[0]},${col[1]},${col[2]},${.10+s*.055})`;x.lineWidth=s===5?thick+1.6:thick;x.stroke()
 }
}
function drawCone(t){
 const c=document.getElementById('coneCanvas');if(!coneState)coneState=setup(c);if(!coneState)return;
 const{x,w,h}=coneState;x.clearRect(0,0,w,h);const col=palette[colorKey],cx=w/2,cy=h/2+5,H=250,tw=86,bw=180;
 x.fillStyle='rgba(0,0,0,.24)';x.beginPath();x.ellipse(cx,cy+H/2+26,120,17,0,0,Math.PI*2);x.fill();
 const g=x.createLinearGradient(cx-bw/2,cy,cx+bw/2,cy);g.addColorStop(0,`rgb(${Math.max(0,col[0]-75)},${Math.max(0,col[1]-75)},${Math.max(0,col[2]-75)})`);g.addColorStop(.27,`rgb(${col[0]},${col[1]},${col[2]})`);g.addColorStop(.55,'rgb(247,224,176)');g.addColorStop(.8,`rgb(${col[0]},${col[1]},${col[2]})`);g.addColorStop(1,'rgb(50,35,25)');
 x.beginPath();x.moveTo(cx-tw/2,cy-H/2);x.lineTo(cx+tw/2,cy-H/2);x.lineTo(cx+bw/2,cy+H/2);x.lineTo(cx-bw/2,cy+H/2);x.closePath();x.fillStyle=g;x.fill();
 x.save();x.beginPath();x.moveTo(cx-tw/2,cy-H/2);x.lineTo(cx+tw/2,cy-H/2);x.lineTo(cx+bw/2,cy+H/2);x.lineTo(cx-bw/2,cy+H/2);x.closePath();x.clip();
 const n=72;for(let i=0;i<n;i++){const py=cy-H/2+i*(H/n),lw=tw+(bw-tw)*(i/n),off=Math.sin(t*.001+i*.35)*(dir==='S'?7:-7);x.beginPath();x.moveTo(cx-lw/2+off,py);x.lineTo(cx+lw/2+off,py);x.strokeStyle=`rgba(255,255,255,${.05+(i%3)*.025})`;x.stroke()}x.restore();
 x.fillStyle='#9a897b';x.font='11px Inter,Arial';x.textAlign='center';x.fillText(`${tpm} TPM · ${dir} Twist`,cx,cy+H/2+55)
}


const skipExperience=document.getElementById('skipExperience');
let motionEnabled=!reduced;
if(skipExperience){
  skipExperience.textContent=motionEnabled?'Reduce Motion':'Enable Motion';
  skipExperience.addEventListener('click',()=>{
    motionEnabled=!motionEnabled;
    skipExperience.textContent=motionEnabled?'Reduce Motion':'Enable Motion';
    document.documentElement.style.scrollBehavior=motionEnabled?'smooth':'auto';
  });
}

/* master animation */
function animate(t){
 if(motionEnabled){drawHero(t);drawMachine(t);drawFilament(t);drawCone(t)}
 updateHeroParallax();updateStory();
 requestAnimationFrame(animate)
}requestAnimationFrame(animate);

addEventListener('resize',()=>{heroState=machineState=filState=coneState=null});
