import { DEFAULT_REALM_SOURCE, parseRealmSource, validateRealmSource } from '../language/realm.js';
import { normalizeWorldAssetPackage, transformWorldAssetVertex, WORLD_ASSETS_STORAGE_KEY } from './worldAssets.js';
import { calculateWorldEnvironment, normalizeWeather } from './environment.js';
import { playSynthPreset } from './audioSynth.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const length2 = (x, z) => Math.hypot(x, z);
const normalize3 = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const linearHex = hex => {
  let h = String(hex).replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join('');
  const s = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return s.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
};
const mul = (a, b) => { const o = new Float32Array(16); for (let c=0;c<4;c++) for (let r=0;r<4;r++) o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; };
const perspective = (fovy, aspect, near, far) => { const f=1/Math.tan(fovy/2), nf=1/(near-far), o=new Float32Array(16); o[0]=f/aspect; o[5]=f; o[10]=(far+near)*nf; o[11]=-1; o[14]=2*far*near*nf; return o; };
const lookAt = (eye, center, up=[0,1,0]) => {
  const sub=(a,b)=>a.map((v,i)=>v-b[i]), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const z=normalize3(sub(eye,center)), x=normalize3(cross(up,z)), y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
};
const ortho = (left,right,bottom,top,near,far) => { const o=new Float32Array(16); o[0]=2/(right-left);o[5]=2/(top-bottom);o[10]=-2/(far-near);o[12]=-(right+left)/(right-left);o[13]=-(top+bottom)/(top-bottom);o[14]=-(far+near)/(far-near);o[15]=1; return o; };
const fract = x => x - Math.floor(x);
function randomGenerator(seed) { let s = (Math.trunc(seed) || 1) >>> 0; return () => { s += 0x6D2B79F5; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function noise2(x,z,seed) {
  const hash=(a,b)=>fract(Math.sin(a*127.1+b*311.7+seed*0.173)*43758.5453)*2-1;
  const ix=Math.floor(x), iz=Math.floor(z), fx=smooth(x-ix), fz=smooth(z-iz);
  return mix(mix(hash(ix,iz),hash(ix+1,iz),fx),mix(hash(ix,iz+1),hash(ix+1,iz+1),fx),fz);
}
function terrainHeight(x,z,config) {
  const seed=config.land.seed, e=config.land.span/2;
  const edge= Math.max(0, 1 - Math.max(Math.abs(x),Math.abs(z))/(e*1.02));
  let h = noise2(x*.014,z*.014,seed)*3.3 + noise2(x*.034,z*.034,seed+7)*1.2 + noise2(x*.082,z*.082,seed+19)*.35;
  h += Math.exp(-((x-73)**2+(z+65)**2)/1250)*8.2;
  h += Math.exp(-((x+87)**2+(z+89)**2)/1900)*5.8;
  h += Math.exp(-((x-91)**2+(z-78)**2)/1700)*4.1;
  const biome = config.land.type;
  if (biome === 'alpine') h += Math.abs(noise2(x*.009,z*.009,seed+121))*7.2 + Math.max(0,noise2(x*.024,z*.024,seed+124))*3.2;
  else if (biome === 'evergreen') h *= .86;
  else if (biome === 'goldenwood') h += noise2(x*.012,z*.012,seed+81)*1.1;
  else if (biome === 'moonfen') h = h*.48 + noise2(x*.052,z*.052,seed+90)*.48;
  else if (biome === 'emberfall') h += Math.max(0,noise2(x*.013,z*.013,seed+212))**1.6*9.5 + Math.abs(noise2(x*.031,z*.031,seed+214))*1.3;
  h += (1-edge)*noise2(x*.022,z*.022,seed+33)*2.2;
  const spawnR=length2(x-config.entry.x,z-config.entry.z); h *= mix(.62,1,smooth((spawnR-14)/25));
  for (const water of config.waters) {
    const d=length2(x-water.x,z-water.z), r=water.radius;
    if (d < r+7) { const basin=water.y-0.55 + (d/r)**2*1.7; h=mix(Math.min(h,basin),h,smooth((d-r+1)/8)); }
  }
  return h;
}
function terrainNormal(x,z,config) { const e=.7; return normalize3([-(terrainHeight(x+e,z,config)-terrainHeight(x-e,z,config))/(2*e),1,-(terrainHeight(x,z+e,config)-terrainHeight(x,z-e,config))/(2*e)]); }

class MeshBuilder {
  constructor() { this.data=[]; }
  triangle(a,b,c,color,normals=null,colors=null) {
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const face=normalize3([ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]);
    const points=[a,b,c];
    for(let i=0;i<3;i++) { const p=points[i], n=normals?.[i]||face, col=colors?.[i]||color; this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],col[0],col[1],col[2]); }
  }
  quad(a,b,c,d,color) { this.triangle(a,b,c,color); this.triangle(a,c,d,color); }
  finish() { return new Float32Array(this.data); }
}
const C = {
  grass:linearHex('#6fa85a'), grassLight:linearHex('#91bd67'), moss:linearHex('#3e7556'), deepGrass:linearHex('#315a4b'), rock:linearHex('#7c8582'), rockLight:linearHex('#a0a49b'), soil:linearHex('#87674d'), path:linearHex('#c6a071'), bark:linearHex('#644431'), barkLight:linearHex('#896247'), pineDark:linearHex('#214e43'), pine:linearHex('#2f7258'), pineLight:linearHex('#4a9367'), house:linearHex('#d4b48a'), houseLight:linearHex('#e9d1a7'), roof:linearHex('#a95f4c'), roofLight:linearHex('#c27a58'), door:linearHex('#4f3b37'), window:linearHex('#8edbe5'), stone:linearHex('#737f90'), stoneLight:linearHex('#a7adba'), gold:linearHex('#eab96d'), crystal:linearHex('#56e0e0'), violet:linearHex('#8a7cff'), flower:linearHex('#e994dc'), leaf:linearHex('#67c4a2'), white:linearHex('#f7e8cb'), water:linearHex('#0e6a8a'), armor:linearHex('#25374f'), armor2:linearHex('#43667b'), cloth:linearHex('#d2a767'), skin:linearHex('#d99e79'), glow:[1.75,1.05,.38], blueGlow:[.36,1.25,1.7], redGlow:[1.25,.25,.15], dark:linearHex('#273b3b'), bridge:linearHex('#9b7654')
};
const BIOME_OVERRIDES = {
  highlands: {},
  evergreen: { grass:linearHex('#3d805d'), grassLight:linearHex('#6da779'), moss:linearHex('#28594c'), deepGrass:linearHex('#1e463e'), pineDark:linearHex('#173b36'), pine:linearHex('#24634f'), pineLight:linearHex('#3c8766'), leaf:linearHex('#58ad83'), path:linearHex('#b69775') },
  goldenwood: { grass:linearHex('#a0a752'), grassLight:linearHex('#d2bb69'), moss:linearHex('#676d3e'), deepGrass:linearHex('#484c30'), pineDark:linearHex('#59603b'), pine:linearHex('#7d8849'), pineLight:linearHex('#adb15e'), leaf:linearHex('#d0b45c'), flower:linearHex('#eab18a'), bark:linearHex('#71503a'), house:linearHex('#d8bd8a'), roof:linearHex('#925849'), path:linearHex('#d8bd8a'), water:linearHex('#1d7484') },
  moonfen: { grass:linearHex('#477c72'), grassLight:linearHex('#79a99a'), moss:linearHex('#305e5a'), deepGrass:linearHex('#244747'), rock:linearHex('#5c747a'), rockLight:linearHex('#8ba5a4'), pineDark:linearHex('#1d494d'), pine:linearHex('#2e6968'), pineLight:linearHex('#4b8a81'), flower:linearHex('#c49bee'), leaf:linearHex('#79c0ad'), path:linearHex('#8d9185'), water:linearHex('#125a76'), stone:linearHex('#5e7185') },
  emberfall: { grass:linearHex('#5e5044'), grassLight:linearHex('#9b7550'), moss:linearHex('#473f3b'), deepGrass:linearHex('#322e32'), rock:linearHex('#655e61'), rockLight:linearHex('#a58c80'), bark:linearHex('#49332f'), pineDark:linearHex('#47312d'), pine:linearHex('#78433a'), pineLight:linearHex('#a35b42'), house:linearHex('#bda18b'), houseLight:linearHex('#d9bba1'), roof:linearHex('#763e39'), roofLight:linearHex('#a94d34'), path:linearHex('#b87c53'), water:linearHex('#6f3e43'), stone:linearHex('#5a525d'), stoneLight:linearHex('#95847b'), bridge:linearHex('#765447') },
  alpine: { grass:linearHex('#78a47a'), grassLight:linearHex('#b2c49a'), moss:linearHex('#4b795d'), deepGrass:linearHex('#365a4b'), rock:linearHex('#8a969e'), rockLight:linearHex('#d0d1cb'), pineDark:linearHex('#244a44'), pine:linearHex('#376b5e'), pineLight:linearHex('#649584'), path:linearHex('#c4b6a0'), water:linearHex('#227d9c'), stone:linearHex('#798a99'), stoneLight:linearHex('#c2c6cb') }
};
function biomePalette(type) { return { ...C, ...(BIOME_OVERRIDES[type] || BIOME_OVERRIDES.highlands) }; }
function skySettingsFor(name) {
  const presets = {
    'copper-dawn': { horizon:'#d99077', middle:'#637899', zenith:'#121b3a', sun:'#ffd6a4', cloud:'#bc8d9e', fog:'#98726f', direction:[-.43,.83,-.34] },
    azure: { horizon:'#91c7de', middle:'#4b88bd', zenith:'#163766', sun:'#fff1c7', cloud:'#e8f5ff', fog:'#8fb5c7', direction:[-.35,.91,-.2] },
    moonlit: { horizon:'#4b547f', middle:'#27365e', zenith:'#070e27', sun:'#c9d7ff', cloud:'#8b95c5', fog:'#394569', direction:[.28,.84,-.46] },
    'violet-dusk': { horizon:'#c27cb0', middle:'#675b99', zenith:'#201d4c', sun:'#ffe0ba', cloud:'#bd9acb', fog:'#856b91', direction:[-.56,.71,.31] },
    emberfall: { horizon:'#e47b47', middle:'#773f4e', zenith:'#231c38', sun:'#ffe2a0', cloud:'#b66f61', fog:'#87534e', direction:[-.62,.67,-.41] }
  };
  const p=presets[name]||presets['copper-dawn'];
  return { horizon:linearHex(p.horizon), middle:linearHex(p.middle), zenith:linearHex(p.zenith), sun:linearHex(p.sun), cloud:linearHex(p.cloud), fog:linearHex(p.fog), direction:normalize3(p.direction) };
}
function p3(x,y,z) { return [x,y,z]; }
function rotatedPoint(x,y,z,center,yaw=0) { const c=Math.cos(yaw),s=Math.sin(yaw); return [center[0]+x*c+z*s,center[1]+y,center[2]-x*s+z*c]; }
function addBox(b,x,y,z,sx,sy,sz,color,yaw=0) {
  const q=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]].map(v=>rotatedPoint(v[0]*sx,v[1]*sy,v[2]*sz,[x,y,z],yaw));
  const faces=[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]];
  for(const f of faces)b.quad(q[f[0]],q[f[1]],q[f[2]],q[f[3]],color);
}
function addCylinder(b,x,y,z,r,h,color,segments=9,topRatio=1) {
  const bottom=[],top=[]; for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;bottom.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r]);top.push([x+Math.cos(a)*r*topRatio,y+h,z+Math.sin(a)*r*topRatio]);}
  for(let i=0;i<segments;i++){const n=(i+1)%segments;b.triangle(bottom[i],top[i],top[n],color);b.triangle(bottom[i],top[n],bottom[n],color);b.triangle([x,y,z],bottom[n],bottom[i],color);b.triangle([x,y+h,z],top[i],top[n],color);}
}
function addCone(b,x,y,z,r,h,color,segments=8) { addCylinder(b,x,y,z,r,h,color,segments,.015); }
function addSegmentCylinder(b, start, end, r0, r1, color, segments=7) {
  const axis=normalize3([end[0]-start[0],end[1]-start[1],end[2]-start[2]]);
  const up=Math.abs(axis[1])>.92?[1,0,0]:[0,1,0];
  const cross=(a,c)=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
  const u=normalize3(cross(axis,up)),v=normalize3(cross(axis,u)),bottom=[],top=[];
  for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);bottom.push([start[0]+(u[0]*ca+v[0]*sa)*r0,start[1]+(u[1]*ca+v[1]*sa)*r0,start[2]+(u[2]*ca+v[2]*sa)*r0]);top.push([end[0]+(u[0]*ca+v[0]*sa)*r1,end[1]+(u[1]*ca+v[1]*sa)*r1,end[2]+(u[2]*ca+v[2]*sa)*r1]);}
  for(let i=0;i<segments;i++){const n=(i+1)%segments;b.triangle(bottom[i],top[i],top[n],color);b.triangle(bottom[i],top[n],bottom[n],color);b.triangle(start,bottom[n],bottom[i],color);b.triangle(end,top[i],top[n],color);}
}
function tintColor(color,factor){return color.map(v=>Math.max(0,v*factor));}
function addFacetedBoulder(b,x,y,z,rx,ry,rz,color,seed=1){
  const rand=randomGenerator(seed),rings=4,sides=8,rows=[];
  for(let j=0;j<=rings;j++){const phi=.08+(Math.PI-.16)*j/rings,row=[];for(let i=0;i<sides;i++){const theta=2*Math.PI*i/sides+(j%2)*.11,jitter=.78+rand()*.42;row.push([x+Math.sin(phi)*Math.cos(theta)*rx*jitter,y+Math.cos(phi)*ry*(.88+rand()*.24),z+Math.sin(phi)*Math.sin(theta)*rz*jitter]);}rows.push(row);}
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=rows[j][i],bb=rows[j][(i+1)%sides],c=rows[j+1][(i+1)%sides],d=rows[j+1][i],shade=.78+rand()*.42,col=tintColor(color,shade);b.triangle(a,bb,d,col);b.triangle(bb,c,d,tintColor(color,.82+rand()*.34));}
}
function addBroadleafTree(b,x,y,z,scale,palette,seed=1,autumn=false){
  const r=randomGenerator(seed),leanX=(r()-.5)*.55*scale,leanZ=(r()-.5)*.55*scale,base=[x,y,z],trunkTop=[x+leanX,y+3.0*scale,z+leanZ];
  addSegmentCylinder(b,base,trunkTop,.25*scale,.095*scale,palette.bark,8);
  for(let root=0;root<4;root++){const a=root*Math.PI/2+r()*.25;addSegmentCylinder(b,[x,y+.05,z],[x+Math.cos(a)*.68*scale,y+.04,z+Math.sin(a)*.68*scale],.19*scale,.055*scale,palette.barkLight,5);}
  const foliage=autumn?(r()>.5?palette.grassLight:palette.flower):(r()>.62?palette.leaf:palette.pineLight);
  // Irregular overlapping leaf masses break the single-lollipop silhouette; deterministic seed keeps authored worlds reproducible.
  for(let branch=0;branch<7;branch++){const a=branch*Math.PI*(3-Math.sqrt(5))+r()*.28,by=y+(1.35+r()*1.25)*scale,len=(.72+r()*.68)*scale;const from=[x+leanX*.4,by,z+leanZ*.4],to=[from[0]+Math.cos(a)*len,by+(.32+r()*.62)*scale,from[2]+Math.sin(a)*len];addSegmentCylinder(b,from,to,.088*scale,.028*scale,palette.bark,5);const clump=.38+r()*.2,leafColor=autumn?(r()>.45?palette.grassLight:palette.flower):(r()>.48?foliage:palette.leaf);addSphere(b,to[0],to[1]+.16*scale,to[2],clump*scale,(.43+r()*.17)*scale,clump*scale,leafColor,8,5);}
  addSphere(b,trunkTop[0],trunkTop[1]+.42*scale,trunkTop[2],.68*scale,.7*scale,.67*scale,foliage,9,6);
  addSphere(b,x+leanX*.6,y+2.65*scale,z+leanZ*.6,.55*scale,.58*scale,.56*scale,autumn?palette.grassLight:palette.pine,8,5);
}
function addFernTuft(b,x,y,z,scale,palette,seed=1,flowers=false){
  const r=randomGenerator(seed),count=5+Math.floor(r()*3);for(let i=0;i<count;i++){const a=i/count*Math.PI*2+r()*.22,h=scale*(.44+r()*.72),w=scale*(.075+r()*.045),dx=Math.cos(a),dz=Math.sin(a),sideX=-dz*w,sideZ=dx*w,tip=[x+dx*h*.48,y+h,z+dz*h*.48],root=[x,y+.015,z];const col=i%3===0?palette.leaf:(i%2?palette.grassLight:palette.deepGrass);b.triangle([x+sideX,y,z+sideZ],[x-sideX,y,z-sideZ],tip,col);b.triangle([x-sideX,y,z-sideZ],[x-sideX*.15,y+h*.52,z-sideZ*.15],tip,tintColor(col,.82));if(flowers&&i===0){addSphere(b,x+dx*h*.47,y+h,z+dz*h*.47,.07*scale,.08*scale,.07*scale,palette.flower,6,4);}}
}

function addSphere(b,x,y,z,rx,ry,rz,color,sides=10,rings=7) {
  const points=[]; for(let i=0;i<=rings;i++){const phi=Math.PI*i/rings,row=[];for(let j=0;j<=sides;j++){const theta=2*Math.PI*j/sides;row.push([x+Math.sin(phi)*Math.cos(theta)*rx,y+Math.cos(phi)*ry,z+Math.sin(phi)*Math.sin(theta)*rz]);}points.push(row);}
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=points[i][j],bb=points[i+1][j],c=points[i+1][j+1],d=points[i][j+1];b.triangle(a,bb,d,color);b.triangle(bb,c,d,color);}
}
function addCrystal(b,x,y,z,scale,color=C.crystal,yaw=0) {
  const h=scale, ring=[]; for(let i=0;i<5;i++){const a=i/5*Math.PI*2+yaw;ring.push([x+Math.cos(a)*h*.42,y+h*.25,z+Math.sin(a)*h*.42]);}
  const top=[x,y+h*1.55,z], bottom=[x+Math.sin(yaw)*h*.12,y-h*.25,z+Math.cos(yaw)*h*.12];
  for(let i=0;i<5;i++){const n=(i+1)%5;b.triangle(top,ring[i],ring[n],color);b.triangle(bottom,ring[n],ring[i],[color[0]*.46,color[1]*.52,color[2]*.66]);}
}
function addTorusY(b,x,y,z,r,tube,color,segments=28,sides=7,tilt=0) {
  const loops=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,row=[];for(let j=0;j<=sides;j++){const q=j/sides*Math.PI*2,rr=r+tube*Math.cos(q);let px=Math.cos(a)*rr,py=tube*Math.sin(q),pz=Math.sin(a)*rr;const ty=py*Math.cos(tilt)-pz*Math.sin(tilt),tz=py*Math.sin(tilt)+pz*Math.cos(tilt);row.push([x+px,y+ty,z+tz]);}loops.push(row);}
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=loops[i][j],bb=loops[i+1][j],c=loops[i+1][j+1],d=loops[i][j+1];b.triangle(a,bb,d,color);b.triangle(bb,c,d,color);}
}
function addRoof(b,x,y,z,w,h,d,color,yaw=0) {
  const pts=[[-w/2,0,-d/2],[w/2,0,-d/2],[0,h,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[0,h,d/2]].map(v=>rotatedPoint(v[0],v[1],v[2],[x,y,z],yaw));
  b.triangle(pts[0],pts[2],pts[1],color);b.triangle(pts[3],pts[4],pts[5],color);b.quad(pts[0],pts[3],pts[5],pts[2],color);b.quad(pts[1],pts[2],pts[5],pts[4],color);
}
function addRibbon(b,points,width,color,config) {
  for(let i=0;i<points.length-1;i++) { const a=points[i],bb=points[i+1],dx=bb[0]-a[0],dz=bb[1]-a[1],l=Math.hypot(dx,dz)||1,nx=dz/l*width/2,nz=-dx/l*width/2;
    const p=[a[0]+nx,terrainHeight(a[0]+nx,a[1]+nz,config)+.16,a[1]+nz],q=[a[0]-nx,terrainHeight(a[0]-nx,a[1]-nz,config)+.16,a[1]-nz],r=[bb[0]-nx,terrainHeight(bb[0]-nx,bb[1]-nz,config)+.16,bb[1]-nz],s=[bb[0]+nx,terrainHeight(bb[0]+nx,bb[1]+nz,config)+.16,bb[1]+nz];b.quad(p,q,r,s,color);
  }
}
function pointOnCurve(points,t) {
  const i=Math.min(points.length-2,Math.floor(t*(points.length-1))),u=t*(points.length-1)-i,a=points[Math.max(0,i-1)],bb=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  return [0,1].map(axis=>.5*((2*bb[axis])+(-a[axis]+c[axis])*u+(2*a[axis]-5*bb[axis]+4*c[axis]-d[axis])*u*u+(-a[axis]+3*bb[axis]-3*c[axis]+d[axis])*u*u*u));
}
function randomClear(x,z,config,margin=0) {
  if(length2(x-config.entry.x,z-config.entry.z)<14+margin)return false;
  if(Math.abs(x)>config.land.span*.46||Math.abs(z)>config.land.span*.46)return false;
  if(config.settlements.some(s=>length2(x-s.x,z-s.z)<(14+margin)))return false;
  if(config.waters.some(w=>length2(x-w.x,z-w.z)<w.radius+3+margin))return false;
  if(length2(x-config.beacon.x,z-config.beacon.z)<8+margin)return false;
  return true;
}
function buildStaticWorld(config, authoredAssets=[], quality='high') {
  const solid=new MeshBuilder(), water=new MeshBuilder(), terrain=new MeshBuilder(), rng=randomGenerator(config.land.seed), palette=biomePalette(config.land.type), authoredColliders=[];
  const detailScale=quality==='performance'?.65:quality==='balanced'?.88:quality==='ultra'?1.28:quality==='cinematic'?1.5:1.1;
  const vegetationScale=quality==='performance'?.48:quality==='balanced'?.78:quality==='ultra'?1.14:quality==='cinematic'?1.28:1;
  const n=Math.min(256,Math.max(96,Math.round(config.land.detail*detailScale))), span=config.land.span, half=span/2, step=span/n, heights=new Float32Array((n+1)*(n+1)), normals=new Array((n+1)*(n+1)), colors=new Array((n+1)*(n+1));
  const idx=(x,z)=>z*(n+1)+x;
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
    const wx=-half+x*step,wz=-half+z*step,y=terrainHeight(wx,wz,config),no=terrainNormal(wx,wz,config),slope=1-no[1];heights[idx(x,z)]=y;normals[idx(x,z)]=no;
    let col=y<-.5?palette.moss:y<2?palette.grass:y<4.4?palette.grassLight:y<7?palette.rock:palette.rockLight;
    if(slope>.24)col=y>3?palette.rockLight:palette.moss;
    const variation=(noise2(wx*.21,wz*.21,config.land.seed+51)+1)*.5;
    colors[idx(x,z)]=col.map(v=>v*(.91+variation*.18));
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const wx=-half+x*step,wz=-half+z*step;
    const pa=[wx,heights[idx(x,z)],wz],pb=[wx,heights[idx(x+1,z)],wz],pc=[wx+step,heights[idx(x+1,z+1)],wz+step],pd=[wx,heights[idx(x,z+1)],wz+step];
    const na=[normals[idx(x,z)],normals[idx(x+1,z+1)],normals[idx(x+1,z)]], ca=[colors[idx(x,z)],colors[idx(x+1,z+1)],colors[idx(x+1,z)]];
    terrain.triangle(pa,pd,pc,ca[0], [normals[idx(x,z)],normals[idx(x,z+1)],normals[idx(x+1,z+1)]],[colors[idx(x,z)],colors[idx(x,z+1)],colors[idx(x+1,z+1)]]);
    terrain.triangle(pa,pc,pb,ca[0], na,ca);
  }
  // A hand-built trail network intentionally guides discovery without fencing in the world.
  const routes=[[ [config.entry.x,config.entry.z],[-10,5],[-27,12],[-48,18] ],[[config.entry.x,config.entry.z],[5,-10],[12,-34],[config.beacon.x,config.beacon.z]],[[config.entry.x,config.entry.z],[20,18],[40,13],[62,-18]],[[config.entry.x,config.entry.z],[-18,28],[-30,42]]];
  for(const route of routes){const pts=[];for(let i=0;i<72;i++)pts.push(pointOnCurve(route,i/71));addRibbon(solid,pts,2.5,palette.path,config);for(let j=0;j<pts.length;j+=3){const [x,z]=pts[j];if(rng()>.64){const y=terrainHeight(x,z,config)+.1,chip=.09+rng()*.16;addFacetedBoulder(solid,x,y,z,chip,.035,chip*(.7+rng()*.6),palette.rock,Math.floor(rng()*100000));}}}
  // Layered conifers form a silhouette-rich forest, with darker trunks in the foreground.
  for(const s of config.scatters){const sr=randomGenerator(s.seed);let placed=0,tries=0;const targetCount=Math.min(260,Math.max(1,Math.round(s.count*vegetationScale)));while(placed<targetCount&&tries<targetCount*12){tries++;const ang=sr()*Math.PI*2,dist=Math.sqrt(sr())*Math.min(s.radius,half-8),x=config.entry.x+Math.cos(ang)*dist,z=config.entry.z+Math.sin(ang)*dist;if(!randomClear(x,z,config,s.type==='elderpine'?2:0))continue;const y=terrainHeight(x,z,config);if(s.type==='elderpine'){
      const h=4.6+sr()*4.4,r=.85+sr()*.7;addCylinder(solid,x,y,z,r*.3,h*.43,palette.bark,7,.86);addCone(solid,x,y+h*.16,z,r,h*.55,palette.pineDark,8);addCone(solid,x,y+h*.34,z,r*.83,h*.46,palette.pine,8);addCone(solid,x,y+h*.5,z,r*.62,h*.39,palette.pineLight,8);if(sr()>.83)addBox(solid,x,y+h*.72,z,.08,.65,.08,palette.gold,sr()*6.28);
      }else if(s.type==='moonbloom'){
      const h=1.1+sr()*1.7;addSphere(solid,x,y+h*.34,z,.85,.65,.75,palette.deepGrass,8,5);for(let k=0;k<4;k++){const a=k*Math.PI/2+sr()*.3;addSphere(solid,x+Math.cos(a)*.45,y+h*.78,z+Math.sin(a)*.45,.24,.24,.24,k%2?palette.flower:palette.leaf,7,5);}addSphere(solid,x,y+h*.98,z,.18,.18,.18,palette.gold,7,4);
      }else if(s.type==='sunshard'){
      const scale=.8+sr()*.45;addCylinder(solid,x,y,z,.62,.28,palette.stone,7,.8);addCylinder(solid,x,y+.28,z,.34,.18,palette.gold,8,.9);worldShardSeed.push({x,y:y+.52,z,scale,yaw:sr()*6.28,phase:sr()*6.28,col:sr()>.5?C.crystal:C.violet,collected:false});
      }else{
      const h=1+sr()*3;addSphere(solid,x,y+h*.4,z,h*.55,h*.36,h*.58,palette.rock,7,5);
      }
      placed++;}
  }
  // Mixed broadleaf forest breaks the repeated-conifer silhouette and creates biome-specific canopy clusters.
  const broadRng=randomGenerator(config.land.seed+1665),broadCounts={highlands:42,evergreen:44,goldenwood:76,moonfen:34,emberfall:24,alpine:30},broadCount=Math.round((broadCounts[config.land.type]||42)*vegetationScale);
  for(let i=0,placed=0,tries=0;placed<broadCount&&tries<broadCount*12;tries++,i++){
    const x=(broadRng()-.5)*span*.86,z=(broadRng()-.5)*span*.86;if(!randomClear(x,z,config,3))continue;
    const y=terrainHeight(x,z,config);if(y>7.5||y<-.8)continue;const scale=.62+broadRng()*.85;
    addBroadleafTree(solid,x,y,z,scale,palette,config.land.seed+i*31+broadCounts[config.land.type],config.land.type==='goldenwood');placed++;
  }
  // Angular boulders, scree and root-side stones add scale variation to the terrain without texture dependencies.
  const rockRng=randomGenerator(config.land.seed+8119),rockCount=Math.round(58*vegetationScale);
  for(let i=0,placed=0,tries=0;placed<rockCount&&tries<rockCount*12;tries++,i++){
    const x=(rockRng()-.5)*span*.9,z=(rockRng()-.5)*span*.9;if(!randomClear(x,z,config,1))continue;const y=terrainHeight(x,z,config),slope=1-terrainNormal(x,z,config)[1];if(y< -1.8||y>13)continue;
    const scale=.28+rockRng()*(slope>.28?1.45:.85),rx=scale*(.8+rockRng()*.6),rz=scale*(.75+rockRng()*.65),ry=scale*(.35+rockRng()*.38);
    addFacetedBoulder(solid,x,y+ry*.55,z,rx,ry,rz,slope>.3?palette.rockLight:palette.rock,Math.floor(rockRng()*0x7fffffff));
    if(scale>.75&&rockRng()>.52)addFacetedBoulder(solid,x+scale*.78,y+ry*.32,z-scale*.55,scale*.43,scale*.29,scale*.39,palette.rock,Math.floor(rockRng()*0x7fffffff));placed++;
  }
  // Fern and wildflower patches are clustered around sheltered low ground instead of evenly carpeting the terrain.
  const fernRng=randomGenerator(config.land.seed+90211),fernPatches=Math.round(330*vegetationScale);
  for(let i=0;i<fernPatches;i++){const x=(fernRng()-.5)*span*.83,z=(fernRng()-.5)*span*.83;if(!randomClear(x,z,config,1.4))continue;const y=terrainHeight(x,z,config);if(y<-.4||y>5.8)continue;const scale=.32+fernRng()*.52;addFernTuft(solid,x,y+.01,z,scale,palette,Math.floor(fernRng()*0x7fffffff),fernRng()>.68);if(fernRng()>.77){const dx=(fernRng()-.5)*1.1,dz=(fernRng()-.5)*1.1;addFernTuft(solid,x+dx,terrainHeight(x+dx,z+dz,config)+.01,z+dz,scale*.7,palette,Math.floor(fernRng()*0x7fffffff),false);}}
  // Fallen trunks and cut branch debris make the forest floor feel lived-in, with small logs kept away from paths.
  const logRng=randomGenerator(config.land.seed+33277),logCount=Math.round(26*vegetationScale);
  for(let i=0,placed=0,tries=0;placed<logCount&&tries<logCount*10;tries++,i++){const x=(logRng()-.5)*span*.82,z=(logRng()-.5)*span*.82;if(!randomClear(x,z,config,2))continue;const y=terrainHeight(x,z,config);if(y>5||y<-.6)continue;const yaw=logRng()*Math.PI*2,len=1.6+logRng()*3.4,ex=x+Math.cos(yaw)*len,ez=z+Math.sin(yaw)*len;addSegmentCylinder(solid,[x,y+.16,z],[ex,terrainHeight(ex,ez,config)+.16,ez],.14+logRng()*.12,.09,palette.bark,7);if(logRng()>.6)addSegmentCylinder(solid,[x+len*.25*Math.cos(yaw),y+.2,z+len*.25*Math.sin(yaw)],[x+len*.25*Math.cos(yaw)+Math.cos(yaw+1)*.9,y+.85,z+len*.25*Math.sin(yaw)+Math.sin(yaw+1)*.9],.045,.022,palette.barkLight,5);placed++;}
  // Windmere and Stoneveil: compact stylised settlements with rooflines, windows, doors and lanterns.
  for(let si=0;si<config.settlements.length;si++){
    const town=config.settlements[si],tr=randomGenerator(config.land.seed+si*812+67),cy=terrainHeight(town.x,town.z,config);
    addCylinder(solid,town.x,cy+.06,town.z,7,.12,palette.bridge,16,1);
    for(let i=0;i<town.houses;i++){
      const a=i/town.houses*Math.PI*2+(si?.3:0),r=8+tr()*7,x=town.x+Math.cos(a)*r,z=town.z+Math.sin(a)*r,y=terrainHeight(x,z,config),yaw=-a+Math.PI/2,w=2.6+tr()*.65,d=2.7+tr()*.5,h=2.4+tr()*.45;
      // Stone foundation, timber corners, deep eaves and a layered roof create more convincing house silhouettes.
      addBox(solid,x,y+.12,z,w+.22,.24,d+.2,palette.stone,yaw);addBox(solid,x,y+h*.5,z,w,h,d,i%3===0?palette.houseLight:palette.house,yaw);addRoof(solid,x,y+h,z,w+.3,h*.62,d+.28,i%2?palette.roof:palette.roofLight,yaw);
      for(const sx of [-1,1])for(const sz of [-1,1])addBox(solid,x+sx*w*.46,y+h*.5,z+sz*d*.46,.13,h,.13,palette.bark,yaw);
      const frontX=x+Math.sin(yaw)*d*.51,frontZ=z+Math.cos(yaw)*d*.51;addBox(solid,frontX,y+.68,frontZ,.62,1.36,.075,palette.door,yaw);addBox(solid,frontX,y+1.39,frontZ,.78,.11,.12,palette.barkLight,yaw);addBox(solid,frontX-.37*Math.cos(yaw),y+.68,frontZ+.37*Math.sin(yaw),.11,1.36,.12,palette.bark,yaw);addBox(solid,frontX+.37*Math.cos(yaw),y+.68,frontZ-.37*Math.sin(yaw),.11,1.36,.12,palette.bark,yaw);addSphere(solid,frontX+.18*Math.cos(yaw),y+.72,frontZ-.18*Math.sin(yaw),.045,.045,.045,palette.gold,6,4);addBox(solid,frontX,y+.18,frontZ+.22,.88,.2,.48,palette.bridge,yaw);
      for(const side of [-1,1]){const wx=x+Math.cos(yaw)*side*w*.27+Math.sin(yaw)*(d*.51+.045),wz=z-Math.sin(yaw)*side*w*.27+Math.cos(yaw)*(d*.51+.045);addBox(solid,wx,y+1.58,wz,.48,.44,.065,palette.window,yaw);addBox(solid,wx,y+1.58,wz,.6,.065,.12,palette.bark,yaw);addBox(solid,wx,y+1.58,wz,.065,.54,.12,palette.bark,yaw);addBox(solid,wx+Math.cos(yaw)*.23,y+1.58,wz-Math.sin(yaw)*.23,.065,.54,.12,palette.bark,yaw);addBox(solid,wx,y+1.58,wz,.055,.45,.13,palette.bark,yaw);}
      if(i%2===0){addBox(solid,x-w*.24,y+h+1.02,z-d*.15,.4,1.4,.42,palette.stone,yaw);addBox(solid,x-w*.24,y+h+1.75,z-d*.15,.49,.15,.5,palette.stoneLight,yaw);}
      // Small awning beams, roof ridge cap, and a warm porch lantern.
      addBox(solid,x,y+h+.06,z,w+.45,.12,.12,palette.barkLight,yaw);addBox(solid,x,y+h+.12,z-d*.25,.08,.12,d*.52,palette.bark,yaw);
      addSphere(solid,x+Math.sin(yaw)*(d*.7),y+1.55,z+Math.cos(yaw)*(d*.7),.12,.16,.12,C.glow,7,5);
    }
    // Tall common beacon/flagpole makes the village readable from the hills.
    addCylinder(solid,town.x,cy+.1,town.z, .28, 5.5, palette.bark,8,.8);addBox(solid,town.x+.82,cy+4.7,town.z,.98,.62,.06,palette.roof,.15);addSphere(solid,town.x,cy+5.9,town.z,.27,.27,.27,C.glow,8,5);
  }
  // Aetherfall's old aqueduct and a broken ring temple.
  const ruinX=41,ruinZ=-28,ruinY=terrainHeight(ruinX,ruinZ,config);addBox(solid,ruinX,ruinY+.26,ruinZ,16,.52,12,palette.stone);
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const x=ruinX+Math.cos(a)*6,z=ruinZ+Math.sin(a)*4.5,y=terrainHeight(x,z,config);addCylinder(solid,x,y,z,.52,4.6,palette.stoneLight,9,.88);addCylinder(solid,x,y+4.6,z,.7,.35,palette.stone,9,.9);}
  addTorusY(solid,ruinX,ruinY+4.3,ruinZ,3.7,.28,palette.stoneLight,32,8,.05);
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2,x=ruinX+Math.cos(a)*2.5,z=ruinZ+Math.sin(a)*2.5,y=terrainHeight(x,z,config);addCone(solid,x,y,z,.3,1.05,C.violet,6);}
  // Firstlight Spire: layered stone plinths, gold rings and radiant crystal finial.
  const beacon=config.beacon,by=terrainHeight(beacon.x,beacon.z,config);addCylinder(solid,beacon.x,by,beacon.z,4.5,.65,palette.stone,12,.86);addCylinder(solid,beacon.x,by+.65,beacon.z,3.2,.38,palette.gold,12,.9);addCylinder(solid,beacon.x,by+1.03,beacon.z,2.15,5.4,palette.stoneLight,10,.7);addTorusY(solid,beacon.x,by+3.6,beacon.z,2.4,.2,palette.gold,32,8,.12);addCone(solid,beacon.x,by+6.25,beacon.z,1.6,3.3,C.violet,9);addCrystal(solid,beacon.x,by+9.5,beacon.z,2,C.blueGlow);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,x=beacon.x+Math.cos(a)*4.2,z=beacon.z+Math.sin(a)*4.2,y=terrainHeight(x,z,config);addCylinder(solid,x,y,z,.28,1.7,palette.stone,7,.8);addSphere(solid,x,y+1.9,z,.22,.22,.22,C.blueGlow,8,5);}
  // Ruined watchtowers and stone cairns on higher ground give the skyline scale.
  const landmarks=[[81,-74],[105,18],[-96,-72],[84,92],[-104,69]];
  for(let i=0;i<landmarks.length;i++){const [x,z]=landmarks[i],y=terrainHeight(x,z,config),h=4+((i*7)%4);addCylinder(solid,x,y,z,1.2,h,palette.stone,7,.7);addCylinder(solid,x,y+h,z,1.7,.35,palette.stoneLight,7,.8);addCone(solid,x,y+h+.35,z,.8,1.4,i%2?palette.roof:palette.gold,7);}
  // Grass blades in broad meadows; sparse, tiny silhouettes avoid the phone-killing carpet approach.
  const grassRng=randomGenerator(config.land.seed+775);for(let i=0;i<1150;i++){const x=(grassRng()-.5)*span*.86,z=(grassRng()-.5)*span*.86;if(!randomClear(x,z,config,1))continue;const y=terrainHeight(x,z,config);if(y>5||y< -1)continue;const a=grassRng()*Math.PI*2,h=.22+grassRng()*.58,w=.035+grassRng()*.025,dx=Math.cos(a)*w,dz=Math.sin(a)*w;const green=grassRng()>.5?palette.grassLight:palette.leaf;solid.triangle([x-dx,y,z-dz],[x+dx,y,z+dz],[x+Math.cos(a+1.3)*w,y+h,z+Math.sin(a+1.3)*w],green);solid.triangle([x+dx,y,z+dz],[x-dx,y,z-dz],[x+Math.cos(a-1.3)*w,y+h*.85,z+Math.sin(a-1.3)*w],palette.deepGrass);}
  // Timber crossing over the edge of Moonwater.
  for(let i=0;i<12;i++){const z=config.waters[0].z-config.waters[0].radius*.68+i*.85,x=config.waters[0].x;const y=config.waters[0].y+.18;addBox(solid,x,y,z,5.2,.18,.7,palette.bridge);if(i%3===0){addCylinder(solid,x-2.35,y-.1,z,.12,.85,palette.bark,6);addCylinder(solid,x+2.35,y-.1,z,.12,.85,palette.bark,6);}}
  const interactables=[];
  const customLandmarks=[];
  // Ancient Lore Waystones and Guardian NPCs placed at key points in the world.
  const town0=config.settlements[0]||{x:-48,z:18};
  const lyraX=town0.x+3.4,lyraZ=town0.z-2.6,lyraY=terrainHeight(lyraX,lyraZ,config);
  addCylinder(solid,lyraX,lyraY+.45,lyraZ,.28,.9,C.cloth,8,.75);addSphere(solid,lyraX,lyraY+1.15,lyraZ,.22,.24,.22,C.skin,8,6);addCylinder(solid,lyraX+.36,lyraY+.65,lyraZ+.15,.04,1.35,palette.barkLight,6,1);addSphere(solid,lyraX+.36,lyraY+1.4,lyraZ+.15,.12,.14,.12,C.glow,7,5);
  interactables.push({id:'npc-lyra',kind:'npc',name:'Elder Lyra · Windmere Keeper',x:lyraX,z:lyraZ,lore:'"When the Sunshards shattered across the valley, the old roads dimmed. Gather the fragments and carry their resonance to Firstlight Spire."'});
  const kaelX=beacon.x-5.4,kaelZ=beacon.z+4.2,kaelY=terrainHeight(kaelX,kaelZ,config);
  addCylinder(solid,kaelX,kaelY+.48,kaelZ,.31,.96,C.armor,8,.8);addSphere(solid,kaelX,kaelY+1.2,kaelZ,.23,.25,.23,C.skin,8,6);addCrystal(solid,kaelX-.38,kaelY+.95,kaelZ,.35,C.blueGlow,.4);
  interactables.push({id:'npc-kael',kind:'npc',name:'Warden Kael · Spire Sentinel',x:kaelX,z:kaelZ,lore:'"The Spire answers only when enough Sunshards harmonize. Press Q or use Resonance Pulse if a fragment hides in the mist."'});
  const waystones=[
    {id:'lore-entry',name:'Waystone of the First Road',x:config.entry.x+4.2,z:config.entry.z-3.8,lore:'Inscribed in RealmScript: "By glyph and stone the valley was shaped; walk the four trails to bind the broken light."'},
    {id:'lore-lake',name:'Moonwater Obelisk',x:(config.waters[0]?.x??-32)+config.waters[0]?.radius*.78,z:(config.waters[0]?.z??34)-2.5,lore:'"Beneath Moonwater sleeps the mirror of the stars. Even in storm or winter snow, its waters remember the sun."'},
    {id:'lore-temple',name:'Chronicle of the Ring Temple',x:ruinX-4.5,z:ruinZ+3.2,lore:'"Here the architects of Orvexa forged the first resonance rings before ascending to the high ridges."'},
  ];
  for(const ws of waystones){
    const wy=terrainHeight(ws.x,ws.z,config);
    addCylinder(solid,ws.x,wy,ws.z,.55,.28,palette.stone,7,.85);addBox(solid,ws.x,wy+.78,ws.z,.48,1.25,.28,palette.stoneLight,.35);addCrystal(solid,ws.x,wy+1.55,ws.z,.36,C.crystal,.35);
    interactables.push({id:ws.id,kind:'waystone',name:ws.name,x:ws.x,z:ws.z,lore:ws.lore});
  }
  // Custom meshes published from Orvexa Modeler become actual world geometry, using the scene renderer's transform order.
  for(const asset of authoredAssets){
    const geometry=asset.geometry||[],mat=asset.material||{},base=linearHex(asset.color||'#8b9b80');
    const emissive=Math.min(2,Number(mat.emissive)||0),metallic=Math.min(1,Math.max(0,Number(mat.metallic)||0));
    const color=base.map(v=>v*(1+emissive*.52)*(1+metallic*.06));let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<geometry.length;i+=9){const points=[];for(let k=0;k<9;k+=3){const p=transformWorldAssetVertex([geometry[i+k],geometry[i+k+1],geometry[i+k+2]],asset);points.push(p);minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);}solid.triangle(points[0],points[1],points[2],color);}
    const radius=Math.hypot((maxX-minX)*.5,(maxZ-minZ)*.5),cx=Number(asset.position?.x)||0,cz=Number(asset.position?.z)||0;
    if(asset.collisionMode!=='none'&&radius>=.45&&radius<=5.5&&Math.abs(cx)<half&&Math.abs(cz)<half)authoredColliders.push({x:cx,z:cz,r:radius,name:asset.name});
    if(['landmark','lore-shrine','beacon-totem'].includes(asset.gameplayRole)||asset.loreText){
      customLandmarks.push({name:asset.name,x:cx,z:cz});
      interactables.push({id:`custom-${asset.id}`,kind:asset.gameplayRole||'landmark',name:asset.name,x:cx,z:cz,lore:asset.loreText||`Authored in Orvexa Modeler (${asset.material?.preset||'custom PBR'}) and published into Aetherfall.`});
    }
  }
  // Water ribbons are separate so the shader can animate highlights without re-uploading terrain.
  for(const lake of config.waters){const steps=96;for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2,bb=(i+1)/steps*Math.PI*2;const c=[lake.x,lake.y,lake.z],p=[lake.x+Math.cos(a)*lake.radius,lake.y,lake.z+Math.sin(a)*lake.radius],q=[lake.x+Math.cos(bb)*lake.radius,lake.y,lake.z+Math.sin(bb)*lake.radius];water.triangle(c,p,q,palette.water,[ [0,1,0],[0,1,0],[0,1,0] ]);}
    for(let k=0;k<3;k++){const r=lake.radius*(.32+k*.18);for(let i=0;i<steps;i+=2){const a=i/steps*Math.PI*2,bb=(i+1)/steps*Math.PI*2;water.triangle([lake.x+Math.cos(a)*r,lake.y+.015,lake.z+Math.sin(a)*r],[lake.x+Math.cos(bb)*r,lake.y+.015,lake.z+Math.sin(bb)*r],[lake.x+Math.cos(bb)*(r+.1),lake.y+.015,lake.z+Math.sin(bb)*(r+.1)],C.blueGlow,[[0,1,0],[0,1,0],[0,1,0]]);}}
  }
  // Collectibles are tracked separately and rebuilt as a tiny animated batch.
  const shards=worldShardSeed.map((s,i)=>({...s,id:i,baseY:s.y}));
  // Keep terrain in its own GPU mesh: the foliage wind vertex shader is applied only to the world-detail mesh, never the ground heightfield.
  const terrainData=terrain.finish(), solidData=solid.finish(), waterData=water.finish();
  return { solid:solidData, terrain:terrainData, water:waterData, shards, interactables, colliders:[{x:beacon.x,z:beacon.z,r:2.7},{x:ruinX,z:ruinZ,r:5},...authoredColliders], landmarks:[{name:'Windmere',x:config.settlements[0]?.x??-48,z:config.settlements[0]?.z??18},{name:'Firstlight Spire',x:beacon.x,z:beacon.z},{name:'Moonwater Lake',x:config.waters[0]?.x??-32,z:config.waters[0]?.z??34},{name:'Old Stone Temple',x:ruinX,z:ruinZ},...customLandmarks], stats:{terrainTriangles:terrainData.length/27,triangles:(terrainData.length+solidData.length)/27,scatterCount:config.scatters.reduce((s,x)=>s+x.count,0),terrainVertices:(n+1)**2,authoredModels:authoredAssets.length,windAnimated:true} };
}
// Build the shard records before static scatter so each seed directive can append into this scoped list.
let worldShardSeed=[];

const MAIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uViewProjection;
uniform mat4 uLightViewProjection;
uniform float uTime;
uniform float uWindStrength;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec4 vShadowPosition;
vec3 windDeform(vec3 p, vec3 color){float greenMask=smoothstep(.10,.34,color.g-max(color.r,color.b)*.48);float canopy=greenMask*smoothstep(1.7,5.2,p.y);float gust=sin(uTime*1.35+p.x*.17+p.z*.13)*.16+sin(uTime*.71+p.z*.23)*.07;p.x+=gust*canopy*uWindStrength;p.z+=cos(uTime*.88+p.x*.12-p.z*.15)*.055*canopy*uWindStrength;return p;}
void main(){vec3 p=windDeform(aPosition,aColor);vWorld=p;vNormal=aNormal;vColor=aColor;vShadowPosition=uLightViewProjection*vec4(p,1.0);gl_Position=uViewProjection*vec4(p,1.0);}`;
const MAIN_FS = `#version 300 es
precision highp float;
in vec3 vWorld;in vec3 vNormal;in vec3 vColor;in vec4 vShadowPosition;
uniform vec3 uCamera;uniform vec3 uSunDirection;uniform vec3 uSunColor;uniform vec3 uAmbientColor;uniform vec3 uFogColor;uniform float uTime;uniform float uFogFar;uniform float uWater;uniform float uShadowEnabled;uniform float uDaylight;uniform float uSolarIntensity;uniform float uAmbientIntensity;uniform float uWeather;uniform vec2 uWaterCenter;uniform float uWaterRadius;uniform sampler2D uShadowMap;uniform vec2 uShadowTexel;
out vec4 outColor;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm21(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise21(p)*a;p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}
float getShadow(vec3 N,vec3 L){if(uShadowEnabled<0.5||uWater>0.5)return 0.0;vec3 p=vShadowPosition.xyz/vShadowPosition.w;p=p*0.5+0.5;if(p.z>0.998||p.z<0.001||p.x<0.002||p.x>0.998||p.y<0.002||p.y>0.998)return 0.0;float bias=max(0.00055*(1.0-dot(N,L)),0.00016);float shade=0.0;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(uShadowMap,p.xy+vec2(float(x),float(y))*uShadowTexel).r;shade+=p.z-bias>d?1.0:0.0;}return shade/9.0;}
float distributionGGX(vec3 N,vec3 H,float rough){float a=rough*rough,a2=a*a,ndh=max(dot(N,H),0.0),d=ndh*ndh*(a2-1.0)+1.0;return a2/max(3.14159265*d*d,0.0001);}
float geometrySchlick(float ndv,float rough){float r=rough+1.0,k=(r*r)/8.0;return ndv/max(ndv*(1.0-k)+k,0.0001);}
vec3 fresnelSchlick(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-clamp(c,0.0,1.0),5.0);}
vec3 filmic(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){
 vec3 N=normalize(vNormal),L=normalize(uSunDirection),V=normalize(uCamera-vWorld),H=normalize(L+V);float ndl=max(dot(N,L),0.0),shadow=getShadow(N,L);vec3 base=vColor;
 float greenSignal=clamp((vColor.g-max(vColor.r,vColor.b)*.48)*2.8,0.0,1.0),groundMask=smoothstep(.08,.34,greenSignal)*smoothstep(.54,.88,N.y);
 float broad=fbm21(vWorld.xz*.115),grain=fbm21(vWorld.xz*1.65+vec2(broad*2.1)),flecks=smoothstep(.53,.79,noise21(vWorld.xz*3.7));
 base*=mix(.90,1.13,broad)*mix(.91,1.08,grain)*mix(1.0,1.12,flecks*groundMask);base.g+=groundMask*(grain-.5)*.105;base.r-=groundMask*flecks*.018;
 float slope=1.0-clamp(N.y,0.0,1.0);base*=1.0-smoothstep(.24,.72,slope)*.13;N=normalize(N+vec3(dFdx(grain),0.0,dFdy(grain))*groundMask*.32);
 // Weather responds on the material surface: rain darkens and glosses exposed ground; snow settles on upward-facing surfaces with noisy edges.
 float rainWet=smoothstep(1.55,2.05,uWeather)*(1.0-smoothstep(2.8,3.0,uWeather));float snowWeather=smoothstep(2.75,3.0,uWeather);float snowNoise=fbm21(vWorld.xz*.47+vec2(broad*1.7,grain));float snowMask=snowWeather*smoothstep(.46,.72,N.y)*smoothstep(.27,.68,snowNoise)*smoothstep(-2.0,5.0,vWorld.y);
 base=mix(base,base*vec3(.57,.63,.68),rainWet*.38);base=mix(base,vec3(.72,.79,.84)*(0.91+grain*.1),snowMask*.94);
 float roughness=clamp(mix(.88,.3,smoothstep(.03,.4,vColor.r-vColor.g)),.14,.96);roughness=mix(roughness,.19,rainWet*.82);roughness=mix(roughness,.82,snowMask*.8);float metalness=clamp((vColor.r-vColor.b)*.75,0.0,.5);float radial=length(vWorld.xz-uWaterCenter);
 if(uWater>0.5){float wave=sin(vWorld.x*.17+uTime*.65)*cos(vWorld.z*.14-uTime*.55)+sin((vWorld.x+vWorld.z)*.07-uTime*.8)*.35;float ripple=fbm21(vWorld.xz*.34+uTime*.035);float fres=pow(1.0-max(dot(N,V),0.0),3.0);float spark=pow(max(dot(reflect(-L,N),V),0.0),64.0);float shoreline=1.0-smoothstep(uWaterRadius-1.8,uWaterRadius,radial);float foamNoise=fbm21(vWorld.xz*1.25+vec2(uTime*.06,-uTime*.04));float foam=smoothstep(.56,.78,foamNoise)*shoreline;N=normalize(N+vec3(wave*.13,0.0,wave*.11));base=mix(vec3(.008,.048,.082),vec3(.035,.21,.31),.34+wave*.13+ripple*.14);base=mix(base,vec3(.48,.63,.62),foam*.8);base+=vec3(.27,.44,.53)*spark*.5+vec3(.13,.32,.43)*fres*.46;roughness=.095;metalness=.12;ndl=max(dot(N,L),0.0);H=normalize(L+V);}
 vec3 f0=mix(vec3(.04),base,metalness);float ndv=max(dot(N,V),.001),D=distributionGGX(N,H,roughness),G=geometrySchlick(ndv,roughness)*geometrySchlick(max(dot(N,L),0.0),roughness);vec3 F=fresnelSchlick(max(dot(H,V),0.0),f0);vec3 specular=(D*G*F)/max(4.0*ndv*max(dot(N,L),0.0),.001);vec3 kd=(vec3(1.0)-F)*(1.0-metalness);
 float ao=(.92+.08*fbm21(vWorld.xz*.7));vec3 skyFill=uAmbientColor;vec3 ambient=base*skyFill*(.55+.45*max(N.y,0.0))*uAmbientIntensity*ao;
 vec3 direct=(kd*base/3.14159265+specular)*uSunColor*uSolarIntensity*ndl*(1.0-shadow*.76);float emissive=smoothstep(.76,1.2,max(max(vColor.r,vColor.g),vColor.b));vec3 lit=ambient+direct+base*emissive*.38;
 float rim=pow(1.0-max(dot(N,V),0.0),3.0);lit+=mix(vec3(.035,.09,.13),vec3(.16,.31,.38),uDaylight)*rim*.13;
 float dist=length(uCamera-vWorld),fog=smoothstep(uFogFar*.28,uFogFar*mix(1.0,.72,clamp(uWeather/3.0,0.0,1.0)),dist);float heightFog=(1.0-smoothstep(1.0,11.0,vWorld.y))*fog*.16;fog=clamp(fog*(1.0+uWeather*.16)+heightFog,0.0,.9);lit=mix(lit,uFogColor,fog);lit+=uFogColor*(1.0-fog)*.018;outColor=vec4(pow(filmic(max(lit,vec3(0.0))),vec3(1.0/2.2)),1.0);
}`;
const SHADOW_VS = `#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;layout(location=2) in vec3 aColor;uniform mat4 uLightViewProjection;uniform float uTime;uniform float uWindStrength;
vec3 windDeform(vec3 p, vec3 color){float greenMask=smoothstep(.10,.34,color.g-max(color.r,color.b)*.48);float canopy=greenMask*smoothstep(1.7,5.2,p.y);float gust=sin(uTime*1.35+p.x*.17+p.z*.13)*.16+sin(uTime*.71+p.z*.23)*.07;p.x+=gust*canopy*uWindStrength;p.z+=cos(uTime*.88+p.x*.12-p.z*.15)*.055*canopy*uWindStrength;return p;}
void main(){gl_Position=uLightViewProjection*vec4(windDeform(aPosition,aColor),1.0);}`;
const SHADOW_FS = `#version 300 es
precision highp float;void main(){}`;
const SKY_VS = `#version 300 es
precision highp float;out vec2 vUv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,1.0,1.0);}`;
const SKY_FS = `#version 300 es
precision highp float;in vec2 vUv;uniform vec2 uResolution;uniform vec2 uSunScreen;uniform float uTime;uniform vec3 uSkyHorizon;uniform vec3 uSkyMiddle;uniform vec3 uSkyZenith;uniform vec3 uSkySun;uniform vec3 uSkyCloud;uniform float uDaylight;uniform float uWeather;out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.02+vec2(13.7,7.1);a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/uResolution;float h=clamp(uv.y,0.0,1.0);vec3 nightHorizon=vec3(.018,.027,.065),nightMiddle=vec3(.018,.036,.105),nightZenith=vec3(.004,.009,.035);vec3 horizon=mix(nightHorizon,uSkyHorizon,uDaylight),middle=mix(nightMiddle,uSkyMiddle,uDaylight),zenith=mix(nightZenith,uSkyZenith,uDaylight);vec3 sky=mix(horizon,middle,smoothstep(.015,.43,h));sky=mix(sky,zenith,smoothstep(.32,.98,h));vec2 cloudUV=vec2(uv.x*5.2+uTime*.003,uv.y*10.0);float warp=fbm(cloudUV*.7),cloudNoise=fbm(cloudUV+vec2(warp*.8,-warp*.25));float weatherCoverage=clamp(uWeather/3.0,0.0,1.0);float cloudBand=smoothstep(.47-weatherCoverage*.13,.76-weatherCoverage*.12,cloudNoise)*smoothstep(.035,.3,h)*(1.0-smoothstep(.48,.72,h));cloudBand*=mix(1.0,1.9,weatherCoverage);float cloudLight=smoothstep(.42,.78,cloudNoise);vec3 cloudTone=mix(uSkyCloud,vec3(.22,.26,.34),weatherCoverage*.68);sky=mix(sky,cloudTone,clamp(cloudBand*(.27+weatherCoverage*.22),0.0,.68));sky+=uSkySun*cloudBand*cloudLight*.065*uDaylight;vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);float d=length((uv-uSunScreen)*aspect);float glow=exp(-d*7.0)*uDaylight,disc=(1.0-smoothstep(.012,.019,d))*uDaylight;sky+=uSkySun*glow*.43+mix(uSkySun,vec3(1.0),.48)*disc;float halo=exp(-abs(h-.23)*7.0);sky+=uSkyHorizon*.15*halo*uDaylight;float night=1.0-uDaylight;vec2 starCell=floor(uv*vec2(320.0,190.0));float starSeed=hash(starCell);float star=step(.9972,starSeed)*smoothstep(.35,.76,h)*night;float twinkle=.55+.45*sin(uTime*1.7+starSeed*90.0);sky+=vec3(.72,.84,1.0)*star*twinkle*.85;float cloudSilver=cloudBand*night*.2;sky+=vec3(.12,.18,.3)*cloudSilver;sky=mix(sky,vec3(.22,.25,.31),weatherCoverage*.12);outColor=vec4(pow(max(sky,0.0),vec3(1.0/2.2)),1.0);}`;

function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(shader)||'Shader compile failed';gl.deleteShader(shader);throw new Error(msg);}return shader;}
function link(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Shader link failed');return p;}
function packGpuMesh(gl,data,dynamic=false){const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const stride=9*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,24);gl.bindVertexArray(null);return {vao,buffer,count:data.length/9,dynamic};}
function updateGpuMesh(gl,mesh,data){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);mesh.count=data.length/9;}
function disposeGpuMesh(gl,mesh){if(!mesh)return;gl.deleteBuffer(mesh.buffer);gl.deleteVertexArray(mesh.vao);}

export function mountAetherfallGame(container, options={}) {
  let source=String(options.source||DEFAULT_REALM_SOURCE), config;
  try { config=parseRealmSource(source); } catch { source=DEFAULT_REALM_SOURCE;config=parseRealmSource(source); }
  container.innerHTML=`<div class="aether-game" aria-label="Aetherfall open world game">
    <canvas class="aether-canvas" tabindex="0" aria-label="Playable Aetherfall world"></canvas>
    <div class="aether-topbar"><div class="aether-brand"><span class="aether-brand-mark">✦</span><span><strong>${safeText(config.name)}</strong><small>ORVEXA REALM · OPEN WORLD</small></span></div><div class="aether-top-center"><span class="aether-live"><i></i> LIVE WORLD</span><span class="aether-coords" data-coords>0 · 0</span></div><div class="aether-actions"><button data-action="pulse" class="aether-btn" title="Wayfarer Resonance Pulse (E)">◎ Pulse</button><button data-action="sunblade" class="aether-btn" title="Sunblade Combat (R)">⚔ Sunblade</button><button data-action="dash" class="aether-btn" title="Phase Dash (F)">» Dash</button><button data-action="builder" class="aether-btn" title="Live In-Game World Builder (B)">🧱 Builder</button><button data-action="journal" class="aether-btn" title="Wayfarer Journal &amp; Inventory (J)">📖 Journal</button><button data-action="realm" class="aether-btn">⌘ RealmScript</button><button data-action="settings" class="aether-btn">⚙ Settings</button><button data-action="pause" class="aether-btn primary">Ⅱ Pause</button><button data-action="stop" class="aether-btn danger">■ Stop</button><button data-action="exit" class="aether-btn icon">↗ Studio</button></div></div>
    <div class="aether-vignette"></div><div class="aether-location"><span class="aether-location-icon">⌖</span><div><small>YOU HAVE REACHED</small><strong data-location>Windmere Outskirts</strong></div></div>
    <div class="aether-quest"><div class="aether-quest-top"><span class="aether-quest-icon">✧</span><span>THE FIRST LIGHT</span><span class="aether-quest-state" data-quest-state>ACTIVE</span></div><strong data-quest-title>Find the Sunshards</strong><p data-quest-copy>Recover ancient light fragments scattered across Aetherfall.</p><div class="aether-progress"><span data-progress-bar></span></div><div class="aether-progress-row"><span data-progress-count>0 / ${config.beacon.unlock}</span><span data-progress-label>LIGHT FRAGMENTS</span></div></div>
    <div class="aether-contracts"><div class="aether-quest-top"><span class="aether-quest-icon">⚑</span><span>WAYFARER CONTRACTS</span><span class="aether-quest-state" data-contract-rank>RANK 1 · NOVICE</span></div><div data-contract-list></div><div class="aether-daily" data-daily-challenge>⭐ Daily Challenge loading…</div></div>
    <div class="aether-compass" data-compass><span>N</span><i></i><b>E</b><em>S</em><small>W</small></div>
    <div class="aether-minimap-wrap"><canvas class="aether-minimap" width="180" height="180" aria-label="World minimap"></canvas><div class="aether-map-caption"><span>WORLD MAP</span><button data-action="map">⌗</button></div></div>
    <div class="aether-world-stats"><span><i></i><b data-fps>60</b> FPS</span><span>✦ <b data-shards>0</b> / ${config.beacon.unlock} SHARDS</span><span>📖 <b data-lore-count>0</b> LORE</span><span>◈ <b data-world-tris>—</b> TRIS</span><span>◇ <b data-authored-model-count>0</b> CUSTOM MODELS</span></div>
    <div class="aether-control-hint"><kbd>W A S D</kbd> Move <kbd>SHIFT</kbd> Sprint <kbd>SPACE</kbd> Jump <kbd>E</kbd> Resonance Pulse / Interact <kbd>R</kbd> Sunblade Combat <kbd>F</kbd> Phase Dash <kbd>B</kbd> World Builder <kbd>J</kbd> Journal <kbd>ESC</kbd> Pause</div>
    <div class="aether-touch-ui"><div class="aether-joystick" data-joystick><div></div></div><div class="aether-touch-buttons"><button data-action="touch-sprint">SPRINT</button><button data-action="touch-jump">↑ JUMP</button><button data-action="touch-use">USE</button></div></div>
    <div class="aether-crosshair">+</div><div class="aether-interact-hint" data-interact-hint hidden>E / USE · Interact</div><div class="aether-toast" data-toast aria-live="polite"></div>
    <div class="aether-pause-screen" data-pause-screen hidden><div class="aether-pause-card"><div class="aether-menu-mark">✦</div><span class="aether-menu-kicker">AETHERFALL · REALM ENGINE</span><h2 data-pause-title>World paused</h2><p data-pause-copy>Your journey is waiting.</p><button data-action="resume" class="aether-menu-primary">▶ Continue Journey</button><div class="aether-menu-row"><button data-action="restart">↻ Restart world</button><button data-action="stop">■ Stop session</button><button data-action="settings">⚙ World settings</button></div><div class="aether-menu-foot">Current run only · No account required</div></div></div>
    <aside class="aether-side-panel" data-journal-panel hidden><div class="aether-panel-head"><div><small>WAYFARER CHRONICLE</small><h3>Journal &amp; Inventory</h3></div><button data-action="close-journal" aria-label="Close Journal">×</button></div><p>Track recovered Sunshards, spoken Guardians, ancient Waystone inscriptions, and Modeler-published landmarks across Aetherfall.</p><div class="aether-diagnostics" data-journal-inventory>Sunshards: 0 · Waystones &amp; Guardians: 0</div><div data-journal-entries style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;margin:10px 0"></div><button data-action="pulse" class="aether-menu-primary">◎ Emit Resonance Pulse (Locate Nearest Objective)</button></aside>
    <aside class="aether-side-panel" data-builder-panel hidden><div class="aether-panel-head"><div><small>LIVE IN-GAME WORLD BUILDER</small><h3>World Builder</h3></div><button data-action="close-builder" aria-label="Close World Builder">×</button></div><p>Place living world pieces right where you stand. Walk to a spot, face the view, and tap a piece — it appears in the world instantly.</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><button data-builder-place="crystal" class="aether-btn">◆ Crystal</button><button data-builder-place="pine" class="aether-btn">🌲 Pine</button><button data-builder-place="stone" class="aether-btn">🪨 Stone</button><button data-builder-place="campfire" class="aether-btn">🔥 Campfire</button><button data-builder-place="waystone" class="aether-btn">✦ Waystone</button><button data-builder-place="clear" class="aether-btn">✕ Clear placed</button></div><div class="aether-diagnostics" data-builder-count>0 pieces placed with World Builder</div></aside>
    <aside class="aether-side-panel" data-realm-panel hidden><div class="aether-panel-head"><div><small>WORLD AUTHORING</small><h3>RealmScript</h3></div><button data-action="close-realm" aria-label="Close RealmScript">×</button></div><p>Author terrain, biomes, settlements, scatter rules and the quest. Models published from Orvexa Modeler can be synchronized into this world.</p><div class="aether-asset-sync"><span><b data-asset-sync-count>0</b> models published from Modeler</span><button data-action="sync-assets">↻ Sync Modeler Assets</button></div><textarea data-realm-source spellcheck="false" aria-label="Edit RealmScript">${safeText(source)}</textarea><div class="aether-diagnostics" data-realm-diagnostics>Ready to compile ${safeText(config.name)}.</div><button data-action="apply-realm" class="aether-menu-primary">✦ Compile & Rebuild World</button><div class="aether-panel-tip">Glyph key: ☼ sky · ▧ land · ⌖ entry · ✧ scatter · ⌂ settlement · ≋ waters · ✦ beacon · ⚙ rules</div></aside>
    <aside class="aether-settings-panel" data-settings-panel hidden><div class="aether-panel-head"><div><small>REALTIME RENDERER</small><h3>World settings</h3></div><button data-action="close-settings" aria-label="Close settings">×</button></div><label>Graphics quality<select data-quality><option value="balanced">Balanced · smoother</option><option value="high" selected>High · detailed</option><option value="ultra">Ultra · maximum detail</option><option value="cinematic">Cinematic · highest quality</option><option value="performance">Performance · low load</option></select></label><label>Camera sensitivity <input type="range" min="2" max="14" value="7" data-sensitivity></label><label>Time of day <output data-time-label>15:30</output><input type="range" min="0" max="24" step="0.25" value="15.5" data-time-of-day></label><label class="aether-check"><input type="checkbox" data-day-cycle checked> Automatic day/night cycle</label><label>Weather<select data-weather><option value="clear" selected>Clear · bright sky</option><option value="overcast">Overcast · soft light</option><option value="rain">Rain · storm haze</option><option value="snow">Snow · winter ambience</option></select></label><label class="aether-check"><input type="checkbox" data-minimap checked> Show world map</label><label class="aether-check"><input type="checkbox" data-shadows checked> Dynamic shadows</label><label class="aether-check"><input type="checkbox" data-sound checked> Sound FX (Orvexa synthesized)</label><label>Ambience pack<select data-soundpack><option value="off" selected>Off — sirf SFX</option><option value="forest">🌲 Forest Wind Pad</option><option value="crystal">🔮 Crystal Harp</option><option value="cyber">🌆 Cyber Bass Loop</option></select></label><p>Quality changes terrain density, foliage, wildlife, render resolution and shadow-map size. Wind animates the canopy and matching shadows; time and weather affect sunlight, clouds, fog, precipitation and night fireflies.</p><button data-action="close-settings" class="aether-menu-primary">Apply settings</button></aside>
    <div class="aether-win-screen" data-win-screen hidden><div class="aether-win-card"><div class="aether-win-icon">✦</div><span>REALM RESTORED</span><h2>Light returns to Aetherfall</h2><p>You awakened Firstlight Spire. The old roads glow again.</p><button data-action="resume" class="aether-menu-primary">Explore the realm</button><button data-action="restart">Begin a new journey</button></div></div>
    <div class="aether-error" data-error hidden></div>
  </div>`;
  const root=container.querySelector('.aether-game'),canvas=root.querySelector('canvas.aether-canvas'),ctxMap=root.querySelector('.aether-minimap').getContext('2d');
  const $=(s)=>root.querySelector(s);const $$=(s)=>[...root.querySelectorAll(s)];
  let gl=null,mainProgram=null,shadowProgram=null,skyProgram=null,shadowTexture=null,shadowFbo=null,shadowSize=1024,shadowOk=false;
  let staticMesh=null,terrainMesh=null,waterMesh=null,avatarMesh=null,shardMesh=null,weatherMesh=null,wildlifeMesh=null,builderMesh=null,worldData=null;
  let raf=0,lastFrame=0,elapsed=0,paused=false,stopped=false,disposed=false,win=false,toastTimer=0,lastFpsTime=0,lastWeatherUpdate=0,lastWildlifeUpdate=0,lastSaveClock=0,frames=0,fps=60,frameAverage=16.7,renderScale=.9,quality='high',shadowsEnabled=true,adaptiveScale=1,cameraSensitivity=.007,timeOfDay=15.5,dayNightCycle=true,worldWeather='clear',authoredAssets=[];
  let player={x:config.entry.x,y:0,z:config.entry.z,vx:0,vy:0,vz:0,yaw:0,grounded:true,walkPhase:0};
  const builderItems=[];let sunbladeSwings=0,sunbladeUntil=0,dashCooldownUntil=0;
  let cameraYaw=0,cameraPitch=.12,cameraDistance=7.2,mouseDrag=null,keys=new Set(),touchMove={x:0,y:0},sprinting=false,jumpQueued=false,interactQueued=false,mapVisible=true;
  const visited=new Set(),nearbyShard={index:-1,distance:Infinity};
  let skyPalette=skySettingsFor(config.sky); let shaderFogColor=skyPalette.fog; let sunDirection=skyPalette.direction; let environment=calculateWorldEnvironment(timeOfDay,worldWeather);
  const info={collected:0,objective:'shards',activated:false,activeLocation:'Windmere Outskirts'};
  const discoveredLore=new Set();
  const GUARDIAN_BLESSINGS=['Swiftness of Dawn — tez kadam, halki hawa','Emberheart Warmth — thand me garmaahat','Tidecaller Luck — gehrai me khazana zyada chamakta hai','Stonehide Calm — girne se kam chot','Starlit Insight — agla Sunshard aur paas lagta hai','Windsong Grace — Phase Dash aur door tak','Sunpetal Joy — phoolon ke paas dil khush','Firstlight Favour — Spire aapko pehchanta hai'];
  const blessingsEarned=new Set();
  function blessingFor(count){return GUARDIAN_BLESSINGS[(Math.max(1,count)-1)%GUARDIAN_BLESSINGS.length];}
  function refreshBlessings(){blessingsEarned.clear();for(let i=1;i<=discoveredLore.size;i++)blessingsEarned.add(blessingFor(i));}
  const nearbyInteractable={item:null,distance:Infinity};
  function safeText(t){return String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
  function showToast(text){const el=$('[data-toast]');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function readModelerAssets(){try{const raw=localStorage.getItem(WORLD_ASSETS_STORAGE_KEY);if(!raw)return[];return normalizeWorldAssetPackage(raw).assets;}catch(error){console.warn('Published Aetherfall assets could not be loaded:',error);return[];}}
  function gameSaveKey(){return `orvexa-aetherfall-save-v1:${config.land.seed}`;}
  let soundEnabled = true;
  function sfx(preset) { if (!soundEnabled) return; try { const r = playSynthPreset(preset); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch { /* audio unavailable: gameplay continues silently */ } }
  let stalkerDefeats = 0;
  const contractsDone = new Set();
  const CONTRACTS = [
    { id: 'awaken-shrines', icon: '✦', label: 'Awaken the Guardian Shrines', target: 3, progress: () => discoveredLore.size },
    { id: 'defeat-stalkers', icon: '⚔', label: 'Defeat Shadow Stalkers', target: 3, progress: () => stalkerDefeats },
    { id: 'construct-outpost', icon: '🧱', label: 'Construct an Outpost (Builder)', target: 5, progress: () => builderItems.length },
    { id: 'sunspire-peak', icon: '☀', label: 'Reach Sunspire Peak (Firstlight)', target: 1, progress: () => (info.activated ? 1 : 0) },
  ];
  const RANK_NAMES = ['NOVICE', 'PATHFINDER', 'WARDEN', 'LUMEN KNIGHT', 'FIRSTLIGHT WAYFARER'];
  function wayfarerRank() { return Math.min(RANK_NAMES.length, 1 + CONTRACTS.filter(c => contractsDone.has(c.id)).length); }
  function updateContracts() {
    const list = $('[data-contract-list]'); if (!list) return;
    for (const c of CONTRACTS) {
      const value = Math.min(c.target, Math.max(0, c.progress()));
      if (value >= c.target && !contractsDone.has(c.id)) {
        contractsDone.add(c.id);
        sfx('victory-fanfare');
        showToast(`🏆 Achievement unlocked: ${c.label} · Wayfarer Rank ${wayfarerRank()} (${RANK_NAMES[wayfarerRank() - 1]})`);
        saveGame();
      }
    }
    const rankEl = $('[data-contract-rank]'); if (rankEl) rankEl.textContent = `RANK ${wayfarerRank()} · ${RANK_NAMES[wayfarerRank() - 1]}`;
    updateDailyChallenge();
    list.innerHTML = CONTRACTS.map(c => {
      const value = Math.min(c.target, Math.max(0, c.progress()));
      const done = contractsDone.has(c.id) || value >= c.target;
      return `<div class="aether-contract${done ? ' done' : ''}"><span>${done ? '✅' : c.icon}</span><span class="aether-contract-label">${c.label}</span><b>${value} / ${c.target}</b></div>`;
    }).join('');
  }
  let ambientHandle = null;
  function setSoundPack(pack) {
    try { ambientHandle?.stop?.(); } catch { /* already stopped */ }
    ambientHandle = null;
    if (!soundEnabled || pack === 'off') return;
    const preset = pack === 'forest' ? 'ambient-wind-pad' : pack === 'crystal' ? 'fantasy-harp-arpeggio' : 'cyberpunk-bass-loop';
    try {
      const played = playSynthPreset(preset, { loop: true, gain: 0.5 });
      if (played && typeof played.then === 'function') played.then(h => { ambientHandle = h; }).catch(() => {});
      else ambientHandle = played;
    } catch { /* audio unavailable */ }
  }
  function dailyChallenge() {
    const now = new Date();
    const daySeed = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const goal = 1 + (daySeed % 3);
    return { id: `daily-${daySeed}`, goal, label: `Aaj ${goal} Sunshard${goal > 1 ? 's' : ''} dhoondo`, done: info.collected >= goal };
  }
  function updateDailyChallenge() {
    const el = $('[data-daily-challenge]'); if (!el) return;
    const daily = dailyChallenge();
    el.textContent = daily.done ? `⭐ Daily Challenge: ${daily.label} — ✅ Pura ho gaya, badhai ho!` : `⭐ Daily Challenge: ${daily.label} (${info.collected}/${daily.goal})`;
    if (daily.done && !contractsDone.has(daily.id)) { contractsDone.add(daily.id); }
  }
  let photoMode = false;
  function togglePhotoMode() {
    photoMode = !photoMode;
    root.classList.toggle('photo-mode', photoMode);
    showToast(photoMode ? '📸 Photo Mode — HUD chhup gaya. Sundar screenshot lo! (P se wapas)' : '📸 Photo Mode band.');
  }
  function renderJournal(){
    const inv=$('[data-journal-inventory]'),list=$('[data-journal-entries]'),loreStat=$('[data-lore-count]');
    if(loreStat)loreStat.textContent=String(discoveredLore.size);
    if(!inv||!list||!worldData)return;
    inv.textContent=`Sunshards: ${info.collected}/${config.beacon.unlock} · Discovered Chronicles: ${discoveredLore.size}/${(worldData.interactables||[]).length} · ✦ Blessings: ${blessingsEarned.size}/${GUARDIAN_BLESSINGS.length}${blessingsEarned.size?` (${[...blessingsEarned].join(' · ')})`:''} · Custom Landmarks: ${authoredAssets.length}`;
    const items=(worldData.interactables||[]).filter(it=>discoveredLore.has(it.id));
    list.innerHTML=items.length?items.map(it=>`<div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)"><strong style="display:block;color:#f3d28c;font-size:12px">${safeText(it.name)}</strong><span style="font-size:12px;color:#d6deeb">${safeText(it.lore)}</span></div>`).join(''):`<div style="font-size:12px;color:#9aa8be">Explore Windmere, Moonwater Lake, and the Ring Temple and press E near Guardians or Waystones to record their chronicles here.</div>`;
  }
  function triggerResonancePulse(){
    sfx('powerup-chime');
    if(!worldData)return;
    let bestTarget=null,bestDist=Infinity;
    for(const s of worldData.shards){if(s.collected)continue;const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<bestDist){bestDist=d;bestTarget={name:'Uncollected Sunshard',x:s.x,z:s.z};}}
    if(!bestTarget||info.collected>=config.beacon.unlock){bestDist=Math.hypot(player.x-config.beacon.x,player.z-config.beacon.z);bestTarget={name:'Firstlight Spire',x:config.beacon.x,z:config.beacon.z};}
    const dx=bestTarget.x-player.x,dz=bestTarget.z-player.z;
    const compass=Math.abs(dz)>=Math.abs(dx)?(dz<0?'North':'South'):(dx>0?'East':'West');
    showToast(`Resonance Pulse: ${bestTarget.name} is ${Math.round(bestDist)}m ${compass} (${Math.round(bestTarget.x)}, ${Math.round(bestTarget.z)})`);
  }
  function performSunbladeAttack(){
    if(elapsed < (performSunbladeAttack.cooldown||0)) return; performSunbladeAttack.cooldown = elapsed + 0.35;
    sunbladeSwings++; sunbladeUntil = elapsed + 0.4; sfx('sword-slash');
    // Sunblade Combat (R): a radiant arc that shatters a builder piece or startles wildlife and pings nearby shards.
    let shattered = false;
    for(let i=builderItems.length-1;i>=0;i--){const it=builderItems[i];if(Math.hypot(player.x-it.x,player.z-it.z)<3.2){builderItems.splice(i,1);shattered=true;stalkerDefeats++;updateContracts();break;}}
    const countEl=$('[data-builder-count]');if(countEl)countEl.textContent=`${builderItems.length} pieces placed with World Builder`;
    showToast(shattered?`Sunblade Combat: shattered a placed piece (${sunbladeSwings} swings)`:`Sunblade Combat: radiant arc unleashed (${sunbladeSwings} swings) — place a World Builder piece and strike it!`);
  }
  function performPhaseDash(){
    if(elapsed < dashCooldownUntil) { showToast('Phase Dash is recharging…'); return; }
    dashCooldownUntil = elapsed + 1.2; sfx('portal-hum');
    const fx=Math.sin(player.yaw), fz=Math.cos(player.yaw);
    const bound=config.land.span*.47;
    player.x=clamp(player.x+fx*4.5,-bound,bound); player.z=clamp(player.z+fz*4.5,-bound,bound);
    player.y=terrainHeight(player.x,player.z,config);
    showToast('Phase Dash: slipped 4.5m through the veil!');
  }
  function toggleBuilderPanel(){
    const el=$('[data-builder-panel]');if(!el)return;el.hidden=!el.hidden;
    const countEl=$('[data-builder-count]');if(countEl)countEl.textContent=`${builderItems.length} pieces placed with World Builder`;
  }
  function placeBuilderPiece(kind){
    if(kind==='clear'){builderItems.length=0;const c=$('[data-builder-count]');if(c)c.textContent='0 pieces placed with World Builder';showToast('World Builder: cleared placed pieces.');return;}
    const fx=Math.sin(player.yaw), fz=Math.cos(player.yaw);
    const x=player.x+fx*3, z=player.z+fz*3, y=terrainHeight(x,z,config);
    builderItems.push({kind, x, y, z, yaw:player.yaw, id:`builder-${builderItems.length}-${Math.round(x)}-${Math.round(z)}`});
    sfx('ui-click'); updateContracts();
    if(builderItems.length>120)builderItems.shift();
    const c=$('[data-builder-count]');if(c)c.textContent=`${builderItems.length} pieces placed with World Builder`;
    showToast(`World Builder placed: ${kind} at ${Math.round(x)}, ${Math.round(z)}`);
  }
  function updateDynamicBuilder(){
    if(!gl)return;const b=new MeshBuilder();
    for(const it of builderItems){
      if(it.kind==='crystal'){addCrystal(b,it.x,it.y+0.8,it.z,0.9,C.blueGlow,it.yaw);}
      else if(it.kind==='pine'){addCylinder(b,it.x,it.y,it.z,0.16,1.1,C.bark||[0.32,0.2,0.11],6);addCone(b,it.x,it.y+1.6,it.z,0.95,2.0,C.leaf||[0.16,0.38,0.22],7);}
      else if(it.kind==='stone'){addBox(b,it.x,it.y+0.45,it.z,0.9,0.95,0.8,C.stone||[0.45,0.48,0.52],it.yaw);}
      else if(it.kind==='campfire'){addTorusY(b,it.x,it.y+0.08,it.z,0.55,0.09,C.stone||[0.45,0.48,0.52],10,5,0.02);addSphere(b,it.x,it.y+0.3,it.z,0.24,0.3,0.24,[1.6,0.72,0.2],7,5);}
      else if(it.kind==='waystone'){addBox(b,it.x,it.y+0.8,it.z,0.55,1.7,0.3,C.stoneLight||[0.62,0.64,0.66],it.yaw);addSphere(b,it.x,it.y+1.85,it.z,0.14,0.14,0.14,C.blueGlow,7,5);}
      else addBox(b,it.x,it.y+0.4,it.z,0.7,0.8,0.7,C.stone||[0.45,0.48,0.52],it.yaw);
    }
    if(sunbladeUntil>elapsed){const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw);addBox(b,player.x+fx*1.1,player.y+1.1,player.z+fz*1.1,0.12,1.6,0.12,[1.8,1.3,0.45],player.yaw+0.7);}
    const data=b.finish();
    if(builderMesh)updateGpuMesh(gl,builderMesh,data);else builderMesh=packGpuMesh(gl,data,true);
  }
  function saveGame(){try{const save={schema:'orvexa-aetherfall-save',version:1,seed:config.land.seed,player:{x:player.x,y:player.y,z:player.z,yaw:player.yaw},collected:worldData?.shards.filter(s=>s.collected).map(s=>s.id)||[],discoveredLore:[...discoveredLore],activated:info.activated,stalkerDefeats,contractsDone:[...contractsDone],timeOfDay,dayNightCycle,weather:worldWeather,elapsed};localStorage.setItem(gameSaveKey(),JSON.stringify(save));}catch{/* A full private browsing store should not break the session. */}}
  function restoreSavedGame(){try{const raw=localStorage.getItem(gameSaveKey());if(!raw||raw.length>200000)return false;const save=JSON.parse(raw);if(save.schema!=='orvexa-aetherfall-save'||save.version!==1||save.seed!==config.land.seed)return false;const bound=config.land.span*.47;player.x=clamp(Number.isFinite(Number(save.player?.x))?Number(save.player.x):player.x,-bound,bound);player.z=clamp(Number.isFinite(Number(save.player?.z))?Number(save.player.z):player.z,-bound,bound);player.y=terrainHeight(player.x,player.z,config);player.yaw=Number.isFinite(save.player?.yaw)?save.player.yaw:0;for(const id of Array.isArray(save.collected)?save.collected:[]){if(Number.isInteger(id)&&worldData.shards[id])worldData.shards[id].collected=true;}discoveredLore.clear();for(const id of Array.isArray(save.discoveredLore)?save.discoveredLore:[])discoveredLore.add(String(id));refreshBlessings();info.collected=worldData.shards.filter(shard=>shard.collected).length;info.activated=save.activated===true;stalkerDefeats=Math.max(0,Number(save.stalkerDefeats)||0);contractsDone.clear();for(const id of Array.isArray(save.contractsDone)?save.contractsDone:[])contractsDone.add(String(id));timeOfDay=clamp(Number.isFinite(Number(save.timeOfDay))?Number(save.timeOfDay):15.5,0,24);dayNightCycle=save.dayNightCycle!==false;worldWeather=normalizeWeather(save.weather);elapsed=Math.max(0,Math.min(86400,Number(save.elapsed)||0));$('[data-time-of-day]').value=String(timeOfDay);$('[data-weather]').value=worldWeather;$('[data-day-cycle]').checked=dayNightCycle;updateTimeLabel();updateProgress();renderJournal();return true;}catch{return false;}}
  function updateTimeLabel(){const hh=Math.floor(timeOfDay)%24,mm=Math.round((timeOfDay-Math.floor(timeOfDay))*60)%60;$('[data-time-label]').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;}
  function updateWorldStats(){if(!worldData)return;$('[data-world-tris]').textContent=Math.round(worldData.stats.triangles+worldData.water.length/27).toLocaleString();$('[data-authored-model-count]').textContent=String(authoredAssets.length);$('[data-asset-sync-count]').textContent=String(authoredAssets.length);}
  function rebuildWorldMeshesPreservingRun(){
    if(!gl||!worldData)return;const keep={player:{...player},collected:new Set(worldData.shards.filter(s=>s.collected).map(s=>s.id)),count:info.collected,activated:info.activated,win,elapsed};
    disposeGpuMesh(gl,staticMesh);disposeGpuMesh(gl,terrainMesh);disposeGpuMesh(gl,waterMesh);disposeGpuMesh(gl,shardMesh);disposeGpuMesh(gl,weatherMesh);disposeGpuMesh(gl,wildlifeMesh);worldShardSeed=[];worldData=buildStaticWorld(config,authoredAssets,quality);worldData.shards.forEach(s=>{s.collected=keep.collected.has(s.id);});staticMesh=packGpuMesh(gl,worldData.solid);terrainMesh=packGpuMesh(gl,worldData.terrain);waterMesh=packGpuMesh(gl,worldData.water);shardMesh=packGpuMesh(gl,new Float32Array(0),true);weatherMesh=packGpuMesh(gl,new Float32Array(0),true);wildlifeMesh=packGpuMesh(gl,new Float32Array(0),true);player=keep.player;info.collected=worldData.shards.filter(s=>s.collected).length;info.activated=keep.activated;win=keep.win;elapsed=keep.elapsed;lastWeatherUpdate=-1;lastWildlifeUpdate=-1;updateProgress();updateWorldStats();updateLocation();updateDynamicWeather(true);updateDynamicWildlife(true);}
  function syncModelerAssets(){const previous=authoredAssets.length;authoredAssets=readModelerAssets();rebuildWorldMeshesPreservingRun();showToast(`Aetherfall synchronized · ${authoredAssets.length} custom model${authoredAssets.length===1?'':'s'} ready${previous!==authoredAssets.length?'':' (asset count unchanged)'}.`);}
  function onWorldAssetStorage(event){if(event.key===WORLD_ASSETS_STORAGE_KEY){syncModelerAssets();}}

  function setPaused(value){paused=Boolean(value);saveGame();stopped=false;const screen=$('[data-pause-screen]');screen.hidden=!paused;root.classList.toggle('aether-paused',paused);$('[data-pause-title]').textContent='World paused';$('[data-pause-copy]').textContent='Your journey is waiting.';$('[data-action="pause"]').textContent=paused?'▶ Resume':'Ⅱ Pause';if(!paused){canvas.focus({preventScroll:true});lastFrame=performance.now();}}
  function setStopped(){saveGame();paused=true;stopped=true;$('[data-pause-screen]').hidden=false;$('[data-pause-title]').textContent='Journey stopped';$('[data-pause-copy]').textContent='The world is safely frozen.';$('[data-action="resume"]').textContent='▶ Resume world';}
  function updateProgress(){const target=config.beacon.unlock;const frac=target?clamp(info.collected/target,0,1):1;$('[data-shards]').textContent=info.collected;$('[data-progress-count]').textContent=`${info.collected} / ${target}`;$('[data-progress-bar]').style.width=`${frac*100}%`;
    if(info.activated){$('[data-quest-state]').textContent='COMPLETE';$('[data-quest-title]').textContent='Firstlight restored';$('[data-quest-copy]').textContent='Aetherfall is awake again. Roam freely and discover the old roads.';}
    else if(info.collected>=target){$('[data-quest-state]').textContent='READY';$('[data-quest-title]').textContent='Awaken Firstlight Spire';$('[data-quest-copy]').textContent=`Reach the beacon at ${Math.round(config.beacon.x)}, ${Math.round(config.beacon.z)} and press E to restore the realm.`;}
    else{$('[data-quest-state]').textContent='ACTIVE';$('[data-quest-title]').textContent='Find the Sunshards';$('[data-quest-copy]').textContent='Recover ancient light fragments scattered across Aetherfall.';}updateContracts();
  }
  function resetWorld(nextConfig=config,nextSource=source,{restoreSave=false}={}){
    if(gl){disposeGpuMesh(gl,staticMesh);disposeGpuMesh(gl,terrainMesh);disposeGpuMesh(gl,waterMesh);disposeGpuMesh(gl,shardMesh);disposeGpuMesh(gl,weatherMesh);disposeGpuMesh(gl,wildlifeMesh);disposeGpuMesh(gl,builderMesh);builderMesh=null;}
    config=nextConfig;source=nextSource;skyPalette=skySettingsFor(config.sky);shaderFogColor=skyPalette.fog;worldShardSeed=[];environment=calculateWorldEnvironment(timeOfDay,worldWeather);sunDirection=environment.sunDirection;worldData=buildStaticWorld(config,authoredAssets,quality);staticMesh=packGpuMesh(gl,worldData.solid);terrainMesh=packGpuMesh(gl,worldData.terrain);waterMesh=packGpuMesh(gl,worldData.water);shardMesh=packGpuMesh(gl,new Float32Array(0),true);weatherMesh=packGpuMesh(gl,new Float32Array(0),true);wildlifeMesh=packGpuMesh(gl,new Float32Array(0),true);player={x:config.entry.x,y:terrainHeight(config.entry.x,config.entry.z,config),z:config.entry.z,vx:0,vy:0,vz:0,yaw:0,grounded:true,walkPhase:0};cameraYaw=0;cameraPitch=.12;info.collected=0;info.activated=false;info.objective='shards';win=false;elapsed=0;lastWeatherUpdate=-1;lastWildlifeUpdate=-1;keys.clear();touchMove={x:0,y:0};if(restoreSave)restoreSavedGame();updateProgress();updateWorldStats();updateDynamicWeather(true);updateDynamicWildlife(true);$('[data-realm-source]').value=source;$('[data-realm-diagnostics]').textContent=`Ready to compile ${config.name}.`;showToast(`${config.name} generated · ${worldData.stats.terrainVertices.toLocaleString()} terrain vertices · ${authoredAssets.length} custom models`);}
  function createShadowTarget(size){if(!gl)return; if(shadowTexture)gl.deleteTexture(shadowTexture);if(shadowFbo)gl.deleteFramebuffer(shadowFbo);shadowSize=size;shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);shadowFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTexture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);shadowOk=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
  function setQuality(next){const previous=quality;quality=next;const profiles={performance:{scale:.56,shadow:512,shadows:false},balanced:{scale:.72,shadow:768,shadows:true},high:{scale:.9,shadow:1024,shadows:true},ultra:{scale:1.1,shadow:1792,shadows:true},cinematic:{scale:1.24,shadow:2048,shadows:true}};const q=profiles[quality]||profiles.high;renderScale=q.scale;adaptiveScale=1;shadowsEnabled=$('[data-shadows]').checked&&q.shadows;createShadowTarget(q.shadow);if(previous!==quality)rebuildWorldMeshesPreservingRun();resize();showToast(`${quality[0].toUpperCase()+quality.slice(1)} graphics applied · world detail rebuilt`);}
  function resize(){if(!gl)return;const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.35);const w=Math.max(2,Math.floor(r.width*dpr*renderScale*adaptiveScale)),h=Math.max(2,Math.floor(r.height*dpr*renderScale*adaptiveScale));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
  function uniforms(program,name){return gl.getUniformLocation(program,name);}
  function bindMesh(mesh){gl.bindVertexArray(mesh.vao);}
  function drawMesh(mesh){if(mesh&&mesh.count){bindMesh(mesh);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}}
  function updateDynamicAvatar(){const b=new MeshBuilder(),ground=player.y,swing=Math.sin(player.walkPhase)*.42*(Math.hypot(player.vx,player.vz)>.3?1:0),yaw=player.yaw,x=player.x,z=player.z;const frontX=Math.sin(yaw),frontZ=Math.cos(yaw); // local +Z is the hero's front
    const px=(lx,lz)=>[x+lx*Math.cos(yaw)+lz*Math.sin(yaw),z-lx*Math.sin(yaw)+lz*Math.cos(yaw)];
    const box=(lx,yy,lz,sx,sy,sz,col,rz=0)=>{const [xx,zz]=px(lx,lz);addBox(b,xx,ground+yy,zz,sx,sy,sz,col,yaw+rz);};
    const sph=(lx,yy,lz,rx,ry,rz,col)=>{const [xx,zz]=px(lx,lz);addSphere(b,xx,ground+yy,zz,rx,ry,rz,col,10,7);};
    const limb=(lx,yy,lz,length,thick,angle,col)=>{const [xx,zz]=px(lx+Math.sin(angle)*length*.35,lz);addBox(b,xx,ground+yy,zz,thick,length,thick,col,yaw+angle);};
    // Grounded silhouette, layered explorer armor, scarf, gloves and lighted chest crest.
    sph(0,.2,0,.48,.16,.38,[.018,.025,.03]);box(0,.88,0,.72,.86,.42,C.armor);box(0,.94,.245,.42,.42,.055,C.armor2);sph(0,1.62,.04,.31,.33,.29,C.skin,10,7);addSphere(b,x+frontX*.06,ground+1.8,z+frontZ*.06,.27,.18,.28,C.armor2,9,6);sph(0,1.1,.27,.105,.12,.06,C.glow);box(0,.62,-.03,.75,.17,.47,C.cloth);
    const [lx,lz]=px(-.48,.02);addBox(b,lx,ground+1.08+Math.sin(swing)*.08,lz,.24,.69,.25,C.armor2,yaw+swing*.55);
    const [rx,rz]=px(.48,.02);addBox(b,rx,ground+1.08-Math.sin(swing)*.08,rz,.24,.69,.25,C.armor2,yaw-swing*.55);
    const [llegx,llegz]=px(-.21,.02);addBox(b,llegx,ground+.29+Math.max(0,Math.sin(swing))*.12,llegz,.25,.55,.3,C.armor,yaw+swing);
    const [rlegx,rlegz]=px(.21,.02);addBox(b,rlegx,ground+.29+Math.max(0,-Math.sin(swing))*.12,rlegz,.25,.55,.3,C.armor,yaw-swing);
    const [scx,scz]=px(0,-.28);addBox(b,scx,ground+1.3,scz,.49,.22,.1,C.roof,yaw+.25);const [tailx,tailz]=px(.15,-.48);addBox(b,tailx,ground+1.17,tailz,.16,.52,.07,C.roof,yaw+Math.sin(player.walkPhase)*.08);
    const data=b.finish();if(avatarMesh)updateGpuMesh(gl,avatarMesh,data);else avatarMesh=packGpuMesh(gl,data,true);
  }
  function updateDynamicShards(){const b=new MeshBuilder();const now=elapsed;
    for(const s of worldData.shards){if(s.collected)continue;const y=s.baseY+Math.sin(now*1.45+s.phase)*.18, yaw=s.yaw+now*.56;addCrystal(b,s.x,y,s.z,s.scale,s.col,yaw);addTorusY(b,s.x,y-.2,s.z,s.scale*.68,.035,s.col,12,5,.02);}
    updateGpuMesh(gl,shardMesh,b.finish());
  }
  function updateDynamicWeather(force=false){
    if(!gl||!weatherMesh)return;if(!force&&elapsed-lastWeatherUpdate<.075)return;lastWeatherUpdate=elapsed;const b=new MeshBuilder();
    if(worldWeather==='rain'){
      const count=quality==='performance'?75:quality==='balanced'?125:quality==='high'?205:quality==='ultra'?300:380;const rainColor=[.22,.34,.47];
      for(let i=0;i<count;i++){const phase=(i*.61803398875)%1,x=player.x+(phase-.5)*27+Math.sin(elapsed*.08+i)*.8,z=player.z+(((i*37)%101)/101-.5)*27,y=player.y+1+((elapsed*16+i*2.73)%22),dx=.13,dz=.08,down=.72+((i%5)*.035);const a=[x-dx,y,z-dz],c=[x+dx,y,z+dz],d=[x+dx+.015,y-down,z+dz+.015],e=[x-dx+.015,y-down,z-dz+.015];b.triangle(a,c,d,rainColor,[[0,1,0],[0,1,0],[0,1,0]]);b.triangle(a,d,e,rainColor,[[0,1,0],[0,1,0],[0,1,0]]);}
    }else if(worldWeather==='snow'){
      const count=quality==='performance'?65:quality==='balanced'?110:quality==='high'?170:quality==='ultra'?250:310;const snowColor=[.65,.75,.88];
      for(let i=0;i<count;i++){const x=player.x+Math.sin(i*7.17+elapsed*.22)*13+Math.cos(i*1.37)*4,z=player.z+Math.cos(i*4.13+elapsed*.16)*13,y=player.y+1+((elapsed*1.3+i*1.71)%19),sz=.035+(i%4)*.012;const a=[x-sz,y,z],bb=[x,y+sz*1.3,z],c=[x+sz,y,z],d=[x,y-sz*1.3,z];b.triangle(a,bb,c,snowColor,[[0,1,0],[0,1,0],[0,1,0]]);b.triangle(c,d,a,snowColor,[[0,1,0],[0,1,0],[0,1,0]]);}
    }
    updateGpuMesh(gl,weatherMesh,b.finish());
  }
  function updateDynamicWildlife(force=false){
    if(!gl||!wildlifeMesh)return;if(!force&&elapsed-lastWildlifeUpdate<.14)return;lastWildlifeUpdate=elapsed;const b=new MeshBuilder();
    const animalCount=quality==='performance'?1:quality==='balanced'?2:quality==='high'?3:quality==='ultra'?4:5;
    const bound=config.land.span*.43;
    // Small herds follow slow, deterministic wandering paths. Their silhouettes use low-poly geometry so the ecosystem costs little on mobile GPUs.
    for(let i=0;i<animalCount;i++){
      const phase=i*2.399963+1.4,rate=.045+(i%3)*.009,angle=elapsed*rate+phase,radius=15+(i%3)*8;
      let x=clamp(player.x+Math.cos(angle)*radius,-bound,bound),z=clamp(player.z+Math.sin(angle*.86+phase)*radius,-bound,bound);
      if(!randomClear(x,z,config,1.5))continue;
      const y=terrainHeight(x,z,config),yaw=angle+Math.PI/2,walk=Math.sin(elapsed*3.5+phase)*.1;
      const pt=(lx,ly,lz)=>rotatedPoint(lx,ly,lz,[x,y,z],yaw);
      const fur=i%3===0?[.23,.115,.055]:i%3===1?[.30,.18,.085]:[.17,.13,.10],belly=[.42,.30,.18],hoof=[.045,.038,.03];
      addSphere(b,x,y+.77,z,.31,.28,.58,fur,9,6);addSphere(b,x,y+.66,z+.26,.28,.22,.31,belly,8,5);
      const neckA=pt(0,.83,.34),neckB=pt(0,1.25,.47);addSegmentCylinder(b,neckA,neckB,.145,.09,fur,7);const head=pt(0,1.30,.56);addSphere(b,head[0],head[1],head[2],.17,.145,.22,fur,8,5);
      for(const side of [-1,1]){const earA=pt(side*.105,1.36,.57),earB=pt(side*.22,1.46,.7);addSegmentCylinder(b,earA,earB,.055,.018,fur,5);}
      const legSpecs=[[-.19,-.36,1], [.19,-.36,-1],[-.19,.34,-1],[.19,.34,1]];
      for(let j=0;j<legSpecs.length;j++){const [lx,lz,phaseSign]=legSpecs[j],swing=walk*phaseSign*(j%2?1:-1),hip=pt(lx,.63,lz),hoofPt=pt(lx+swing,.08+Math.max(0,swing)*.2,lz+swing*.65);addSegmentCylinder(b,hip,hoofPt,.064,.038,fur,5);addSphere(b,hoofPt[0],hoofPt[1],hoofPt[2],.065,.055,.075,hoof,5,3);}
      addSegmentCylinder(b,pt(0,.86,-.5),pt(0,1.02,-.78),.055,.015,fur,5);
      if(i%3===0){for(const side of [-1,1]){const antlerBase=pt(side*.075,1.39,.58),antlerTip=pt(side*.15,1.62,.63),antlerFork=pt(side*.24,1.53,.60);addSegmentCylinder(b,antlerBase,antlerTip,.035,.012,hoof,5);addSegmentCylinder(b,antlerTip,antlerFork,.02,.008,hoof,4);}}
    }
    // Distant bird flocks move independently through the sky and flap their wings.
    const birdCount=quality==='performance'?5:quality==='balanced'?8:quality==='high'?12:quality==='ultra'?18:22,birdColor=[.035,.045,.061];
    for(let i=0;i<birdCount;i++){
      const phase=i*2.399963,angle=elapsed*.075+phase,radius=24+(i%4)*10,x=clamp(player.x+Math.cos(angle)*radius,-bound,bound),z=clamp(player.z+Math.sin(angle*.88+phase)*radius,-bound,bound),y=terrainHeight(x,z,config)+12+(i%4)*1.4+Math.sin(elapsed*.55+phase)*1.1,yaw=angle+Math.PI/2,flap=Math.sin(elapsed*10.5+phase)*.22,pt=(lx,ly,lz)=>rotatedPoint(lx,ly,lz,[x,y,z],yaw);
      b.triangle(pt(0,0,.28),pt(-.07,-.035,-.2),pt(.07,-.035,-.2),birdColor);
      b.triangle(pt(0,0,.04),pt(-.40,flap,.17),pt(-.24,flap*.38,-.17),birdColor);
      b.triangle(pt(0,0,.04),pt(.40,flap,.17),pt(.24,flap*.38,-.17),birdColor);
    }
    // Fireflies become visible at night, with fixed-seed paths and bounded counts for mobile performance.
    if(environment.daylight<.24&&worldWeather!=='rain'){
      const count=quality==='performance'?7:quality==='balanced'?12:quality==='high'?20:quality==='ultra'?28:36;
      for(let i=0;i<count;i++){const phase=i*2.399963+Math.sin(i*7.13)*.5,angle=phase+elapsed*(.12+(i%5)*.013),radius=3.5+(i%7)*2.7,x=clamp(player.x+Math.cos(angle)*radius,-bound,bound),z=clamp(player.z+Math.sin(angle*1.27)*radius,-bound,bound),y=terrainHeight(x,z,config)+.65+(i%4)*.3+Math.sin(elapsed*1.9+phase)*.27;addSphere(b,x,y,z,.055,.08,.055,[1.65,.92,.24],6,4);}
    }
    updateGpuMesh(gl,wildlifeMesh,b.finish());
  }
  function screenSun(matrix){const p=[player.x+sunDirection[0]*120,player.y+sunDirection[1]*120,player.z+sunDirection[2]*120],m=matrix;const x=p[0],y=p[1],z=p[2],cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];if(cw<=0)return [-2,-2];return [cx/cw*.5+.5,cy/cw*.5+.5];}
  function render(){if(disposed||!gl)return;resize();environment=calculateWorldEnvironment(timeOfDay,worldWeather);sunDirection=environment.sunDirection;updateDynamicAvatar();updateDynamicBuilder();updateDynamicShards();updateDynamicWeather();updateDynamicWildlife();const windStrength=worldWeather==='rain'?1.45:worldWeather==='overcast'?1.15:worldWeather==='snow'?.72:.82;const w=canvas.width,h=canvas.height,aspect=w/Math.max(1,h);const target=[player.x,player.y+1.15,player.z],horizontal=Math.cos(cameraPitch)*cameraDistance;const eye=[target[0]-Math.sin(cameraYaw)*horizontal,target[1]+Math.sin(cameraPitch)*cameraDistance,target[2]+Math.cos(cameraYaw)*horizontal];const view=lookAt(eye,target),projection=perspective(58*Math.PI/180,aspect,.1,config.land.span*1.25),vp=mul(projection,view);const center=[player.x,0,player.z],lightEye=[center[0]+sunDirection[0]*105,center[1]+sunDirection[1]*105+24,center[2]+sunDirection[2]*105],lightView=lookAt(lightEye,center),lightProj=ortho(-82,82,-82,82,1,260),lightVP=mul(lightProj,lightView);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(.11,.16,.25,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(skyProgram);gl.uniform2f(uniforms(skyProgram,'uResolution'),w,h);const sun=screenSun(vp);gl.uniform2f(uniforms(skyProgram,'uSunScreen'),sun[0],sun[1]);gl.uniform1f(uniforms(skyProgram,'uTime'),elapsed);gl.uniform3fv(uniforms(skyProgram,'uSkyHorizon'),skyPalette.horizon);gl.uniform3fv(uniforms(skyProgram,'uSkyMiddle'),skyPalette.middle);gl.uniform3fv(uniforms(skyProgram,'uSkyZenith'),skyPalette.zenith);gl.uniform3fv(uniforms(skyProgram,'uSkySun'),skyPalette.sun);gl.uniform3fv(uniforms(skyProgram,'uSkyCloud'),skyPalette.cloud);gl.uniform1f(uniforms(skyProgram,'uDaylight'),environment.daylight);gl.uniform1f(uniforms(skyProgram,'uWeather'),['clear','overcast','rain','snow'].indexOf(worldWeather));gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    if(shadowsEnabled&&shadowOk){gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.colorMask(false,false,false,false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.2,2.0);gl.useProgram(shadowProgram);gl.uniformMatrix4fv(uniforms(shadowProgram,'uLightViewProjection'),false,lightVP);gl.uniform1f(uniforms(shadowProgram,'uTime'),elapsed);gl.uniform1f(uniforms(shadowProgram,'uWindStrength'),0);drawMesh(terrainMesh);gl.uniform1f(uniforms(shadowProgram,'uWindStrength'),windStrength);drawMesh(staticMesh);gl.uniform1f(uniforms(shadowProgram,'uWindStrength'),0);drawMesh(avatarMesh);drawMesh(shardMesh);gl.disable(gl.POLYGON_OFFSET_FILL);gl.colorMask(true,true,true,true);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);}
    gl.useProgram(mainProgram);gl.uniformMatrix4fv(uniforms(mainProgram,'uViewProjection'),false,vp);gl.uniformMatrix4fv(uniforms(mainProgram,'uLightViewProjection'),false,lightVP);gl.uniform3f(uniforms(mainProgram,'uCamera'),eye[0],eye[1],eye[2]);gl.uniform3f(uniforms(mainProgram,'uSunDirection'),sunDirection[0],sunDirection[1],sunDirection[2]);gl.uniform3fv(uniforms(mainProgram,'uSunColor'),environment.sunColor);const nightMix=1-environment.daylight,ambientColor=[mix(.035,.30,environment.daylight),mix(.047,.40,environment.daylight),mix(.10,.52,environment.daylight)];gl.uniform3fv(uniforms(mainProgram,'uAmbientColor'),ambientColor);const nightFog=[.018,.027,.065];const fogColor=shaderFogColor.map((v,i)=>mix(nightFog[i],v,environment.daylight));gl.uniform3fv(uniforms(mainProgram,'uFogColor'),fogColor);gl.uniform1f(uniforms(mainProgram,'uDaylight'),environment.daylight);gl.uniform1f(uniforms(mainProgram,'uSolarIntensity'),environment.solarIntensity);gl.uniform1f(uniforms(mainProgram,'uAmbientIntensity'),environment.ambientIntensity);gl.uniform1f(uniforms(mainProgram,'uWeather'),['clear','overcast','rain','snow'].indexOf(worldWeather));gl.uniform2f(uniforms(mainProgram,'uWaterCenter'),config.waters[0]?.x||0,config.waters[0]?.z||0);gl.uniform1f(uniforms(mainProgram,'uWaterRadius'),config.waters[0]?.radius||1);gl.uniform1f(uniforms(mainProgram,'uFogFar'),config.land.span*.9/environment.fogBoost);gl.uniform1f(uniforms(mainProgram,'uTime'),elapsed);gl.uniform1f(uniforms(mainProgram,'uWater'),0);gl.uniform1f(uniforms(mainProgram,'uShadowEnabled'),shadowsEnabled&&shadowOk?1:0);gl.uniform2f(uniforms(mainProgram,'uShadowTexel'),1/shadowSize,1/shadowSize);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(uniforms(mainProgram,'uShadowMap'),0);
    gl.uniform1f(uniforms(mainProgram,'uWindStrength'),0);drawMesh(terrainMesh);gl.uniform1f(uniforms(mainProgram,'uWindStrength'),windStrength);drawMesh(staticMesh);gl.uniform1f(uniforms(mainProgram,'uWindStrength'),0);gl.uniform1f(uniforms(mainProgram,'uWater'),1);drawMesh(waterMesh);gl.uniform1f(uniforms(mainProgram,'uWater'),0);drawMesh(shardMesh);drawMesh(avatarMesh);drawMesh(weatherMesh);drawMesh(wildlifeMesh);drawMesh(builderMesh);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(true);
  }
  function drawMinimap(){if(!ctxMap)return;const c=root.querySelector('.aether-minimap'),ctx=ctxMap,w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(9,18,28,.86)';ctx.fillRect(0,0,w,h);const span=config.land.span,scale=w/span;const sx=x=>w/2+(x-player.x)*scale,sy=z=>h/2+(z-player.z)*scale;
    ctx.strokeStyle='rgba(226,203,162,.12)';ctx.lineWidth=1;for(let i=0;i<=w;i+=30){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
    for(const lake of config.waters){ctx.beginPath();ctx.fillStyle='rgba(32,143,184,.6)';ctx.arc(sx(lake.x),sy(lake.z),lake.radius*scale,0,Math.PI*2);ctx.fill();}
    for(const town of config.settlements){ctx.fillStyle='#e8c89a';ctx.fillRect(sx(town.x)-2,sy(town.z)-2,4,4);}
    ctx.fillStyle='#8d81ff';for(const l of worldData.landmarks){ctx.beginPath();ctx.arc(sx(l.x),sy(l.z),2.1,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#53f0df';for(const s of worldData.shards){if(s.collected)continue;ctx.beginPath();ctx.arc(sx(s.x),sy(s.z),1.6,0,Math.PI*2);ctx.fill();}
    ctx.save();ctx.translate(sx(player.x),sy(player.z));ctx.rotate(-player.yaw);ctx.fillStyle='#fff1cf';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3.6,4);ctx.lineTo(0,2);ctx.lineTo(-3.6,4);ctx.closePath();ctx.fill();ctx.restore();ctx.strokeStyle='rgba(239,226,201,.35)';ctx.lineWidth=2;ctx.strokeRect(1,1,w-2,h-2);
  }
  function updateLocation(){let best={name:'Aetherfall Wilds',d:Infinity};for(const l of worldData.landmarks){const d=length2(player.x-l.x,player.z-l.z);if(d<best.d)best={name:l.name,d};}if(best.d<14)info.activeLocation=best.name;else if(best.d<30)info.activeLocation=`Near ${best.name}`;else if(Math.hypot(player.x,player.z)>98)info.activeLocation='The Outer Highlands';else info.activeLocation='Aetherfall Wilds';$('[data-location]').textContent=info.activeLocation;$('[data-coords]').textContent=`${Math.round(player.x)} · ${Math.round(player.z)}`;}
  function checkInteraction(){let best=-1,dmin=Infinity;for(let i=0;i<worldData.shards.length;i++){const s=worldData.shards[i];if(s.collected)continue;const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<dmin){best=i;dmin=d;}}
    nearbyShard.index=best;nearbyShard.distance=dmin;
    let bestInt=null,intMin=Infinity;
    for(const item of worldData.interactables||[]){const d=Math.hypot(player.x-item.x,player.z-item.z);if(d<intMin){intMin=d;bestInt=item;}}
    nearbyInteractable.item=bestInt;nearbyInteractable.distance=intMin;
    if(!interactQueued)return;interactQueued=false;
    if(best>=0&&dmin<3.2){const s=worldData.shards[best];s.collected=true;info.collected++;sfx('coin-pickup');updateProgress();renderJournal();saveGame();showToast(`Sunshard recovered · ${info.collected}/${config.beacon.unlock}`);return;}
    if(bestInt&&intMin<4.2){const isNewLore=!discoveredLore.has(bestInt.id);discoveredLore.add(bestInt.id);if(isNewLore)refreshBlessings();renderJournal();saveGame();if(isNewLore){sfx('powerup-chime');showToast(`${bestInt.name}: ${bestInt.lore} ✦ Blessing mila: ${blessingFor(discoveredLore.size)} (${blessingsEarned.size}/${GUARDIAN_BLESSINGS.length})`);}else showToast(`${bestInt.name}: ${bestInt.lore}`);return;}
    const bd=length2(player.x-config.beacon.x,player.z-config.beacon.z);
    if(bd<7){if(info.collected>=config.beacon.unlock){info.activated=true;win=true;sfx('victory-fanfare');updateProgress();saveGame();$('[data-win-screen]').hidden=false;paused=true;showToast('Firstlight Spire restored!');}else showToast(`The spire needs ${config.beacon.unlock-info.collected} more Sunshards.`);return;}
    showToast('Nothing nearby to interact with. Press Q for Resonance Pulse or approach a Guardian, Waystone, or Sunshard.');
  }
  function updateGame(dt){if(paused||stopped||win)return;elapsed+=dt;if(dayNightCycle){timeOfDay=(timeOfDay+dt*(24/1200))%24;}const forward=(keys.has('w')||keys.has('arrowup')?1:0)+(keys.has('s')||keys.has('arrowdown')?-1:0)-touchMove.y;const strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+touchMove.x;const il=Math.hypot(forward,strafe);let fx=0,fz=0;if(il>.05){const f=forward/Math.max(1,il),s=strafe/Math.max(1,il);fx=Math.sin(cameraYaw)*f+Math.cos(cameraYaw)*s;fz=-Math.cos(cameraYaw)*f+Math.sin(cameraYaw)*s;}
    const slopeNorm=terrainNormal(player.x,player.z,config),slopePenalty=clamp(slopeNorm[1],0.68,1);
    const sprint=sprinting||keys.has('shift'),speed=(sprint?9.2:5.3)*slopePenalty,acc=1-Math.exp(-10*dt);player.vx=mix(player.vx,fx*speed,acc);player.vz=mix(player.vz,fz*speed,acc);if(il<=.05){player.vx*=Math.exp(-8*dt);player.vz*=Math.exp(-8*dt);}const moving=Math.hypot(player.vx,player.vz)>.17;if(moving)player.yaw=Math.atan2(player.vx,player.vz);player.walkPhase+=dt*(sprint?13:8)*Math.min(1,Math.hypot(player.vx,player.vz)/3);
    if(jumpQueued&&player.grounded){player.vy=7.3;player.grounded=false;}jumpQueued=false;player.vy-=18*dt;let nx=player.x+player.vx*dt,nz=player.z+player.vz*dt;const bound=config.land.span*.485;nx=clamp(nx,-bound,bound);nz=clamp(nz,-bound,bound);
    for(const collider of worldData.colliders){const dx=nx-collider.x,dz=nz-collider.z,d=Math.hypot(dx,dz);if(d<collider.r+.65){const l=d||1;nx=collider.x+dx/l*(collider.r+.66);nz=collider.z+dz/l*(collider.r+.66);}}
    player.x=nx;player.z=nz;let floor=terrainHeight(player.x,player.z,config);
    for(const lake of config.waters){if(length2(player.x-lake.x,player.z-lake.z)<lake.radius*.94){floor=lake.y+.22;player.vy=Math.max(player.vy,-.6);}}
    if(player.y+player.vy*dt<=floor){player.y=floor;player.vy=0;player.grounded=true;}else player.y+=player.vy*dt;
    if(config.rules.includes('interact'))checkInteraction();updateLocation();}
  function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000||0));lastFrame=now;frames++;frameAverage=frameAverage*.94+dt*1000*.06;if(!paused&&!stopped)updateGame(dt);
    if(frameAverage>34&&adaptiveScale>.68){adaptiveScale=Math.max(.66,adaptiveScale-.015);resize();}else if(frameAverage<20&&adaptiveScale<1){adaptiveScale=Math.min(1,adaptiveScale+.006);resize();}
    render();if(now-lastSaveClock>5000){saveGame();lastSaveClock=now;}if(now-lastFpsTime>650){updateTimeLabel();fps=Math.round(frames*1000/Math.max(1,now-lastFpsTime));frames=0;lastFpsTime=now;$('[data-fps]').textContent=fps;drawMinimap();const beaconDistance=length2(player.x-config.beacon.x,player.z-config.beacon.z);const hint=$('[data-interact-hint]');const hasInteractable=nearbyInteractable.item&&nearbyInteractable.distance<4.2;hint.hidden=!((nearbyShard.distance<3.2&&nearbyShard.index>=0)||hasInteractable||beaconDistance<7);hint.textContent=beaconDistance<7?(info.collected>=config.beacon.unlock?'E / USE · Awaken Firstlight Spire':`E / USE · Need ${config.beacon.unlock-info.collected} more Sunshards`):(nearbyShard.distance<3.2&&nearbyShard.index>=0)?'E / USE · Collect Sunshard':hasInteractable?`E / USE · Inspect ${nearbyInteractable.item.name}`:'E / USE · Interact';}
  }
  function togglePanel(which){const panel=which==='realm'?'[data-realm-panel]':which==='journal'?'[data-journal-panel]':which==='builder'?'[data-builder-panel]':'[data-settings-panel]';const el=$(panel);if(!el)return;if(which==='journal')renderJournal();el.hidden=!el.hidden; if(!el.hidden){const focusEl=$(which==='realm'?'[data-realm-source]':which==='journal'?'[data-action="close-journal"]':'[data-quality]');focusEl?.focus({preventScroll:true});} }
  function restart(){try{localStorage.removeItem(gameSaveKey());}catch{}discoveredLore.clear();timeOfDay=15.5;dayNightCycle=true;worldWeather='clear';$('[data-time-of-day]').value='15.5';$('[data-day-cycle]').checked=true;$('[data-weather]').value='clear';updateTimeLabel();resetWorld(config,source);renderJournal();$('[data-win-screen]').hidden=true;setPaused(false);saveGame();showToast('Your journey begins again.');}
  function exit(){cleanup();document.dispatchEvent(new CustomEvent('orvexa-exit-world'));}
  function pointerDown(e){if(e.target.closest('button,select,input,textarea,.aether-side-panel,.aether-settings-panel'))return;mouseDrag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};if(e.pointerType==='touch'){if(e.clientX<canvas.getBoundingClientRect().left+canvas.clientWidth*.48)return;}canvas.setPointerCapture?.(e.pointerId);}
  function pointerMove(e){if(!mouseDrag||mouseDrag.id!==e.pointerId)return;const dx=e.clientX-mouseDrag.x,dy=e.clientY-mouseDrag.y;if(Math.abs(dx)+Math.abs(dy)>2)mouseDrag.moved=true;cameraYaw-=dx*cameraSensitivity;cameraPitch=clamp(cameraPitch+dy*cameraSensitivity*.72,-.18,.65);mouseDrag.x=e.clientX;mouseDrag.y=e.clientY;}
  function pointerUp(e){if(mouseDrag&&mouseDrag.id===e.pointerId)mouseDrag=null;}
  function wheel(e){e.preventDefault();cameraDistance=clamp(cameraDistance+Math.sign(e.deltaY)*.8,4.6,12);}
  function keyDown(e){const key=e.key.toLowerCase();const editing=['INPUT','TEXTAREA','SELECT'].includes(String(document.activeElement?.tagName||'').toUpperCase());if(editing&&key!=='escape')return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' ','e','q','j','r','f','b','p','escape'].includes(key))e.preventDefault();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key))keys.add(key);if(key===' '&&!e.repeat)jumpQueued=true;if(key==='e'&&!e.repeat){interactQueued=true;triggerResonancePulse();}if(key==='q'&&!e.repeat)triggerResonancePulse();if(key==='r'&&!e.repeat)performSunbladeAttack();if(key==='f'&&!e.repeat)performPhaseDash();if(key==='b'&&!e.repeat)togglePanel('builder');if(key==='j'&&!e.repeat)togglePanel('journal');if(key==='p'&&!e.repeat)togglePhotoMode();if(key==='escape'){if($('[data-realm-panel]').hidden===false)$('[data-realm-panel]').hidden=true;else if($('[data-journal-panel]').hidden===false)$('[data-journal-panel]').hidden=true;else if($('[data-builder-panel]')&&$('[data-builder-panel]').hidden===false)$('[data-builder-panel]').hidden=true;else if($('[data-settings-panel]').hidden===false)$('[data-settings-panel]').hidden=true;else setPaused(!paused);}e.stopPropagation();}
  function keyUp(e){keys.delete(e.key.toLowerCase());e.stopPropagation();}
  function joystickStart(e){e.preventDefault();e.stopPropagation();const joy=$('[data-joystick]'),rect=joy.getBoundingClientRect();const update=ev=>{const dx=ev.clientX-(rect.left+rect.width/2),dy=ev.clientY-(rect.top+rect.height/2),r=rect.width*.32,l=Math.hypot(dx,dy)||1;touchMove={x:clamp(dx/l*Math.min(l,r)/r,-1,1),y:clamp(dy/l*Math.min(l,r)/r,-1,1)};joy.firstElementChild.style.transform=`translate(${touchMove.x*18}px,${touchMove.y*18}px)`;};update(e);const move=ev=>update(ev),end=()=>{touchMove={x:0,y:0};joy.firstElementChild.style.transform='';window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);}
  function action(e){const placeBtn=e.target.closest('[data-builder-place]');if(placeBtn){placeBuilderPiece(placeBtn.dataset.builderPlace);e.stopPropagation();return;}const btn=e.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;
    if(a==='pause'){if(paused&&!stopped)setPaused(false);else setPaused(true);}else if(a==='stop'){setStopped();}else if(a==='resume'){if(win){win=false;$('[data-win-screen]').hidden=true;}setPaused(false);}else if(a==='restart')restart();else if(a==='exit')exit();else if(a==='realm')togglePanel('realm');else if(a==='journal')togglePanel('journal');else if(a==='pulse')triggerResonancePulse();else if(a==='settings')togglePanel('settings');else if(a==='close-realm')$('[data-realm-panel]').hidden=true;else if(a==='close-journal')$('[data-journal-panel]').hidden=true;else if(a==='close-settings')$('[data-settings-panel]').hidden=true;else if(a==='sync-assets'){syncModelerAssets();}else if(a==='sunblade'){performSunbladeAttack();}else if(a==='dash'){performPhaseDash();}else if(a==='builder'){togglePanel('builder');}else if(a==='close-builder')$('[data-builder-panel]').hidden=true;else if(a==='map'){mapVisible=!mapVisible;root.querySelector('.aether-minimap-wrap').hidden=!mapVisible;}$('[data-minimap]').checked=mapVisible;
    if(a==='touch-sprint')sprinting=!sprinting;else if(a==='touch-jump')jumpQueued=true;else if(a==='touch-use')interactQueued=true;
    if(a==='apply-realm'){const newSource=$('[data-realm-source]').value,validation=validateRealmSource(newSource);if(!validation.ok){$('[data-realm-diagnostics]').textContent=validation.errors.map(e=>`Line ${e.line}: ${e.message}`).join('\n');$('[data-realm-diagnostics]').classList.add('error');return;}resetWorld(validation.realm,newSource);$('[data-realm-diagnostics]').classList.remove('error');$('[data-realm-diagnostics]').textContent=`Compiled successfully · ${validation.realm.name} · ${validation.stats.terrainVertices.toLocaleString()} terrain vertices`; $('[data-realm-panel]').hidden=true;setPaused(false);}
    e.stopPropagation();}
  function qualityChange(){setQuality($('[data-quality]').value);}
  function shadowChange(){shadowsEnabled=$('[data-shadows]').checked&&quality!=='performance';saveGame();}
  function soundChange(){soundEnabled=$('[data-sound]')?.checked!==false;if(soundEnabled)sfx('ui-click');}
  function sensitivityChange(){cameraSensitivity=Number($('[data-sensitivity]').value)*.001;}
  function timeOfDayChange(){timeOfDay=clamp(Number($('[data-time-of-day]').value),0,24);updateTimeLabel();saveGame();}
  function dayCycleChange(){dayNightCycle=$('[data-day-cycle]').checked;saveGame();}
  function weatherChange(){worldWeather=normalizeWeather($('[data-weather]').value);updateDynamicWeather(true);saveGame();showToast(`Weather changed · ${worldWeather}`);}
  function onResize(){resize();}
  function onVisibilityChange(){if(document.visibilityState!=='visible')saveGame();}
  let resizeObserver=null;
  function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearTimeout(toastTimer);window.removeEventListener('resize',onResize);window.removeEventListener('storage',onWorldAssetStorage);document.removeEventListener('visibilitychange',onVisibilityChange);window.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel);root.removeEventListener('click',action);$('[data-joystick]').removeEventListener('pointerdown',joystickStart);$('[data-quality]').removeEventListener('change',qualityChange);$('[data-shadows]').removeEventListener('change',shadowChange);$('[data-sound]')?.removeEventListener('change',soundChange);$('[data-sensitivity]').removeEventListener('input',sensitivityChange);$('[data-time-of-day]').removeEventListener('input',timeOfDayChange);$('[data-day-cycle]').removeEventListener('change',dayCycleChange);$('[data-weather]').removeEventListener('change',weatherChange);resizeObserver?.disconnect();saveGame();if(gl){disposeGpuMesh(gl,staticMesh);disposeGpuMesh(gl,terrainMesh);disposeGpuMesh(gl,waterMesh);disposeGpuMesh(gl,avatarMesh);disposeGpuMesh(gl,shardMesh);disposeGpuMesh(gl,weatherMesh);disposeGpuMesh(gl,wildlifeMesh);disposeGpuMesh(gl,builderMesh);if(shadowTexture)gl.deleteTexture(shadowTexture);if(shadowFbo)gl.deleteFramebuffer(shadowFbo);const ext=gl.getExtension('WEBGL_lose_context');ext?.loseContext();}document.removeEventListener('keydown',globalKeyDown,true);}
  function globalKeyDown(e){if(e.key==='Escape'&&root.isConnected){/* canvas handler owns gameplay Esc */}}

  try {
    gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL 2 is unavailable. Open Orvexa Studio in a current Chrome, Edge, or Firefox browser with hardware acceleration enabled.');
    mainProgram=link(gl,MAIN_VS,MAIN_FS);shadowProgram=link(gl,SHADOW_VS,SHADOW_FS);skyProgram=link(gl,SKY_VS,SKY_FS);authoredAssets=readModelerAssets();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearDepth(1);gl.enable(gl.DITHER);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);createShadowTarget(shadowSize);updateTimeLabel();resetWorld(config,source,{restoreSave:true});resize();
    root.addEventListener('click',action);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});$('[data-joystick]').addEventListener('pointerdown',joystickStart);window.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);window.addEventListener('resize',onResize);window.addEventListener('storage',onWorldAssetStorage);document.addEventListener('visibilitychange',onVisibilityChange);$('[data-quality]').addEventListener('change',qualityChange);$('[data-shadows]').addEventListener('change',shadowChange);$('[data-sound]').addEventListener('change',soundChange);$('[data-soundpack]')?.addEventListener('change',e=>setSoundPack(e.target.value));$('[data-sensitivity]').addEventListener('input',sensitivityChange);$('[data-time-of-day]').addEventListener('input',timeOfDayChange);$('[data-day-cycle]').addEventListener('change',dayCycleChange);$('[data-weather]').addEventListener('change',weatherChange);$('[data-minimap]').addEventListener('change',e=>{mapVisible=e.target.checked;root.querySelector('.aether-minimap-wrap').hidden=!mapVisible;});
    resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(canvas);document.addEventListener('keydown',globalKeyDown,true);lastFrame=performance.now();raf=requestAnimationFrame(frame);updateLocation();drawMinimap();
  }catch(error){$('[data-error]').hidden=false;$('[data-error]').textContent=`Orvexa could not start the 3D world.\n${error.message}`;console.error('Aetherfall:',error);}
  return cleanup;
}
