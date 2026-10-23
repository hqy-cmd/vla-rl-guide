// Run `npm run dev` first, then `node scripts/bake-previews.mjs`.
// Rebuild static camera/thumbnail frames after changing the scene builders.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
  const page=await browser.newPage();await page.goto(process.env.PREVIEW_ORIGIN||'http://127.0.0.1:5173');await page.waitForSelector('html[data-ready=true]');
  const frames=await page.evaluate(async()=>{
    const {OrthographicCamera}=await import('/node_modules/.vite/deps/three.js');
    const {createRenderer,frameCamera}=await import('/src/stage3d/index.js');
    const {disposeScene,v}=await import('/src/stage3d/parts.js');
    const canvas=document.createElement('canvas'),renderer=createRenderer(canvas,{preserveDrawingBuffer:true});
    const frames={};
    try{
      for(const id of [1,3,4]){
        const {buildThumbScene}=await import(`/src/levels/l${id}.js`),model=buildThumbScene();
        try{
          const camera=new OrthographicCamera(-5,5,5,-5,.1,50);
          model.scene.traverse(node=>{if(node.userData.pixelHeight)node.visible=false;});
          frameCamera(camera,model.fitPoints||model.bounds,192,144);
          renderer.setPixelRatio(1);renderer.setSize(192,144,false);renderer.setClearColor('#f6eddd',1);renderer.render(model.scene,camera);
          frames[`level-${id}-thumb.png`]=canvas.toDataURL('image/png').split(',')[1];
        }finally{disposeScene(model.scene);}
      }
      const {buildScene}=await import('/src/levels/l1.js'),model=buildScene();
      try{
        model.front.frustum.visible=false;model.arm.wristCam.frustum.visible=false;
        model.front.root.position.set(2.35,.6,3.6);model.front.aimAt(v(0,1.35,0));
        const camera=model.front.camera;camera.aspect=1;camera.fov=68;camera.updateProjectionMatrix();
        renderer.setSize(336,336,false);renderer.render(model.scene,camera);
        frames['front-camera.png']=canvas.toDataURL('image/png').split(',')[1];
      }finally{disposeScene(model.scene);}
    }finally{renderer.dispose();renderer.forceContextLoss();}
    return frames;
  });
  const directory=new URL('../src/assets/',import.meta.url);await mkdir(directory,{recursive:true});
  for(const [name,data] of Object.entries(frames))await writeFile(new URL(name,directory),Buffer.from(data,'base64'));
  console.log('Baked camera frame and three scene previews.');
}finally{await browser.close();}
