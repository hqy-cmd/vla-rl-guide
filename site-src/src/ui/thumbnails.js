import { OrthographicCamera, WebGLRenderTarget, SRGBColorSpace } from 'three';
import { drawThumb as l2 } from '../levels/l2.js';
import { buildThumbScene as l1 } from '../levels/l1.js';
import { buildThumbScene as l3 } from '../levels/l3.js';
import { buildThumbScene as l4 } from '../levels/l4.js';
import { createRenderer, frameCamera } from '../stage3d/index.js';
import { disposeScene } from '../stage3d/parts.js';

const builders = new Map([[1,l1],[3,l3],[4,l4]]);
const idle = callback => window.requestIdleCallback ? requestIdleCallback(callback,{timeout:1800}) : setTimeout(callback,100);
function draw2D(canvas,id) {
  canvas.width=192;canvas.height=144;
  const c=canvas.getContext('2d');c.fillStyle='#f6eddd';c.fillRect(0,0,192,144);
  c.lineWidth=3;c.strokeStyle='#3a3f4a';c.lineJoin='round';c.lineCap='round';
  const box=(x,y,w,h,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,5);c.fill();c.stroke();};
  if(id===2){l2(c);return;

  } else if(id===5){for(let i=0;i<4;i++)box(32+i*30,30+i%2*20,38,59,['#d9c3a0','#3d7396','#1aa3a1','#a9553f'][i]);}
  else if(id===6){box(29,80,132,28,'#d9c3a0');for(const x of [51,119]){c.beginPath();c.moveTo(x,76);c.lineTo(x-12,40);c.lineTo(x+20,53);c.stroke();c.fillStyle='#1aa3a1';c.beginPath();c.arc(x-12,40,7,0,7);c.fill();}}
  else if(id===7){c.strokeStyle='#3d7396';c.beginPath();c.moveTo(30,106);c.bezierCurveTo(60,75,80,125,104,62);c.bezierCurveTo(125,15,140,60,160,27);c.stroke();for(let i=0;i<6;i++)box(35+i*22,113-i*6,12,12+i*6,'#1aa3a1');}
  else if(id===8){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;c.strokeStyle='#1aa3a1';c.lineWidth=5;c.beginPath();c.arc(96,72,42,a,a+1.7);c.stroke();box(82+Math.cos(a)*42,58+Math.sin(a)*42,22,22,i?'#d9c3a0':'#1aa3a1');}}
  else if(id===9){box(62,29,68,44,'#efe6d6');box(74,80,44,35,'#1aa3a1');for(const x of [80,110]){c.fillStyle='#18213d';c.beginPath();c.arc(x,49,5,0,7);c.fill();}}
  else {for(let i=0;i<3;i++)box(42+i*8,90-i*23,98,19,['#3d7396','#d9c3a0','#1aa3a1'][i]);}
}
export function scheduleThumbnails(cards) {
  const urls=[];
  idle(async()=>{
    let renderer, target;
    try {
      for(const [id,card] of cards) {
        await new Promise(resolve=>idle(resolve));
        try {
        if(builders.has(id)) {
          if(renderer===undefined){renderer=createRenderer(document.createElement('canvas'));
            if(renderer){target=new WebGLRenderTarget(192,144,{samples:4});target.texture.colorSpace=SRGBColorSpace;}
            renderer?.setPixelRatio(1);renderer?.setSize(192,144,false);}
          if(!renderer)continue;
          let model;
          try{
            model=builders.get(id)();
            const camera=new OrthographicCamera(-5,5,5,-5,.1,50);
            frameCamera(camera,model.fitPoints || model.bounds,192,144);
            renderer.setRenderTarget(target);
            renderer.setClearColor('#f6eddd',1);renderer.render(model.scene,camera);
            const pixels=new Uint8Array(192*144*4);
            await renderer.readRenderTargetPixelsAsync(target,0,0,192,144,pixels);
            renderer.setRenderTarget(null);
            const canvas=document.createElement('canvas');canvas.width=192;canvas.height=144;
            const data=new Uint8ClampedArray(pixels.length);
            // WebGL reads bottom-up; Canvas ImageData is top-down.
            for(let y=0;y<144;y++)data.set(pixels.subarray((143-y)*192*4,(144-y)*192*4),y*192*4);
            canvas.getContext('2d').putImageData(new ImageData(data,192,144),0,0);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            if(blob)install(card,blob);
          }finally{if(model)disposeScene(model.scene);}
        }else{
          const canvas=document.createElement('canvas');draw2D(canvas,id);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          if(blob)install(card,blob);
        }
        } catch { renderer?.setRenderTarget(null); /* Keep this card's placeholder and continue. */ }
      }
    }catch{/* Keep placeholders when rendering or encoding is unavailable. */}
    finally{target?.dispose();renderer?.dispose();renderer?.forceContextLoss();}
  });
  function install(card,blob){
    const url=URL.createObjectURL(blob);urls.push(url);
    const img=new Image();img.alt='';
    img.onload=()=>{card.querySelector('.thumbnail').replaceChildren(img);};img.src=url;
  }
  window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
}
