import { select } from 'd3-selection';
import { el } from './dom.js';

const overlap = (a,b) => Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)) *
  Math.max(0, Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));

export function mountCallouts(level, container, stage) {
  const layer = el('div', 'callout-layer');
  const svg = select(layer).append('svg').attr('class','callout-lines').attr('aria-hidden','true');
  const entries = level.callouts.map(callout => {
    const card = el('div','callout'); card.dataset.target = callout.target;
    card.append(el('strong','',callout.title),el('span','',callout.text)); layer.append(card);
    return {card, target: callout.target, line: svg.append('path'), dot: svg.append('circle').attr('r',4)};
  });
  container.append(layer);
  let pending = 0, disposed = false;
  function update() {
    pending = 0;
    if(disposed)return;
    const width=container.clientWidth, height=container.clientHeight, anchors=stage.getAnchors();
    const occupied = stage.getAvoidRects();
    const liveLevel = level.id >= 2 && level.id <= 4;
    const bottom = level.id === 3 ? 88 : container.querySelector('[data-fallback="true"]') ? 42 : 14;
    svg.attr('viewBox',`0 0 ${width} ${height}`);
    for(const {card, target, line, dot} of entries) {
      const point=anchors[target]; card.hidden=!point;
      if(!point){line.attr('d',null);dot.attr('r',0);continue;}
      const w=card.offsetWidth,h=card.offsetHeight;
      const candidates=[];
      if(liveLevel)for(const x of [12,(width-w)/2,width-w-12]){
        candidates.push({x,y:16,width:w,height:h});
        candidates.push({x,y:height-h-bottom,width:w,height:h});
      }
      const inset=width<600?10:16;
      for(const x of [inset,width-w-inset])
        for(let y=width<600?155:140; y<=height-h-bottom; y+=Math.max(h+10,62)) candidates.push({x,y,width:w,height:h});
      for(const x of [inset,(width-w)/2,width-w-inset]) candidates.push({x,y:height-h-bottom,width:w,height:h});
      const cost = r => occupied.reduce((n,o)=>n+overlap(r,o)*50,0) +
        Math.hypot(r.x+w/2-point.x,r.y+h/2-point.y)*.3;
      candidates.sort((a,b)=>cost(a)-cost(b));
      const r=candidates[0];
      occupied.push({x:r.x-5,y:r.y-5,width:w+10,height:h+10});
      card.style.transform=`translate(${r.x}px,${r.y}px)`;
      const sx = point.x>r.x+w ? r.x+w : point.x<r.x ? r.x : r.x+w/2;
      const sy = sx===r.x+w/2 ? (point.y<r.y?r.y:r.y+h) : r.y+h/2;
      line.attr('d',`M${sx},${sy}L${point.x},${point.y}`);
      dot.attr('r',4).attr('cx',point.x).attr('cy',point.y);
    }
  }
  function schedule(){if(!pending)pending=requestAnimationFrame(update);}
  const observer=new ResizeObserver(schedule); observer.observe(container);
  entries.forEach(({card})=>observer.observe(card));
  const remove=stage.onFrame(update);
  document.fonts.ready.then(schedule);
  update();
  return () => {disposed=true;cancelAnimationFrame(pending);remove();observer.disconnect();layer.remove();};
}
