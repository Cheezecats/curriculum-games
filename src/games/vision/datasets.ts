export type DataKind = 'linear' | 'xor' | 'image';
export type Split = 'train' | 'validation' | 'test';
export interface Sample { id:string; family:string; input:number[]; label:number; }
export function dataset(kind:DataKind, split:Split, count=72, shifted=false):Sample[] {
  let seed=({train:107,validation:2003,test:4909}[split])+(shifted?90000:0);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return Array.from({length:count},(_,i)=>{
    const family=`${kind}-${split}-${shifted?'shift':'base'}-${i}`;
    if(kind!=='image') { const x=random(),y=random(); return {id:family,family,input:[x,y],label:kind==='xor'?Number((x>.5)!==(y>.5)):Number(x*.7+y*.3>.5)}; }
    const label=i%3; const input=Array<number>(256).fill(0); const cx=7.5+(random()-.5)*(shifted?5:2),cy=7.5+(random()-.5)*(shifted?5:2);const radius=shifted?3+random()*3:4.5+random();
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){const dx=x-cx,dy=y-cy;const inside=label===0?dx*dx+dy*dy<radius*radius:label===1?Math.abs(dx)<radius&&Math.abs(dy)<radius:dy>=-radius&&dy<radius&&Math.abs(dx)<(dy+radius)/2;input[y*16+x]=inside?(shifted?.55:.85)+random()*.15:random()*(shifted?.24:.08);}
    return {id:family,family,input,label};
  });
}
export function augment(sample:Sample):Sample[] {
  if(sample.input.length!==256)return [{...sample,id:sample.id+'-jitter',input:sample.input.map(x=>Math.min(1,Math.max(0,x+.025)))}];
  return [[-2,0,1],[2,0,1],[0,-2,.72],[0,2,.72]].map(([dx,dy,gain],index)=>({...sample,id:sample.id+`-augment-${index}`,input:sample.input.map((_,i)=>{const x=i%16-dx!,y=Math.floor(i/16)-dy!;return x>=0&&x<16&&y>=0&&y<16?sample.input[y*16+x]!*gain!:0;})}));
}
