import {buildScene} from './l1.js';
import {createRenderer} from '../stage3d/index.js';
import {disposeScene,v} from '../stage3d/parts.js';
import {el} from '../ui/dom.js';
let picture;
function cameraPicture() {
  if(picture)return picture;
  const source=document.createElement('canvas');source.width=source.height=336;
  const ctx=source.getContext('2d',{willReadFrequently:true});
  // Read a single front-camera frame, then release the entire temporary WebGL scene.
  const canvas=document.createElement('canvas'),renderer=createRenderer(canvas,{preserveDrawingBuffer:true});
  let model;
  try {
    if(renderer){
      model=buildScene();model.front.frustum.visible=false;model.arm.wristCam.frustum.visible=false;
      model.front.root.position.set(2.35,.6,3.6);model.front.aimAt(v(0,1.35,0));
      const camera=model.front.camera;camera.aspect=1;camera.fov=68;camera.updateProjectionMatrix();
      renderer.setPixelRatio(1);renderer.setSize(336,336,false);renderer.setClearColor('#f6eddd',1);
      renderer.render(model.scene,camera);ctx.drawImage(canvas,0,0);
    }else drawCameraFallback(ctx,336);
  }finally{if(model)disposeScene(model.scene);renderer?.dispose();renderer?.forceContextLoss();}
  // Canvas is an image source too; retaining it makes average-colour sampling synchronous.
  picture=source;return picture;
}
function drawCameraFallback(ctx,size) {
  ctx.save();ctx.scale(size/336,size/336);ctx.fillStyle='#f6eddd';ctx.fillRect(0,0,336,336);
  ctx.fillStyle='#d9c3a0';ctx.fillRect(17,169,302,105);ctx.strokeStyle='#3a3f4a';ctx.lineWidth=4;ctx.strokeRect(17,169,302,105);
  ctx.fillStyle='#c4a982';ctx.fillRect(33,274,16,62);ctx.fillRect(285,274,16,62);
  ctx.beginPath();ctx.moveTo(177,181);ctx.lineTo(125,74);ctx.lineTo(73,190);ctx.strokeStyle='#5a5f6a';ctx.lineWidth=25;ctx.stroke();
  ctx.strokeStyle='#efe6d6';ctx.lineWidth=17;ctx.stroke();
  for(const [x,y] of [[177,181],[125,74],[73,190]]){ctx.fillStyle='#1aa3a1';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#a9553f';ctx.fillRect(80,184,35,43);ctx.fillStyle='#f3ede2';ctx.beginPath();ctx.ellipse(244,229,42,15,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function words(instruction) {
  if(instruction==='把杯子放到盘子上')return ['把','杯子','放到','盘子','上'];
  if(instruction==='把布推到左边')return ['把','布','推到','左边'];
  return [...new Intl.Segmenter('zh',{granularity:'word'}).segment(instruction)].map(s=>s.segment);
}
function miniVector(ctx,rect,color,index,active=false) {
  const {x,y,width:w,height:h}=rect;
  ctx.fillStyle=active?'#1aa3a120':'#fffcf6';ctx.strokeStyle=active?'#1aa3a1':color;ctx.lineWidth=active?2.5:1;
  ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(4,w/6));ctx.fill();ctx.stroke();ctx.fillStyle=color;
  for(let j=0;j<5;j++){
    const bar=h*(.2+.6*(.5+.5*Math.sin(index*1.71+j*2.43)));
    ctx.fillRect(x+w*(.14+j*.15),y+(h-bar)/2,Math.max(1,w*.08),bar);
  }
}
export function drawThumb(ctx) {
  const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#f6eddd';ctx.fillRect(0,0,w,h);
  ctx.drawImage(cameraPicture(),w*.07,h*.16,w*.52,w*.52);
  ctx.strokeStyle='#fffcf6';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(w*(.07+.13*i),h*.16);ctx.lineTo(w*(.07+.13*i),h*.16+w*.52);ctx.moveTo(w*.07,h*.16+w*.13*i);ctx.lineTo(w*.59,h*.16+w*.13*i);ctx.stroke();}
  for(let i=0;i<16;i++)miniVector(ctx,{x:w*(.69+.08*(i%3)),y:h*.2+Math.floor(i/3)*h*.1,width:w*.06,height:h*.08},'#3d7396',i);
}
export function mountLevel({surface,content,instruction='把杯子放到盘子上',onBusy,onComplete}) {
  const canvas=el('canvas','stage-canvas patch-canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label',content.title);surface.append(canvas);
  const ctx=canvas.getContext('2d'),source=cameraPicture(),text=words(instruction),listeners=new Set();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let n=4,selected=-1,running=false,clock=0,frame=0,previous=0,width=1,height=1,disposed=false,colors=[],layout;
  let transition=0;
  surface.dataset.state='idle';
  function invalidate(){if(!disposed&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);}
  function rearrange(){
    const small=width<600, size=Math.min(width*(small?.46:.43),height-(small?205:220));
    const y=(height-size)/2;
    const image={x:small?14:28,y,width:size,height:size};
    const queue={x:image.x+size+(small?20:52),y,width:width-image.x-size-(small?34:80),height:size};
    const count=n*n,columns=Math.max(3,Math.ceil(Math.sqrt(count*queue.width/queue.height)));
    const gap=n===14?3:5,cell=Math.min((queue.width-(columns-1)*gap)/columns,(queue.height-42)/(Math.ceil(count/columns)))-gap;
    const cells=Array.from({length:count},(_,i)=>({x:queue.x+i%columns*(cell+gap),y:queue.y+Math.floor(i/columns)*(cell+gap),width:cell,height:cell}));
    const last=cells.at(-1),textY=Math.min(queue.y+queue.height-25,last.y+cell+13),tw=Math.min(51,(queue.width-(text.length-1)*4)/text.length);
    const texts=text.map((_,i)=>({x:queue.x+i*(tw+4),y:textY,width:tw,height:24}));
    layout={image,queue,cells,texts};
    const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
    // Average every pixel in each patch, in row-major order (no learnt encoder implied).
    colors=Array.from({length:count},(_,i)=>{
      let r=0,g=0,b=0,num=0;
      for(let y=Math.floor(Math.floor(i/n)*source.height/n);y<Math.floor((Math.floor(i/n)+1)*source.height/n);y++)
        for(let x=Math.floor(i%n*source.width/n);x<Math.floor((i%n+1)*source.width/n);x++){
          const p=(y*source.width+x)*4;r+=pixels[p];g+=pixels[p+1];b+=pixels[p+2];num++;
        }
      return `rgb(${Math.round(r/num)},${Math.round(g/num)},${Math.round(b/num)})`;
    });
    const readout=document.querySelector('[data-readout="count"]');if(readout)readout.value=String(count+text.length);
    surface.dataset.tokens=String(count+text.length);surface.dataset.grid=String(n);invalidate();
  }
  function timing(i){return i/(n*n)*1.55;}
  function draw(now){
    frame=0;if(disposed||document.hidden)return;
    const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
    if(running)clock+=dt;
    const ratio=Math.min(devicePixelRatio||1,2);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const readout=document.querySelector('[data-readout="count"]');if(readout)readout.value=String(n*n+text.length);
    const {image,cells,texts}=layout,patch=image.width/n;
    ctx.drawImage(source,image.x,image.y,image.width,image.height);
    ctx.strokeStyle='#fffcf6bb';ctx.lineWidth=1;
    for(let i=0;i<=n;i++){ctx.beginPath();ctx.moveTo(image.x+i*patch,image.y);ctx.lineTo(image.x+i*patch,image.y+image.height);ctx.moveTo(image.x,image.y+i*patch);ctx.lineTo(image.x+image.width,image.y+i*patch);ctx.stroke();}
    for(let i=0;i<cells.length;i++){
      ctx.globalAlpha=running&&clock<timing(i)+.38?.2:1;
      miniVector(ctx,cells[i],colors[i],i,i===selected);
    }
    ctx.globalAlpha=1;
    if(selected>=0){ctx.strokeStyle='#1aa3a1';ctx.fillStyle='#1aa3a125';ctx.lineWidth=3;
      const x=image.x+selected%n*patch,y=image.y+Math.floor(selected/n)*patch;ctx.fillRect(x,y,patch,patch);ctx.strokeRect(x+1.5,y+1.5,patch-3,patch-3);}
    for(let i=0;i<texts.length;i++){
      const r=texts[i],arrival=1.95+i*.07;
      ctx.globalAlpha=running?Math.max(.15,Math.min(1,(clock-arrival)/.14)):1;
      const drop=running?Math.max(0,1-(clock-arrival)/.14)*-13:0;
      ctx.strokeStyle='#c08a3e';ctx.fillStyle='#fffcf6';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(r.x,r.y+drop,r.width,r.height,4);ctx.fill();ctx.stroke();
      ctx.fillStyle='#91662c';ctx.font=`${width<600?9:11}px GuideSansSC`;ctx.textAlign='center';ctx.fillText(text[i],r.x+r.width/2,r.y+drop+16);
    }
    ctx.globalAlpha=1;
    if(running&&!reduced.matches)for(let i=0;i<cells.length;i++){
      const t=(clock-timing(i))/.38;if(t<=0||t>=1)continue;
      const ease=t*t*(3-2*t),to=cells[i],sx=image.x+i%n*patch,sy=image.y+Math.floor(i/n)*patch;
      const x=sx+(to.x-sx)*ease,y=sy+(to.y-sy)*ease-28*Math.sin(Math.PI*t),size=patch+(to.width-patch)*ease;
      ctx.drawImage(source,i%n*source.width/n,Math.floor(i/n)*source.height/n,source.width/n,source.height/n,x,y,size,size);
      ctx.strokeStyle='#1aa3a1';ctx.strokeRect(x,y,size,size);
    }
    surface.dataset.selected=String(selected);surface.dataset.renders=String((+surface.dataset.renders||0)+1);
    listeners.forEach(fn=>fn());
    if(running&&(clock>=2.45||reduced.matches)){running=false;surface.dataset.state='complete';onBusy(false);onComplete();invalidate();}
    transition=Math.max(0,transition-dt);
    if(running||transition>0)invalidate();else previous=0;
  }
  function resize(){width=surface.clientWidth;height=surface.clientHeight;const r=Math.min(devicePixelRatio||1,2);canvas.width=width*r;canvas.height=height*r;rearrange();}
  function pick(e){
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.x,y=e.clientY-r.y,{image,cells}=layout;
    if(x>=image.x&&x<image.x+image.width&&y>=image.y&&y<image.y+image.height)selected=Math.floor((y-image.y)/image.height*n)*n+Math.floor((x-image.x)/image.width*n);
    else {const index=cells.findIndex(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);if(index>=0)selected=index;}
    invalidate();
  }
  function key(e){if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();selected=Math.max(0,Math.min(n*n-1,selected+({ArrowRight:1,ArrowLeft:-1,ArrowUp:-n,ArrowDown:n}[e.key])));invalidate();}
  function visibility(){cancelAnimationFrame(frame);frame=0;previous=0;if(!document.hidden)invalidate();}
  canvas.addEventListener('pointermove',pick);canvas.addEventListener('pointerdown',pick);canvas.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(resize);observer.observe(surface);resize();
  return {
    onControl(id,value){if(running)return;if(id==='patch'){n={大:4,中:8,小:14}[value]||4;selected=-1;surface.dataset.state='idle';transition=.18;if(!reduced.matches)canvas.animate([{opacity:.6},{opacity:1}],{duration:180});rearrange();}
      if(id==='run'){running=true;clock=0;previous=0;surface.dataset.state='running';onBusy(true);invalidate();}},
    getAnchors(){const {image,queue,texts}=layout;return {image:{x:image.x+image.width*.2,y:image.y+image.height*.18},grid:{x:image.x+image.width/n,y:image.y+image.height*.55},tokens:{x:queue.x+queue.width*.5,y:queue.y+queue.height*.45},text_tokens:{x:texts[2].x,y:texts[2].y+12}};},
    getAvoidRects(){return [layout.image,{...layout.queue,height:layout.queue.height+5}];},
    onFrame(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();listeners.clear();document.removeEventListener('visibilitychange',visibility);canvas.remove();},
  };
}
