import { advanceControllers, advancePhysics } from './engine.js';
import { buildWorldPartition, queryWorldPartition, worldPartitionStats } from './worldPartition.js';
import { buildVfxTriangleMesh, stepVfxEmitter } from './vfx.js';

export const ENVIRONMENT_IBL_PRESETS = Object.freeze({
  studio: { label: 'Studio Neutral', zenith: [0.08, 0.22, 0.46], horizon: [0.28, 0.31, 0.37], ground: [0.055, 0.048, 0.04] },
  sunset: { label: 'Copper Sunset', zenith: [0.16, 0.12, 0.34], horizon: [0.58, 0.29, 0.18], ground: [0.09, 0.045, 0.035] },
  overcast: { label: 'Overcast Sky', zenith: [0.24, 0.28, 0.34], horizon: [0.34, 0.37, 0.41], ground: [0.08, 0.085, 0.09] },
  night: { label: 'Moonlit Night', zenith: [0.02, 0.04, 0.12], horizon: [0.07, 0.11, 0.22], ground: [0.015, 0.02, 0.035] },
  ember: { label: 'Ember Forge', zenith: [0.18, 0.06, 0.08], horizon: [0.52, 0.19, 0.09], ground: [0.08, 0.03, 0.02] },
});

export function resolveEnvironmentProbe(preset = 'studio') {
  const key = ENVIRONMENT_IBL_PRESETS[preset] ? preset : 'studio';
  return { preset: key, ...ENVIRONMENT_IBL_PRESETS[key] };
}

export const ENVIRONMENT_IBL_PROBES = ENVIRONMENT_IBL_PRESETS;

export const TONE_MAPPING_MODES = Object.freeze(['aces', 'agx', 'filmic']);
export const TONE_MAPPING_MODE_DETAILS = Object.freeze({
  aces: { id: 'aces', label: 'ACES Filmic', description: 'Unreal Engine 5 default ACES filmic tonemapper.' },
  agx: { id: 'agx', label: 'AgX', description: 'Blender 4 AgX view transform with smooth highlight roll-off.' },
  filmic: { id: 'filmic', label: 'Filmic', description: 'Classic filmic curve used by earlier Orvexa releases.' },
});

export function resolveToneMappingMode(mode = 'aces') {
  return TONE_MAPPING_MODES.includes(mode) ? mode : 'aces';
}

export function resolveEnvironmentIBL(preset = 'studio', options = {}) {
  const probe = resolveEnvironmentProbe(typeof preset === 'string' ? preset : (preset?.preset || preset?.environmentPreset || 'studio'));
  const toneMapping = resolveToneMappingMode(options.toneMapping || options.toneMappingMode || (typeof preset === 'object' ? (preset.toneMapping || preset.toneMappingMode) : undefined) || 'aces');
  return {
    ...probe,
    ibl: probe,
    environment: probe,
    toneMapping,
    toneMappingMode: toneMapping,
    lumenGI: options.lumenGI !== false && options.globalIllumination !== false,
    globalIllumination: options.lumenGI !== false && options.globalIllumination !== false,
    bloom: options.bloom !== false,
    bloomStrength: Math.min(2, Math.max(0, Number(options.bloomStrength ?? 0.35) || 0)),
  };
}

export function groupInstancedDrawables(objects = []) {
  const groups = new Map();
  let instancedObjectCount = 0;
  for (const obj of Array.isArray(objects) ? objects : []) {
    if (!obj || obj.visible === false || obj.type === 'light' || obj.type === 'camera' || obj.type === 'animation') continue;
    const mat = obj.material || {};
    const key = `${obj.type}::${obj.primitive || obj.type}::${obj.color || '#7c5cff'}::${Number(mat.metallic || 0).toFixed(2)}::${Number(mat.roughness ?? 0.68).toFixed(2)}::${obj.flatShading ? 'flat' : 'smooth'}`;
    if (!groups.has(key)) groups.set(key, { key, type: obj.type, objects: [] });
    groups.get(key).objects.push(obj);
  }
  const batches = [...groups.values()];
  for (const batch of batches) {
    if (batch.objects.length > 1) instancedObjectCount += batch.objects.length;
  }
  const totalObjects = batches.reduce((s, b) => s + b.objects.length, 0);
  return {
    batches,
    batchCount: batches.length,
    totalObjects,
    instancedObjectCount,
    savedDrawCalls: Math.max(0, totalObjects - batches.length),
  };
}

export function groupInstancedMeshBatches(objects = []) {
  const grouped = groupInstancedDrawables(objects);
  return { ...grouped, instancedMeshBatches: grouped.batches, groups: grouped.batches };
}

const VERTEX_SHADER = `attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uMvp;
uniform mat4 uModel;
uniform mat4 uLightMvp;
uniform vec3 uInverseScale;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec4 vShadowPosition;
varying vec2 vUV;
void main(){ vec4 world=uModel*vec4(aPosition,1.0); gl_Position=uMvp*vec4(aPosition,1.0); vWorldPosition=world.xyz; vNormal=normalize(mat3(uModel)*(aNormal*uInverseScale)); vShadowPosition=uLightMvp*world; vUV=aUV; }`;
const FRAGMENT_SHADER = `precision mediump float;
uniform vec3 uColor;
uniform vec3 uLightPos[4];
uniform vec3 uLightDirection[4];
uniform vec3 uLightColor[4];
uniform float uLightType[4];
uniform float uLightRange[4];
uniform float uSpotInnerCos[4];
uniform float uSpotOuterCos[4];
uniform int uLightCount;
uniform vec3 uCameraPos;
uniform vec3 uMaterial;
uniform float uClearcoat;
uniform float uAOStrength;
uniform float uNormalScale;
uniform vec3 uEmissiveTint;
uniform float uEmissiveUsesAlbedo;
uniform float uEnvironmentStrength;
uniform float uShadowFilter;
uniform sampler2D uShadowMap;
uniform sampler2D uBaseMap;
uniform float uUseBaseMap;
uniform sampler2D uMetalRoughMap;
uniform float uUseMetalRoughMap;
uniform sampler2D uAOMap;
uniform float uUseAOMap;
uniform sampler2D uEmissiveMap;
uniform float uUseEmissiveMap;
uniform sampler2D uNormalMap;
uniform float uUseNormalMap;
uniform float uShadowEnabled;
uniform vec2 uShadowTexel;
uniform vec2 uViewport;
uniform float uExposure;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uVignette;
uniform vec3 uEnvZenith;
uniform vec3 uEnvHorizon;
uniform vec3 uEnvGround;
uniform float uToneMappingMode;
uniform float uLumenGI;
uniform float uBloomStrength;
uniform float uBloomThreshold;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec4 vShadowPosition;
varying vec2 vUV;
const float PI=3.14159265359;
float unpackDepth(vec4 c){ return dot(c, vec4(1.0, 0.0039215686, 0.0000153787, 0.0000000603)); }
float shadowFactor(){ if(uShadowEnabled<0.5 || vShadowPosition.w<=0.0) return 1.0; vec3 p=vShadowPosition.xyz/vShadowPosition.w*0.5+0.5; if(p.x<=0.002||p.x>=0.998||p.y<=0.002||p.y>=0.998||p.z<=0.0||p.z>=1.0) return 1.0; float sum=0.0; for(int x=-1;x<=1;x++){ for(int y=-1;y<=1;y++){ vec2 uv=p.xy+vec2(float(x),float(y))*uShadowTexel*uShadowFilter; float z=unpackDepth(texture2D(uShadowMap,uv)); sum+=(p.z-0.0028<=z)?1.0:0.30; }} return sum/9.0; }
float distributionGGX(vec3 n,vec3 h,float rough){ float a=rough*rough; float a2=a*a; float ndh=max(dot(n,h),0.0); float d=ndh*ndh*(a2-1.0)+1.0; return a2/max(PI*d*d,0.0001); }
float geometrySchlickGGX(float ndv,float rough){ float r=rough+1.0; float k=(r*r)/8.0; return ndv/max(ndv*(1.0-k)+k,0.0001); }
float geometrySmith(vec3 n,vec3 v,vec3 l,float rough){ return geometrySchlickGGX(max(dot(n,v),0.0),rough)*geometrySchlickGGX(max(dot(n,l),0.0),rough); }
vec3 fresnelSchlick(float cosine,vec3 f0){ return f0+(1.0-f0)*pow(1.0-clamp(cosine,0.0,1.0),5.0); }
vec3 skyRadiance(vec3 d){ float t=clamp(d.y*0.5+0.5,0.0,1.0); return d.y>=0.0?mix(uEnvHorizon,uEnvZenith,t):mix(uEnvGround,uEnvHorizon,clamp(d.y+1.0,0.0,1.0)); }
vec3 filmic(vec3 x){ x=max(vec3(0.0),x*max(0.1,uExposure)); return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 aces(vec3 x){ x=max(vec3(0.0),x*max(0.1,uExposure)); return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 agx(vec3 x){ x=max(vec3(0.0),x*max(0.1,uExposure)); vec3 y=log2(max(x,vec3(1e-5))*2.4); y=clamp((y+12.0)/18.0,0.0,1.0); return clamp(y*y*(3.0-2.0*y)*1.08-0.04,0.0,1.0); }
vec3 applyToneMapping(vec3 x){ if(uToneMappingMode>1.5) return filmic(x); if(uToneMappingMode>0.5) return agx(x); return aces(x); }
void main(){
 vec3 n=normalize(vNormal); vec3 v=normalize(uCameraPos-vWorldPosition); float rough=clamp(uMaterial.y,0.045,1.0); float metal=clamp(uMaterial.x,0.0,1.0); float ao=mix(1.0,texture2D(uAOMap,vUV).r,uUseAOMap*clamp(uAOStrength,0.0,1.0)); float shade=shadowFactor();
 vec3 texel=texture2D(uBaseMap,vUV).rgb; vec3 albedo=uColor*mix(vec3(1.0),pow(max(texel,vec3(0.0)),vec3(2.2)),uUseBaseMap); vec4 mrSample=texture2D(uMetalRoughMap,vUV); rough=clamp(rough*mix(1.0,mrSample.g,uUseMetalRoughMap),0.045,1.0); metal=clamp(metal*mix(1.0,mrSample.b,uUseMetalRoughMap),0.0,1.0);
 float ndv=max(dot(n,v),0.001); vec3 f0=mix(vec3(0.04),albedo,metal); vec3 fView=fresnelSchlick(ndv,f0);
 vec3 irradiance=mix(uEnvGround,mix(uEnvHorizon,uEnvZenith,0.45),clamp(n.y*0.5+0.5,0.0,1.0));
 vec3 reflected=skyRadiance(reflect(-v,n)); vec3 envSpec=mix(reflected,uEnvHorizon*0.65,rough*rough);
 vec3 ambientDiffuse=albedo*irradiance*(1.0-metal)*uEnvironmentStrength*ao;
 vec3 ambientSpec=envSpec*fView*(1.0-0.42*rough)*uEnvironmentStrength*ao;
 vec3 direct=vec3(0.0);
 for(int i=0;i<4;i++){ if(i<uLightCount){ vec3 delta=uLightPos[i]-vWorldPosition; float dist=max(length(delta),0.001); vec3 lightDir=normalize(uLightDirection[i]); vec3 l=(uLightType[i]>0.5&&uLightType[i]<1.5)?normalize(-lightDir):delta/dist; vec3 h=normalize(v+l); float ndl=max(dot(n,l),0.0); if(ndl>0.0){ float d=distributionGGX(n,h,rough); float g=geometrySmith(n,v,l,rough); vec3 f=fresnelSchlick(max(dot(h,v),0.0),f0); vec3 spec=(d*g*f)/max(4.0*ndv*ndl,0.001); vec3 kd=(vec3(1.0)-f)*(1.0-metal); vec3 diffuse=kd*albedo/PI; float coatD=distributionGGX(n,h,0.12); float coatG=geometrySmith(n,v,l,0.12); vec3 coatF=fresnelSchlick(max(dot(h,v),0.0),vec3(0.04)); vec3 coat=(coatD*coatG*coatF/max(4.0*ndv*ndl,0.001))*clamp(uClearcoat,0.0,1.0)*0.25; float rangeRatio=dist/max(uLightRange[i],0.1); float rangeFade=pow(clamp(1.0-rangeRatio*rangeRatio*rangeRatio*rangeRatio,0.0,1.0),2.0); float attenuation=(uLightType[i]>0.5&&uLightType[i]<1.5)?1.0:rangeFade/(1.0+0.035*dist*dist); if(uLightType[i]>1.5){ float cone=dot(normalize(vWorldPosition-uLightPos[i]),lightDir); attenuation*=smoothstep(uSpotOuterCos[i],uSpotInnerCos[i],cone); } float visibility=(i==0)?shade:1.0; direct+=(diffuse+spec+coat)*uLightColor[i]*ndl*attenuation*visibility; } }}
 vec3 emissiveBase=mix(uEmissiveTint,albedo*uEmissiveTint,uEmissiveUsesAlbedo);vec3 emissiveTexture=pow(max(texture2D(uEmissiveMap,vUV).rgb,vec3(0.0)),vec3(2.2))*uEmissiveTint;vec3 emissiveColor=mix(emissiveBase,emissiveTexture,uUseEmissiveMap); vec3 lumenGI=ambientDiffuse*irradiance*uLumenGI*0.85; vec3 c=ambientDiffuse+ambientSpec+direct+emissiveColor*uMaterial.z+lumenGI;
 float dist=length(uCameraPos-vWorldPosition); float fog=1.0-exp(-max(0.0,uFogDensity)*dist); c=mix(c,uFogColor,clamp(fog,0.0,0.82)); vec2 uv=gl_FragCoord.xy/max(uViewport,vec2(1.0)); float vignette=1.0-uVignette*smoothstep(0.2,0.95,length(uv-0.5)*1.35); c*=vignette;
 vec3 bloomGlow=max(c-uBloomThreshold,vec3(0.0)); c+=bloomGlow*bloomGlow*uBloomStrength; gl_FragColor=vec4(pow(max(applyToneMapping(c),vec3(0.0)),vec3(1.0/2.2)),1.0);
}`;
const SHADOW_VERTEX_SHADER = `attribute vec3 aPosition; uniform mat4 uMvp; void main(){gl_Position=uMvp*vec4(aPosition,1.0);}`;
const SHADOW_FRAGMENT_SHADER = `precision mediump float; vec4 packDepth(float v){const vec4 bitShift=vec4(1.0,255.0,65025.0,16581375.0);const vec4 bitMask=vec4(0.0,0.0039215686,0.0039215686,0.0039215686);vec4 c=fract(v*bitShift);c-=c.yzww*bitMask;return c;} void main(){gl_FragColor=packDepth(gl_FragCoord.z);}`;

export function createMeshGeometry(type, segments = 16) {
  const positions = [];
  const tri = (a,b,c) => positions.push(...a,...b,...c);
  if (type === 'sphere') {
    const rings = Math.max(6, Math.min(48, segments));
    const slices = rings * 2;
    const point = (r,s) => { const p=Math.PI*r/rings, t=2*Math.PI*s/slices; return [Math.sin(p)*Math.cos(t),Math.cos(p),Math.sin(p)*Math.sin(t)]; };
    for(let r=0;r<rings;r++) for(let s=0;s<slices;s++) { const a=point(r,s),b=point(r+1,s),c=point(r+1,s+1),d=point(r,s+1); tri(a,b,d); tri(b,c,d); }
  } else if (type === 'plane') {
    tri([-0.5,0,-0.5],[0.5,0,-0.5],[0.5,0,0.5]); tri([-0.5,0,-0.5],[0.5,0,0.5],[-0.5,0,0.5]);
  } else if (type === 'torus') {
    const rings = Math.max(8, Math.min(48, segments * 2)), sides = Math.max(6, Math.min(24, segments));
    const point = (u,v) => { const a=2*Math.PI*u/rings,b=2*Math.PI*v/sides,r=.34+.16*Math.cos(b); return [r*Math.cos(a),.16*Math.sin(b),r*Math.sin(a)]; };
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);tri(a,b,d);tri(b,c,d);}
  } else if (type === 'cylinder') {
    const n = Math.max(6, Math.min(64, segments));
    for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n, p=[Math.cos(a)*.5,-.5,Math.sin(a)*.5],q=[Math.cos(b)*.5,-.5,Math.sin(b)*.5],r=[Math.cos(b)*.5,.5,Math.sin(b)*.5],s=[Math.cos(a)*.5,.5,Math.sin(a)*.5];tri(p,q,r);tri(p,r,s);tri([0,-.5,0],q,p);tri([0,.5,0],s,r);}
  } else if (type === 'cone') {
    const n=Math.max(6,Math.min(64,segments));for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,p=[Math.cos(a)*.5,-.5,Math.sin(a)*.5],q=[Math.cos(b)*.5,-.5,Math.sin(b)*.5];tri(p,q,[0,.5,0]);tri([0,-.5,0],q,p);}
  } else if (type === 'pyramid') {
    const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,.5,0]];tri(v[0],v[2],v[1]);tri(v[0],v[3],v[2]);for(let i=0;i<4;i++)tri(v[i],v[(i+1)%4],v[4]);
  } else if (type === 'capsule') {
    const sides=Math.max(8,Math.min(32,segments)),rings=Math.max(12,Math.min(48,segments*2));const point=(r,j)=>{const y=-.5+r/rings,rad=y<-.25?Math.sqrt(Math.max(0,.25*.25-(y+.25)*(y+.25))):y>.25?Math.sqrt(Math.max(0,.25*.25-(y-.25)*(y-.25))):.25;const t=2*Math.PI*j/sides;return [rad*Math.cos(t),y,rad*Math.sin(t)];};for(let r=0;r<rings;r++)for(let j=0;j<sides;j++){const a=point(r,j),b=point(r+1,j),c=point(r+1,j+1),d=point(r,j+1);tri(a,b,d);tri(b,c,d);}
  } else {
    const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
    for(const f of [[0,1,2,0,2,3],[4,6,5,4,7,6],[0,4,5,0,5,1],[3,2,6,3,6,7],[1,5,6,1,6,2],[0,3,7,0,7,4]]) for(let i=0;i<f.length;i+=3) tri(v[f[i]],v[f[i+1]],v[f[i+2]]);
  }
  return new Float32Array(positions);
}

const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;}
function ortho(left,right,bottom,top,near,far){const o=new Float32Array(16);o[0]=2/(right-left);o[5]=2/(top-bottom);o[10]=-2/(far-near);o[12]=-(right+left)/(right-left);o[13]=-(top+bottom)/(top-bottom);o[14]=-(far+near)/(far-near);o[15]=1;return o;}
export function createLookAtMatrix(eyeInput, centerInput, upInput = [0, 1, 0]) {
  const vector = (value, fallback) => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite) ? value.slice(0, 3) : fallback;
  const eye = vector(eyeInput, [0, 0, 1]);
  const center = vector(centerInput, [0, 0, 0]);
  const up = vector(upInput, [0, 1, 0]);
  const sub = (a, b) => a.map((value, index) => value - b[index]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (value, fallback) => { const length = Math.hypot(...value); return Number.isFinite(length) && length > 1e-8 ? value.map(component => component / length) : fallback; };
  const z = norm(sub(eye, center), [0, 0, 1]);
  let safeUp = norm(up, [0, 1, 0]);
  if (Math.abs(dot(safeUp, z)) > 0.985) safeUp = Math.abs(z[2]) < 0.985 ? [0, 0, 1] : [1, 0, 0];
  const x = norm(cross(safeUp, z), [1, 0, 0]);
  const y = norm(cross(z, x), [0, 1, 0]);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
const lookAt = createLookAtMatrix;
function modelMatrix(position,size,rotation={},scale={}){const rx=Number(rotation.x)||0,ry=Number(rotation.y)||0,rz=Number(rotation.z)||0,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);const sm=new Float32Array([(Number(scale.x)||1)*size,0,0,0,0,(Number(scale.y)||1)*size,0,0,0,0,(Number(scale.z)||1)*size,0,0,0,0,1]);const mx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);const my=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);const mz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);const t=identity();t[12]=Number(position.x)||0;t[13]=Number(position.y)||0;t[14]=Number(position.z)||0;return multiply(multiply(multiply(multiply(multiply(t,mz),my),mx),sm),identity());}
function interleaveNormals(positions,type='cube',uvs=null,smoothCustom=true){
  const output=new Float32Array((positions.length/3)*8);
  const smoothNormalMap = new Map();
  if(type==='mesh' && smoothCustom){
    const key=(x,y,z)=>`${Number(x).toFixed(5)},${Number(y).toFixed(5)},${Number(z).toFixed(5)}`;
    for(let i=0;i<positions.length;i+=9){
      const ax=positions[i],ay=positions[i+1],az=positions[i+2],ux=positions[i+3]-ax,uy=positions[i+4]-ay,uz=positions[i+5]-az,vx=positions[i+6]-ax,vy=positions[i+7]-ay,vz=positions[i+8]-az;
      const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],len=Math.hypot(...n)||1;for(let j=0;j<3;j++){const k=i+j*3,id=key(positions[k],positions[k+1],positions[k+2]),old=smoothNormalMap.get(id)||[0,0,0];old[0]+=n[0]/len;old[1]+=n[1]/len;old[2]+=n[2]/len;smoothNormalMap.set(id,old);}
    }
  }
  for(let i=0;i<positions.length;i+=9){
    const ax=positions[i],ay=positions[i+1],az=positions[i+2],bx=positions[i+3],by=positions[i+4],bz=positions[i+5],cx=positions[i+6],cy=positions[i+7],cz=positions[i+8];
    const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;let fnx=uy*vz-uz*vy,fny=uz*vx-ux*vz,fnz=ux*vy-uy*vx;const fl=Math.hypot(fnx,fny,fnz)||1;fnx/=fl;fny/=fl;fnz/=fl;
    const points=[[ax,ay,az],[bx,by,bz],[cx,cy,cz]],nxA=Math.abs(fnx),nyA=Math.abs(fny),nzA=Math.abs(fnz),axes=nxA>=nyA&&nxA>=nzA?[2,1]:nyA>=nxA&&nyA>=nzA?[0,2]:[0,1],minU=Math.min(...points.map(p=>p[axes[0]])),maxU=Math.max(...points.map(p=>p[axes[0]])),minV=Math.min(...points.map(p=>p[axes[1]])),maxV=Math.max(...points.map(p=>p[axes[1]]));
    for(let j=0;j<3;j++){
      const k=i+j*3,o=(i/3+j)*8,x=positions[k],y=positions[k+1],z=positions[k+2];let nx=fnx,ny=fny,nz=fnz;
      if(type==='mesh'&&smoothCustom){const smoothN=smoothNormalMap.get(`${Number(x).toFixed(5)},${Number(y).toFixed(5)},${Number(z).toFixed(5)}`)||[fnx,fny,fnz];nx=smoothN[0];ny=smoothN[1];nz=smoothN[2];}else if(type==='sphere'){nx=x;ny=y;nz=z;}else if(type==='capsule'){const cy2=y<-.25?-.25:y>.25?.25:y;nx=x;ny=y-cy2;nz=z;}else if(type==='torus'){const radial=Math.hypot(x,z)||1;nx=x-.34*x/radial;ny=y;nz=z-.34*z/radial;}else if(type==='cylinder'&&Math.abs(fny)<.55){nx=x;ny=0;nz=z;}else if(type==='cone'&&Math.abs(fny)<.65){nx=x;ny=.5;nz=z;}
      const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;output[o]=x;output[o+1]=y;output[o+2]=z;output[o+3]=nx;output[o+4]=ny;output[o+5]=nz;
      const uvIndex=(k/3)*2;if(uvs&&uvs.length===positions.length/3*2){output[o+6]=Number(uvs[uvIndex]);output[o+7]=Number(uvs[uvIndex+1]);}else{output[o+6]=(points[j][axes[0]]-minU)/Math.max(1e-6,maxU-minU);output[o+7]=(points[j][axes[1]]-minV)/Math.max(1e-6,maxV-minV);}
    }
  }
  return output;
}
function colorRgb(value){const m=String(value||'#7c5cff').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!m)return [0.49,0.36,1].map(c=>Math.pow(c,2.2));let h=m[1];if(h.length===3)h=[...h].map(x=>x+x).join('');return [0,2,4].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);});}
function normalMappedFragmentSource(gl){if(!gl.getExtension('OES_standard_derivatives'))return FRAGMENT_SHADER;const helper=`vec3 applyNormalMap(vec3 n,vec3 worldPos,vec2 uv){vec3 dp1=dFdx(worldPos),dp2=dFdy(worldPos);vec2 duv1=dFdx(uv),duv2=dFdy(uv);float det=duv1.x*duv2.y-duv1.y*duv2.x;if(abs(det)<0.00001)return n;vec3 t=normalize((dp1*duv2.y-dp2*duv1.y)/det);vec3 b=normalize((-dp1*duv2.x+dp2*duv1.x)/det);t=normalize(t-n*dot(n,t));b=normalize(b-n*dot(n,b)-t*dot(t,b));vec3 sampled=texture2D(uNormalMap,uv).xyz*2.0-1.0;sampled.xy*=clamp(uNormalScale,0.0,4.0);return normalize(mat3(t,b,n)*sampled);}`;return FRAGMENT_SHADER.replace('precision mediump float;','#extension GL_OES_standard_derivatives : enable\nprecision mediump float;').replace('void main(){',helper+'\nvoid main(){').replace('vec3 n=normalize(vNormal);','vec3 n=normalize(vNormal);if(uUseNormalMap>0.5)n=applyNormalMap(n,vWorldPosition,vUV);');}
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader)||'Shader compilation failed';gl.deleteShader(shader);throw new Error(message);}return shader;}


/** Choose a bounded render profile for mobile and desktop hardware. */
export function normalizeLightSettings(light = {}, target = { x: 0, y: 0, z: 0 }) {
  const allowed = new Set(['point', 'directional', 'spot']);
  const type = allowed.has(light.lightType) ? light.lightType : 'point';
  const position = light.position || { x: 3, y: 5, z: 4 };
  const supplied = light.direction;
  let direction;
  if (supplied && [supplied.x, supplied.y, supplied.z].every(value => Number.isFinite(Number(value)))) {
    direction = [Number(supplied.x), Number(supplied.y), Number(supplied.z)];
  } else if (type === 'spot') {
    direction = [Number(target.x || 0) - Number(position.x || 0), Number(target.y || 0) - Number(position.y || 0), Number(target.z || 0) - Number(position.z || 0)];
  } else {
    direction = [-Number(position.x || 0), -Number(position.y || 0), -Number(position.z || 0)];
  }
  let magnitude = Math.hypot(...direction);
  if (!Number.isFinite(magnitude) || magnitude < 1e-5) { direction = [0, -1, 0]; magnitude = 1; }
  direction = direction.map(value => value / magnitude);
  const intensity = Math.max(0, Math.min(12, Number.isFinite(Number(light.intensity)) ? Number(light.intensity) : 1));
  const range = Math.max(0.1, Math.min(500, Number.isFinite(Number(light.range)) ? Number(light.range) : 20));
  const innerCone = Math.max(0, Math.min(88, Number.isFinite(Number(light.innerCone)) ? Number(light.innerCone) : 15));
  const outerCone = Math.max(innerCone + 1, Math.min(89, Number.isFinite(Number(light.outerCone)) ? Number(light.outerCone) : 28));
  return { type, typeCode: type === 'directional' ? 1 : type === 'spot' ? 2 : 0, intensity, range, innerCone, outerCone, direction };
}


export function sceneObjectIdentity(object, index = 0) {
  return String(object?.engineId || object?.id || object?.name || index);
}

export function selectRenderLights(objects = [], shadowCasterId = 'auto', maxLights = 4) {
  const limit = Math.max(1, Math.min(4, Math.floor(Number(maxLights) || 4)));
  const visible = (Array.isArray(objects) ? objects : []).map((object, index) => ({ object, index }))
    .filter(({ object }) => object?.type === 'light' && object.visible !== false);
  const caster = shadowCasterId && shadowCasterId !== 'auto'
    ? visible.find(({ object, index }) => sceneObjectIdentity(object, index) === String(shadowCasterId))
    : null;
  const ordered = caster ? [caster, ...visible.filter(item => item !== caster)] : visible;
  return ordered.slice(0, limit).map(item => item.object);
}

export function normalizeShadowResolution(value, maxTextureSize = 4096) {
  const allowed = [512, 1024, 2048];
  const requested = allowed.includes(Number(value)) ? Number(value) : 1024;
  const maximum = Math.max(256, Math.floor(Number(maxTextureSize) || 4096));
  return Math.min(requested, maximum);
}

export function computeRenderProfile(settings = {}, devicePixelRatio = 1) {
  const mode = ['low', 'balanced', 'high', 'ultra'].includes(settings.performanceMode) ? settings.performanceMode : 'balanced';
  const profiles = { low: { scale: 0.58, segments: 8, shadows: false }, balanced: { scale: 0.78, segments: 12, shadows: true }, high: { scale: 1, segments: 16, shadows: true }, ultra: { scale: 1.2, segments: 24, shadows: true } };
  const profile = profiles[mode];
  const customScale = Number(settings.renderScale);
  const scale = Number.isFinite(customScale) ? Math.max(0.45, Math.min(1.25, customScale)) : profile.scale;
  return { mode, scale, segments: profile.segments, shadows: profile.shadows && settings.shadows !== false, pixelRatio: Math.max(0.5, Math.min(mode === 'ultra' ? 2 : 1.5, Math.min(mode === 'low' ? 1 : mode === 'balanced' ? 1.25 : mode === 'high' ? 1.5 : 2, Number(devicePixelRatio) || 1) * scale)), adaptive: settings.adaptiveResolution !== false };
}


/** Select progressively cheaper primitive meshes as screen contribution shrinks. */
export function computeLodSegments(baseSegments, distance) {
  const base = Math.max(6, Math.min(48, Math.round(Number(baseSegments) || 16)));
  const d = Math.max(0, Number(distance) || 0);
  if (d >= 34) return 8;
  if (d >= 17) return Math.max(8, Math.round(base / 2));
  if (d >= 9) return Math.max(8, Math.round(base * 0.75));
  return base;
}

/** Bounding-sphere frustum test for a camera orbiting the world origin. */
export function sphereInCameraFrustum(center, radius, eye, aspect = 1, fov = Math.PI / 4, near = 0.1, far = 500, target = [0, 0, 0]) {
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm = v => { const l=Math.hypot(v[0],v[1],v[2])||1; return v.map(n=>n/l); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const c = [Number(center?.x)||0,Number(center?.y)||0,Number(center?.z)||0];
  const e = [Number(eye?.[0])||0,Number(eye?.[1])||0,Number(eye?.[2])||0];
  const t = Array.isArray(target) ? target.map(v => Number(v)||0) : [Number(target?.x)||0,Number(target?.y)||0,Number(target?.z)||0];
  const r = Math.max(0,Number(radius)||0); const forward=norm(sub(t,e));
  const right=norm(cross(forward,[0,1,0])); const up=norm(cross(right,forward)); const rel=sub(c,e);
  const depth=dot(rel,forward), horizontal=dot(rel,right), vertical=dot(rel,up);
  if(depth+r<near || depth-r>far) return false;
  const safeDepth=Math.max(near,depth); const tan=Math.tan(fov/2);
  return Math.abs(horizontal)<=safeDepth*tan*Math.max(0.01,aspect)+r && Math.abs(vertical)<=safeDepth*tan+r;
}

/** Project a world-space point into the editor viewport using the renderer's orbit-camera convention. */
export function projectScenePoint(point, camera = {}, width = 1, height = 1, fov = Math.PI / 4) {
  const w = Number(width), h = Number(height);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const targetSource = camera?.target || { x: 0, y: 0, z: 0 };
  const target = [Number(targetSource.x) || 0, Number(targetSource.y) || 0, Number(targetSource.z) || 0];
  const angle = Number.isFinite(Number(camera?.angle)) ? Number(camera.angle) : 0;
  const pitch = Number.isFinite(Number(camera?.pitch)) ? Math.max(-1.15, Math.min(1.15, Number(camera.pitch))) : Math.atan2(1.2, 7);
  const zoom = Number.isFinite(Number(camera?.zoom)) && Number(camera.zoom) > 0 ? Math.max(2.5, Math.min(80, Number(camera.zoom))) : Math.hypot(1.2, 7);
  const horizontalDistance = Math.cos(pitch) * zoom;
  const eye = [target[0] + Math.sin(angle) * horizontalDistance, target[1] + Math.sin(pitch) * zoom, target[2] + Math.cos(angle) * horizontalDistance];
  const subtract = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
  const forward = normalize(subtract(target, eye));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = normalize(cross(right, forward));
  const worldPoint = [Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0];
  const relative = subtract(worldPoint, eye), depth = dot(relative, forward);
  if (!Number.isFinite(depth) || depth <= 0.1) return null;
  const tangent = Math.tan(Math.max(0.05, Math.min(Math.PI - 0.05, Number(fov) || Math.PI / 4)) / 2);
  const ndcX = dot(relative, right) / (depth * tangent * (w / h));
  const ndcY = dot(relative, up) / (depth * tangent);
  return { x: (ndcX + 1) * w / 2, y: (1 - ndcY) * h / 2, depth, ndcX, ndcY, visible: Math.abs(ndcX) <= 1.2 && Math.abs(ndcY) <= 1.2 };
}

/** Start Orvexa Forge's WebGL material renderer and optional fixed-step physics simulation. */
export function startWebGLScene(canvas, scene) {
  let gl;
  try { gl=canvas.getContext('webgl',{antialias:true,alpha:false})||canvas.getContext('experimental-webgl'); } catch { return null; }
  if(!gl) return null;
  let program, shadowProgram;
  try {
    program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERTEX_SHADER));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,normalMappedFragmentSource(gl)));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader linking failed');
    shadowProgram=gl.createProgram();gl.attachShader(shadowProgram,compile(gl,gl.VERTEX_SHADER,SHADOW_VERTEX_SHADER));gl.attachShader(shadowProgram,compile(gl,gl.FRAGMENT_SHADER,SHADOW_FRAGMENT_SHADER));gl.linkProgram(shadowProgram);if(!gl.getProgramParameter(shadowProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(shadowProgram)||'Shadow shader linking failed');
  } catch { return null; }
  const loc={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),uv:gl.getAttribLocation(program,'aUV'),baseMap:gl.getUniformLocation(program,'uBaseMap'),useBaseMap:gl.getUniformLocation(program,'uUseBaseMap'),metalRoughMap:gl.getUniformLocation(program,'uMetalRoughMap'),useMetalRoughMap:gl.getUniformLocation(program,'uUseMetalRoughMap'),aoMap:gl.getUniformLocation(program,'uAOMap'),useAOMap:gl.getUniformLocation(program,'uUseAOMap'),emissiveMap:gl.getUniformLocation(program,'uEmissiveMap'),useEmissiveMap:gl.getUniformLocation(program,'uUseEmissiveMap'),normalMap:gl.getUniformLocation(program,'uNormalMap'),useNormalMap:gl.getUniformLocation(program,'uUseNormalMap'),mvp:gl.getUniformLocation(program,'uMvp'),model:gl.getUniformLocation(program,'uModel'),lightMvp:gl.getUniformLocation(program,'uLightMvp'),color:gl.getUniformLocation(program,'uColor'),lightPos:gl.getUniformLocation(program,'uLightPos[0]'),lightDirection:gl.getUniformLocation(program,'uLightDirection[0]'),lightColor:gl.getUniformLocation(program,'uLightColor[0]'),lightType:gl.getUniformLocation(program,'uLightType[0]'),lightRange:gl.getUniformLocation(program,'uLightRange[0]'),spotInnerCos:gl.getUniformLocation(program,'uSpotInnerCos[0]'),spotOuterCos:gl.getUniformLocation(program,'uSpotOuterCos[0]'),lightCount:gl.getUniformLocation(program,'uLightCount'),cameraPos:gl.getUniformLocation(program,'uCameraPos'),material:gl.getUniformLocation(program,'uMaterial'),inverseScale:gl.getUniformLocation(program,'uInverseScale'),clearcoat:gl.getUniformLocation(program,'uClearcoat'),aoStrength:gl.getUniformLocation(program,'uAOStrength'),normalScale:gl.getUniformLocation(program,'uNormalScale'),emissiveTint:gl.getUniformLocation(program,'uEmissiveTint'),emissiveUsesAlbedo:gl.getUniformLocation(program,'uEmissiveUsesAlbedo'),environmentStrength:gl.getUniformLocation(program,'uEnvironmentStrength'),shadowFilter:gl.getUniformLocation(program,'uShadowFilter'),shadowMap:gl.getUniformLocation(program,'uShadowMap'),shadowEnabled:gl.getUniformLocation(program,'uShadowEnabled'),shadowTexel:gl.getUniformLocation(program,'uShadowTexel'),viewport:gl.getUniformLocation(program,'uViewport'),exposure:gl.getUniformLocation(program,'uExposure'),fogDensity:gl.getUniformLocation(program,'uFogDensity'),fogColor:gl.getUniformLocation(program,'uFogColor'),vignette:gl.getUniformLocation(program,'uVignette'),envZenith:gl.getUniformLocation(program,'uEnvZenith'),envHorizon:gl.getUniformLocation(program,'uEnvHorizon'),envGround:gl.getUniformLocation(program,'uEnvGround'),toneMappingMode:gl.getUniformLocation(program,'uToneMappingMode'),lumenGI:gl.getUniformLocation(program,'uLumenGI'),bloomStrength:gl.getUniformLocation(program,'uBloomStrength'),bloomThreshold:gl.getUniformLocation(program,'uBloomThreshold')};
  const shadowLoc={position:gl.getAttribLocation(shadowProgram,'aPosition'),mvp:gl.getUniformLocation(shadowProgram,'uMvp')};
  let shadowSize=1024;const shadowSizeLimit=gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048,shadowFramebuffer=gl.createFramebuffer(),shadowTexture=gl.createTexture(),shadowDepth=gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindRenderbuffer(gl.RENDERBUFFER,shadowDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,shadowDepth);let shadowSupported=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  function resizeShadowMap(requested){const next=normalizeShadowResolution(requested,shadowSizeLimit);if(next===shadowSize)return;shadowSize=next;gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindRenderbuffer(gl.RENDERBUFFER,shadowDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,shadowDepth);shadowSupported=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);shadowCacheValid=false;}
  const meshCache=new Map();
  function mesh(type, customGeometry=null, cacheKey=type, uvs=null, segments=16, flatShading=false){const key=customGeometry ? `custom:${cacheKey}:${uvs?"uv":"auto"}:${flatShading?'flat':'smooth'}` : `${type}:s${segments}`;if(meshCache.has(key)){const hit=meshCache.get(key);meshCache.delete(key);meshCache.set(key,hit);return hit;}const positions=customGeometry ? new Float32Array(customGeometry) : createMeshGeometry(type, segments);const data=interleaveNormals(positions,type,uvs,!flatShading);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const value={buffer,count:positions.length/3};if(meshCache.size>=96){const oldestKey=meshCache.keys().next().value,oldest=meshCache.get(oldestKey);if(oldest)gl.deleteBuffer(oldest.buffer);meshCache.delete(oldestKey);}meshCache.set(key,value);return value;}
  const textureCache=new Map();
  const whiteTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  function objectTexture(obj, channel='baseColorImage'){const key=`${obj.engineId||obj.name}::${channel}`,source=obj.material?.[channel],old=textureCache.get(key);if(typeof source!=='string'||!source.startsWith('data:image/')){if(old){gl.deleteTexture(old.texture);textureCache.delete(key);}return null;}if(old?.source===source)return old.loaded?old.texture:null;if(old)gl.deleteTexture(old.texture);const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const record={source,texture,loaded:false,objectId:String(obj.engineId||obj.name)};textureCache.set(key,record);const image=new Image();image.onload=()=>{if(disposed)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);record.loaded=true;requestRender();};image.onerror=()=>{record.loaded=false;};image.src=source;return null;}
  const camera=(scene.objects||[]).find(o=>o.type==='camera'&&o.visible!==false),cameraPosition=camera?.position||{x:0,y:1.2,z:7},savedCamera=scene.editorCamera||{};
  const savedTarget=savedCamera.target||{x:0,y:0,z:0};let cameraTarget=[Number(savedTarget.x)||0,Number(savedTarget.y)||0,Number(savedTarget.z)||0];
  let angle=Number.isFinite(Number(savedCamera.angle))?Number(savedCamera.angle):Math.atan2(Number(cameraPosition.x)||0,Number(cameraPosition.z)||7),pitch=Number.isFinite(Number(savedCamera.pitch))?Math.max(-1.15,Math.min(1.15,Number(savedCamera.pitch))):Math.atan2(Number(cameraPosition.y)||1.2,Math.hypot(Number(cameraPosition.x)||0,Number(cameraPosition.z)||7)),zoom=Math.max(2.5,Math.min(80,Number(savedCamera.zoom)||Math.hypot(Number(cameraPosition.x)||0,Number(cameraPosition.y)||1.2,Number(cameraPosition.z)||7))),dragging=false,lastX=0,lastY=0,frame=0,disposed=false,lastTime=0,frameAverage=16.7,adaptiveScale=1,perfFrameCount=0,lastHudTime=0,frameDrawCalls=0,cachedShadowSignature='',shadowCacheValid=false,culledCount=0,renderDirty=true;
  const storeCamera=()=>{scene.editorCamera={target:{x:cameraTarget[0],y:cameraTarget[1],z:cameraTarget[2]},angle,pitch,zoom};};
  const publishCamera=()=>{storeCamera();try{canvas.dispatchEvent(new CustomEvent('orvexa-camera-change',{detail:scene.editorCamera}));canvas.dispatchEvent(new CustomEvent('orvexa-camera-preview',{detail:scene.editorCamera}));}catch{}};
  const publishCameraPreview=()=>{storeCamera();try{canvas.dispatchEvent(new CustomEvent('orvexa-camera-preview',{detail:scene.editorCamera}));}catch{}};
  const pressedKeys=new Set(),gameKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','space']);
  const requestRender=()=>{renderDirty=true;if(!frame&&!disposed)frame=requestAnimationFrame(tick);};
  const keyDown=e=>{if(!scene.simulation?.running)return;const tag=String(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||e.target?.isContentEditable)return;const key=String(e.key).toLowerCase();if(gameKeys.has(key)){pressedKeys.add(key);if(key.startsWith('arrow')||key===' ')e.preventDefault();}};
  const keyUp=e=>pressedKeys.delete(String(e.key).toLowerCase());const clearKeys=()=>pressedKeys.clear();
  globalThis.addEventListener?.('keydown',keyDown);globalThis.addEventListener?.('keyup',keyUp);globalThis.addEventListener?.('blur',clearKeys);
  const down=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId);requestRender();};
  const move=e=>{if(!dragging)return;angle+=(e.clientX-lastX)*.009;pitch=Math.max(-1.15,Math.min(1.15,pitch+(e.clientY-lastY)*.008));lastX=e.clientX;lastY=e.clientY;publishCameraPreview();requestRender();};
  const up=()=>{if(dragging){dragging=false;publishCamera();}};
  const wheel=e=>{e.preventDefault();zoom=Math.max(2.5,Math.min(80,zoom+e.deltaY*.008));publishCameraPreview();requestRender();};
  globalThis.document?.addEventListener('visibilitychange',requestRender);
  const onResize=()=>{requestRender();publishCameraPreview();};
  let worldPartitionCache = null;
  let worldPartitionQueryCache = null;
  const onRenderSettingsChange=()=>{worldPartitionCache=null;worldPartitionQueryCache=null;requestRender();};canvas.addEventListener('orvexa-render-settings-change',onRenderSettingsChange);
  globalThis.addEventListener?.('resize',onResize);
  const onResizeObserved=()=>{requestRender();publishCameraPreview();};
  const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(onResizeObserved):null;resizeObserver?.observe(canvas);
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
  const tick=time=>{
    frame=0;
    if(disposed||!canvas.isConnected)return;
    if(globalThis.document?.hidden){lastTime=time;return;}
    const animated=Boolean(scene.simulation?.running)||(scene.objects||[]).some(o=>(o.type==='animation'||Boolean(o.vfxEmitter?.enabled))&&o.visible!==false);
    if(!renderDirty&&!animated)return;
    renderDirty=false;
    const rawFrameMs=lastTime?Math.max(0,Math.min(100,(time-lastTime))):16.7;frameAverage=frameAverage*.9+rawFrameMs*.1;lastTime=time;perfFrameCount++;
    if(perfFrameCount%24===0){const profileNow=computeRenderProfile(scene.renderSettings||{},globalThis.devicePixelRatio||1);if(profileNow.adaptive){if(frameAverage>24)adaptiveScale=Math.max(.5,Math.round((adaptiveScale-.06)*100)/100);else if(frameAverage<15)adaptiveScale=Math.min(1,Math.round((adaptiveScale+.025)*100)/100);}else adaptiveScale=1;}
    const dt=Math.min(.05,rawFrameMs/1000);
    if(scene.simulation?.running){advanceControllers(scene,dt,pressedKeys);advancePhysics(scene,dt,{gravity:scene.simulation.gravity??9.81,collisions:scene.simulation.collisions!==false});scene.simulation.elapsed=(scene.simulation.elapsed||0)+dt;}
    for(const obj of (scene.objects||[])){if(obj?.vfxEmitter?.enabled&&obj.visible!==false){stepVfxEmitter(obj.vfxEmitter,dt);obj.geometry=buildVfxTriangleMesh(obj.vfxEmitter);obj.geometryRevision=(obj.geometryRevision||0)+1;}}
    const settings=scene.renderSettings||{},profile=computeRenderProfile(settings,globalThis.devicePixelRatio||1),dpr=Math.max(.5,Math.min(2,profile.pixelRatio*adaptiveScale)),rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(time-lastHudTime>500){lastHudTime=time;const instInfo=groupInstancedDrawables(scene.objects||[]);scene.renderStats={fps:Math.round(1000/Math.max(1,frameAverage)),frameMs:Math.round(frameAverage*10)/10,scale:Math.round(dpr*100)/100,mode:profile.mode,drawCalls:frameDrawCalls,instancedBatches:instInfo.batchCount,savedDrawCalls:instInfo.savedDrawCalls,environmentPreset:settings.environmentPreset||'studio'};const hud=canvas.parentElement?.querySelector('[data-forge-perf-hud]');if(hud)hud.textContent=`${scene.renderStats.fps} FPS · ${scene.renderStats.frameMs} ms · ${scene.renderStats.mode.toUpperCase()} · ${scene.renderStats.drawCalls} draws (${instInfo.batchCount} batches) · ${culledCount} culled`; }
    const objects=(scene.objects||[]);
    if(perfFrameCount%120===0){const activeTextureKeys=new Set(objects.map(o=>String(o.engineId||o.name)));for(const [key,item] of textureCache){if(!activeTextureKeys.has(item.objectId)){gl.deleteTexture(item.texture);textureCache.delete(key);}}}
    resizeShadowMap(settings.shadowResolution);
    const lights=selectRenderLights(objects,settings.shadowCasterId||'auto',4),light=lights[0],lp=light?.position||{x:3,y:5,z:4};
    const lightPos=[Number.isFinite(Number(lp.x))?Number(lp.x):3,Number.isFinite(Number(lp.y))?Number(lp.y):5,Number.isFinite(Number(lp.z))?Number(lp.z):4];
    const lightPositionData=new Float32Array(12),lightDirectionData=new Float32Array(12),lightColorData=new Float32Array(12),lightTypeData=new Float32Array(4),lightRangeData=new Float32Array(4),spotInnerCosData=new Float32Array(4),spotOuterCosData=new Float32Array(4);const effectiveLights=lights.length?lights:[{position:{x:3,y:5,z:4},color:'#ffffff'}];const lightSettings=[];for(let i=0;i<4;i++){const item=effectiveLights[Math.min(i,effectiveLights.length-1)],pos=item.position||{x:3,y:5,z:4},normalized=normalizeLightSettings(item,cameraTarget),color=colorRgb(item.color||'#ffffff').map(c=>c*normalized.intensity);lightSettings.push(normalized);lightPositionData.set([Number(pos.x)||0,Number(pos.y)||0,Number(pos.z)||0],i*3);lightDirectionData.set(normalized.direction,i*3);lightColorData.set(color,i*3);lightTypeData[i]=normalized.typeCode;lightRangeData[i]=normalized.range;spotInnerCosData[i]=Math.cos(normalized.innerCone*Math.PI/180);spotOuterCosData[i]=Math.cos(normalized.outerCone*Math.PI/180);}
    const primary=lightSettings[0]||normalizeLightSettings({position:{x:3,y:5,z:4}},cameraTarget);let lightView,lightProjection;const lightShadowFar=Math.max(10,Math.min(500,primary.range||20));if(primary.type==='directional'){const source=[cameraTarget[0]-primary.direction[0]*35,cameraTarget[1]-primary.direction[1]*35,cameraTarget[2]-primary.direction[2]*35];lightView=lookAt(source,cameraTarget,[0,1,0]);lightProjection=ortho(-32,32,-32,32,.1,100);}else if(primary.type==='spot'){const target=[lightPos[0]+primary.direction[0]*30,lightPos[1]+primary.direction[1]*30,lightPos[2]+primary.direction[2]*30],spotFov=Math.max(Math.PI/90,Math.min(Math.PI*0.98,primary.outerCone*Math.PI/90));lightView=lookAt(lightPos,target,[0,1,0]);lightProjection=perspective(spotFov,1,.1,lightShadowFar);}else{lightView=lookAt(lightPos,cameraTarget,[0,1,0]);lightProjection=perspective(Math.PI/2,1,.1,lightShadowFar);}const lightVP=multiply(lightProjection,lightView);
    const proj=perspective(Math.PI/4,w/h,.1,500),horizontalDistance=Math.cos(pitch)*zoom,eye=[cameraTarget[0]+Math.sin(angle)*horizontalDistance,cameraTarget[1]+Math.sin(pitch)*zoom,cameraTarget[2]+Math.cos(angle)*horizontalDistance],view=lookAt(eye,cameraTarget,[0,1,0]),vp=multiply(proj,view);
    let drawable=objects.filter(o=>o.visible!==false&&['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'].includes(o.type));
    const partitionOptions = scene.worldPartition || {};
    if (partitionOptions.enabled === true) {
      const cellSize = Math.max(8, Math.min(4096, Number(partitionOptions.cellSize) || 128));
      if (!worldPartitionCache || worldPartitionCache.cellSize !== cellSize) worldPartitionCache = buildWorldPartition(objects, { cellSize });
      worldPartitionQueryCache = queryWorldPartition(worldPartitionCache, { x: eye[0], y: eye[1], z: eye[2] }, { loadRadius: partitionOptions.loadRadius ?? 3, maxLoadedCells: partitionOptions.maxLoadedCells ?? 4096 });
      const loadedObjects = new Set(worldPartitionQueryCache.objects);
      drawable = drawable.filter(object => loadedObjects.has(object));
      scene.renderStats = { ...(scene.renderStats || {}), worldPartition: { ...worldPartitionStats(worldPartitionCache, worldPartitionQueryCache), enabled: true, cellSize, loadRadius: worldPartitionQueryCache.radius } };
    } else {
      worldPartitionCache = null; worldPartitionQueryCache = null;
      if (scene.renderStats?.worldPartition) scene.renderStats.worldPartition = { enabled: false, cells: 0, loadedCells: 0, unloadedCells: 0, loadedObjects: 0, totalObjects: objects.length };
    }
    const renderModel=(obj, activeProgram, attrs, matrix) => {
      const position=obj.position||{x:0,y:0,z:0},rawSize=Number(obj.size??obj.radius??1),size=Math.max(.01,Math.min(100,Number.isFinite(rawSize)?rawSize:1));
      const rotation={...(obj.rotation||{})},anim=objects.find(x=>x.type==='animation'&&x.name===obj.name);if(anim)rotation.y=(Number(rotation.y)||0)+time*.0002*Number(anim.speed||1);
      const scale=obj.scale||{x:1,y:1,z:1},model=modelMatrix(position,size,rotation,scale),mvp=multiply(matrix,model),distance=Math.hypot((Number(position.x)||0)-eye[0],(Number(position.y)||0)-eye[1],(Number(position.z)||0)-eye[2]),segments=computeLodSegments(profile.segments,distance),g=mesh(obj.type,obj.type==='mesh'?obj.geometry:null,`${obj.engineId||obj.assetPath||obj.name}:v${obj.geometryRevision||0}:uv${obj.uvRevision||0}`,obj.uvs,segments,obj.flatShading===true);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.enableVertexAttribArray(attrs.position);gl.vertexAttribPointer(attrs.position,3,gl.FLOAT,false,32,0);
      if(activeProgram===program){gl.enableVertexAttribArray(attrs.normal);gl.vertexAttribPointer(attrs.normal,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(attrs.uv);gl.vertexAttribPointer(attrs.uv,2,gl.FLOAT,false,32,24);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix4fv(loc.lightMvp,false,lightVP);gl.uniform3fv(loc.color,colorRgb(obj.color));const mat=obj.material||{},hasEmissiveTint=Array.isArray(mat.emissiveTint)&&mat.emissiveTint.length>=3,tint=hasEmissiveTint?mat.emissiveTint:[1,1,1];gl.uniform3f(loc.material,Math.max(0,Math.min(1,Number(mat.metallic)||0)),Math.max(.045,Math.min(1,Number(mat.roughness??.68))),Math.max(0,Math.min(2,Number(mat.emissive)||0)));gl.uniform3f(loc.inverseScale,1/Math.max(.01,Number(scale.x)||1),1/Math.max(.01,Number(scale.y)||1),1/Math.max(.01,Number(scale.z)||1));gl.uniform1f(loc.clearcoat,Math.max(0,Math.min(1,Number(mat.clearcoat??0))));gl.uniform1f(loc.aoStrength,Math.max(0,Math.min(1,Number(mat.aoStrength??1))));gl.uniform1f(loc.normalScale,Math.max(0,Math.min(4,Number(mat.normalScale??1))));gl.uniform3f(loc.emissiveTint,...tint.slice(0,3).map(v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):1))));gl.uniform1f(loc.emissiveUsesAlbedo,typeof mat.emissiveUsesAlbedo==='boolean'?(mat.emissiveUsesAlbedo?1:0):(hasEmissiveTint?0:1));const tex=objectTexture(obj,'baseColorImage'),mrTex=objectTexture(obj,'metallicRoughnessImage'),aoTex=objectTexture(obj,'aoImage'),emissiveTex=objectTexture(obj,'emissiveImage'),normalTex=objectTexture(obj,'normalImage');gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tex||whiteTexture);gl.uniform1i(loc.baseMap,1);gl.uniform1f(loc.useBaseMap,tex?1:0);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,mrTex||whiteTexture);gl.uniform1i(loc.metalRoughMap,2);gl.uniform1f(loc.useMetalRoughMap,mrTex?1:0);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,aoTex||whiteTexture);gl.uniform1i(loc.aoMap,3);gl.uniform1f(loc.useAOMap,aoTex?1:0);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,emissiveTex||whiteTexture);gl.uniform1i(loc.emissiveMap,4);gl.uniform1f(loc.useEmissiveMap,emissiveTex?1:0);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,normalTex||whiteTexture);gl.uniform1i(loc.normalMap,5);gl.uniform1f(loc.useNormalMap,normalTex?1:0);gl.activeTexture(gl.TEXTURE0);}
      else gl.uniformMatrix4fv(shadowLoc.mvp,false,mvp);
      gl.drawArrays(gl.TRIANGLES,0,g.count);frameDrawCalls++;
    };
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
    const useShadows=shadowSupported&&settings.shadows!==false&&profile.shadows&&settings.quality!=='low';
    frameDrawCalls=0;
    const shadowSignature=[settings.shadowCasterId||'auto',shadowSize,primary.type,primary.direction.join(','),primary.range,primary.outerCone,lightPos.join(','),...drawable.map(o=>[o.engineId||o.name,o.visible!==false,(Number(o.position?.x)||0),(Number(o.position?.y)||0),(Number(o.position?.z)||0),(Number(o.rotation?.x)||0),(Number(o.rotation?.y)||0),(Number(o.rotation?.z)||0),(Number(o.scale?.x)||1),(Number(o.scale?.y)||1),(Number(o.scale?.z)||1),(Number(o.size??o.radius??1)||1),Number(o.geometryRevision)||0].join(':'))].join('|');
    const dynamicShadows=scene.simulation?.running||objects.some(o=>o.type==='animation');
    const renderShadowMap=useShadows&&(!shadowCacheValid||dynamicShadows||shadowSignature!==cachedShadowSignature);
    if(renderShadowMap){
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(shadowProgram);
      for(const obj of drawable)renderModel(obj,shadowProgram,shadowLoc,lightVP);
      cachedShadowSignature=shadowSignature;shadowCacheValid=true;
    }
    const visibleDrawable=drawable.filter(obj=>{const p=obj.position||{},sc=obj.scale||{},r=Math.max(.05,Math.abs(Number(obj.size??obj.radius??1)||1)*Math.max(Math.abs(Number(sc.x)||1),Math.abs(Number(sc.y)||1),Math.abs(Number(sc.z)||1))*(obj.type==='plane'?0.78:0.95));return sphereInCameraFrustum(p,r,eye,w/h,Math.PI/4,0.1,500,cameraTarget);});
    culledCount=Math.max(0,drawable.length-visibleDrawable.length);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(.035,.045,.07,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    const envProbe=resolveEnvironmentProbe(settings.environmentPreset||'studio');
    gl.uniform3fv(loc.envZenith,envProbe.zenith);gl.uniform3fv(loc.envHorizon,envProbe.horizon);gl.uniform3fv(loc.envGround,envProbe.ground);
    const iblProfile=resolveEnvironmentIBL(settings.environmentPreset||'studio',settings);gl.uniform1f(loc.toneMappingMode,iblProfile.toneMapping==='filmic'?2:iblProfile.toneMapping==='agx'?1:0);gl.uniform1f(loc.lumenGI,iblProfile.lumenGI?Math.max(0,Math.min(2,Number(settings.lumenGIStrength??settings.globalIlluminationStrength??1))):0);gl.uniform1f(loc.bloomStrength,iblProfile.bloom?Math.max(0,Math.min(2,Number(settings.bloomStrength??0.35))):0);gl.uniform1f(loc.bloomThreshold,Math.max(0,Math.min(3,Number(settings.bloomThreshold??1))));
    gl.uniform3fv(loc.lightPos,lightPositionData);gl.uniform3fv(loc.lightDirection,lightDirectionData);gl.uniform3fv(loc.lightColor,lightColorData);gl.uniform1fv(loc.lightType,lightTypeData);gl.uniform1fv(loc.lightRange,lightRangeData);gl.uniform1fv(loc.spotInnerCos,spotInnerCosData);gl.uniform1fv(loc.spotOuterCos,spotOuterCosData);gl.uniform1i(loc.lightCount,Math.min(lights.length||1,4));gl.uniform3f(loc.cameraPos,eye[0],eye[1],eye[2]);gl.uniform2f(loc.shadowTexel,1/shadowSize,1/shadowSize);gl.uniform1f(loc.shadowEnabled,useShadows?1:0);gl.uniform1f(loc.shadowFilter,Math.max(.5,Math.min(2.5,Number(settings.shadowSoftness??1.25))));gl.uniform1f(loc.environmentStrength,Math.max(0,Math.min(2.5,Number(settings.environmentStrength??1.0))));gl.uniform2f(loc.viewport,w,h);gl.uniform1f(loc.exposure,Math.max(.1,Math.min(3,Number(settings.exposure??1.15))));gl.uniform1f(loc.fogDensity,settings.fog?Math.max(0,Math.min(.08,Number(settings.fogDensity??.012))):0);gl.uniform3fv(loc.fogColor,colorRgb(settings.fogColor||'#7788aa'));gl.uniform1f(loc.vignette,settings.postProcessing===false?0:Math.max(0,Math.min(.6,Number(settings.vignette??.22))));
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(loc.shadowMap,0);
    for(const obj of visibleDrawable)renderModel(obj,program,loc,vp);
    if(animated&&!disposed)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return ()=>{disposed=true;clearKeys();cancelAnimationFrame(frame);resizeObserver?.disconnect();globalThis.document?.removeEventListener('visibilitychange',requestRender);globalThis.removeEventListener?.('resize',onResize);globalThis.removeEventListener?.('keydown',keyDown);globalThis.removeEventListener?.('keyup',keyUp);globalThis.removeEventListener?.('blur',clearKeys);canvas.removeEventListener('orvexa-render-settings-change',onRenderSettingsChange);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);for(const item of meshCache.values())gl.deleteBuffer(item.buffer);gl.deleteProgram(program);gl.deleteProgram(shadowProgram);gl.deleteTexture(shadowTexture);gl.deleteRenderbuffer(shadowDepth);gl.deleteFramebuffer(shadowFramebuffer);for(const item of textureCache.values())gl.deleteTexture(item.texture);gl.deleteTexture(whiteTexture);};
}

export const scene3dCapabilities = Object.freeze({renderer:'WebGL 1',pipeline:'GGX/Cook–Torrance-style direct PBR, Schlick Fresnel, hemisphere/environment specular approximation, metallic-roughness, AO and emissive texture channels, inverse-scale corrected normals, cached encoded-depth shadows with PCF, filmic tone mapping, sRGB color management, distance fog and vignette',performanceProfiles:['low','balanced','high','ultra'],environmentPresets:['studio','sunset','overcast','night','ember'],instancing:true,materialGraph:true,vfxEmitters:true,adaptiveResolution:true,fpsHud:true,backgroundTabPause:true,frustumCulling:true,distanceLOD:true,staticShadowCaching:true,demandRenderingWhenIdle:true,gpuMeshCacheLimit:96,smoothImportedMeshNormals:true,flatShadingToggle:true,worldPartition:true,worldPartitionMode:'Opt-in distance-based grid-cell streaming with always-loaded lights and dynamic bodies',maxLights:4,lightTypes:['point','directional','spot'],selectableShadowSource:true,spotLighting:'Position-relative local light vector with adjustable inner/outer cone angles',lightRange:'Bounded quartic range fade for point and spot lights',shadows:'selectable single-light shadow map; 512/1024/2048px (device-capped), with configurable PCF softness',postProcessing:['ACES tone mapping','AgX tone mapping','filmic tonemapping','Lumen GI','Bloom','fog','vignette'],toneMappingModes:['aces','agx','filmic'],toneMapping:true,lumenGI:true,globalIllumination:true,bloom:true,environmentIBL:true,naniteLOD:true,geometry:['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'],orbitControls:true,zoom:true,focusSelectedAndFrameAll:true,persistentEditorCamera:true,viewportTranslateGizmo:true,viewportTransformGizmoModes:['move','rotate','scale'],viewportRotationGizmo:true,viewportScaleGizmo:true,rotationXYZ:true,materials:['baseColor','baseColorTexture (embedded images)','metallic','roughness','metallicRoughnessTexture (glTF packed G=roughness/B=metallic)','occlusionTexture (strength control)','emissiveTexture (tinted emissive factor)','normalTexture (derivative-based tangent-space mapping and scale control)','emissive','clearcoat'],physics:'fixed-delta rigid-body integration + plane and coarse sphere collision',formatsImported:['OBJ','GLB','glTF embedded','ASCII FBX'],formatsExported:['OBJ','GLB','ASCII FBX']});


/** Parse a conservative subset of Wavefront OBJ (v + polygonal f records). No external code is executed. */
export function parseOBJ(text, name = 'Imported OBJ') {
  if (typeof text !== 'string') throw new TypeError('OBJ source must be text.');
  if (text.length > 5_000_000) throw new Error('OBJ files are limited to 5 MB.');
  const vertices = [], triangles = [];
  const lines = text.split(/\r?\n/);
  if (lines.length > 250_000) throw new Error('OBJ file contains too many lines.');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/); const kind = parts.shift();
    if (kind === 'v') {
      if (parts.length < 3) throw new Error(`OBJ line ${i + 1}: vertex needs x, y and z.`);
      const point = parts.slice(0, 3).map(Number);
      if (!point.every(Number.isFinite)) throw new Error(`OBJ line ${i + 1}: vertex coordinates must be finite numbers.`);
      vertices.push(point);
      if (vertices.length > 250_000) throw new Error('OBJ exceeds the 250,000 vertex safety limit.');
    } else if (kind === 'f') {
      if (parts.length < 3) throw new Error(`OBJ line ${i + 1}: a face needs at least three vertices.`);
      const indices = parts.map(part => {
        const raw = Number(part.split('/')[0]);
        if (!Number.isInteger(raw) || raw === 0) throw new Error(`OBJ line ${i + 1}: invalid face index.`);
        const idx = raw < 0 ? vertices.length + raw : raw - 1;
        if (idx < 0 || idx >= vertices.length) throw new Error(`OBJ line ${i + 1}: face index points to a missing vertex.`);
        return idx;
      });
      for (let j = 1; j < indices.length - 1; j++) triangles.push(vertices[indices[0]], vertices[indices[j]], vertices[indices[j + 1]]);
      if (triangles.length > 750_000) throw new Error('OBJ exceeds the triangle safety limit.');
    }
  }
  if (!vertices.length || !triangles.length) throw new Error('OBJ must contain at least one vertex and one face.');
  const flat = triangles.flat();
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const vertex of vertices) for (let axis=0; axis<3; axis++) { if(vertex[axis]<min[axis])min[axis]=vertex[axis]; if(vertex[axis]>max[axis])max[axis]=vertex[axis]; }
  const center = min.map((v, i) => (v + max[i]) / 2);
  const scale = Math.max(...min.map((v, i) => max[i] - v), 0.0001);
  const geometry = flat.map((v, i) => (v - center[i % 3]) / scale * 2);
  return { type: 'mesh', name: String(name).replace(/\.obj$/i, '').slice(0, 100) || 'Imported OBJ', position: {x:0,y:0,z:0}, size: 1, color: '#7c5cff', geometry, sourceVertexCount: vertices.length, triangleCount: triangles.length / 3 };
}

/** Export a triangulated mesh object as a valid, self-contained Wavefront OBJ string. */
export function exportOBJ(object) {
  const geometry=object?.geometry;
  if (!object || object.type !== 'mesh' || !(Array.isArray(geometry)||ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0 || !Array.from(geometry).every(Number.isFinite)) throw new Error('Select a valid imported mesh before exporting OBJ.');
  const pos = object.position || {x:0,y:0,z:0}, rotation=object.rotation||{}, scale=object.scale||{x:1,y:1,z:1}, size=Number(object.size??1)||1;
  const rx=Number(rotation.x)||0,ry=Number(rotation.y)||0,rz=Number(rotation.z)||0;
  const lines = [`# Exported by Orvexa Forge`, `o ${String(object.name || 'OrvexaMesh').replace(/[^\w.-]/g, '_')}`];
  for(let i=0;i<geometry.length;i+=3){let x=Number(geometry[i])*size*(Number(scale.x)||1),y=Number(geometry[i+1])*size*(Number(scale.y)||1),z=Number(geometry[i+2])*size*(Number(scale.z)||1);let yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);y=yy;z=zz;let xx=x*Math.cos(ry)+z*Math.sin(ry);zz=-x*Math.sin(ry)+z*Math.cos(ry);x=xx;z=zz;xx=x*Math.cos(rz)-y*Math.sin(rz);yy=x*Math.sin(rz)+y*Math.cos(rz);x=xx;y=yy;lines.push(`v ${(x+(Number(pos.x)||0)).toFixed(6)} ${(y+(Number(pos.y)||0)).toFixed(6)} ${(z+(Number(pos.z)||0)).toFixed(6)}`);}
  for(let i=1;i<=geometry.length/3;i+=3) lines.push(`f ${i} ${i+1} ${i+2}`);
  return lines.join('\n')+'\n';
}
