import { createMeshGeometry } from './scene3d.js';
import { zipSync, zipText, unzip } from './zip.js';
import { ENGINE_VERSION, countSceneStats } from './engine.js';

const VERTEX_SHADER = `attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uMvp;uniform mat4 uModel;uniform vec3 uInvScale;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;void main(){vec4 w=uModel*vec4(aPosition,1.0);gl_Position=uMvp*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*(aNormal*uInvScale));vUV=aUV;}`;
const FRAGMENT_SHADER = `precision mediump float;uniform vec3 uColor;uniform vec3 uLight;uniform vec3 uLightColor;uniform vec3 uEye;uniform vec4 uMat;uniform float uAOStrength;uniform float uNormalScale;uniform vec3 uEmissiveTint;uniform float uEmissiveUsesAlbedo;uniform float uEnvironmentStrength;uniform sampler2D uBaseMap;uniform float uUseBaseMap;uniform sampler2D uMetalRoughMap;uniform float uUseMetalRoughMap;uniform sampler2D uAOMap;uniform float uUseAOMap;uniform sampler2D uEmissiveMap;uniform float uUseEmissiveMap;uniform sampler2D uNormalMap;uniform float uUseNormalMap;uniform float uExposure;uniform float uFogDensity;uniform vec3 uFogColor;uniform float uVignette;uniform vec2 uResolution;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUV;const float PI=3.14159265359;float Dggx(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,nh=max(dot(n,h),0.0),d=nh*nh*(a2-1.0)+1.0;return a2/max(PI*d*d,0.0001);}float G1(float nv,float r){float k=(r+1.0)*(r+1.0)/8.0;return nv/max(nv*(1.0-k)+k,0.0001);}vec3 Fschlick(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-clamp(c,0.0,1.0),5.0);}vec3 sky(vec3 d){float t=clamp(d.y*.5+.5,0.0,1.0);return d.y>=0.0?mix(vec3(.28,.31,.37),vec3(.08,.22,.46),t):mix(vec3(.055,.048,.04),vec3(.28,.31,.37),clamp(d.y+1.0,0.0,1.0));}void main(){vec3 tex=pow(max(texture2D(uBaseMap,vUV).rgb,vec3(0.0)),vec3(2.2));vec3 albedo=uColor*mix(vec3(1.0),tex,clamp(uUseBaseMap,0.0,1.0));vec3 n=normalize(vNormal);vec3 l=normalize(uLight-vWorld),v=normalize(uEye-vWorld),h=normalize(l+v);vec4 mrSample=texture2D(uMetalRoughMap,vUV);float ao=mix(1.0,texture2D(uAOMap,vUV).r,uUseAOMap*clamp(uAOStrength,0.0,1.0));float r=clamp(uMat.y*mix(1.0,mrSample.g,uUseMetalRoughMap),.045,1.0),m=clamp(uMat.x*mix(1.0,mrSample.b,uUseMetalRoughMap),0.0,1.0),ndl=max(dot(n,l),0.0),ndv=max(dot(n,v),.001);vec3 f0=mix(vec3(.04),albedo,m),f=Fschlick(max(dot(h,v),0.0),f0);float d=Dggx(n,h,r),g=G1(ndv,r)*G1(max(dot(n,l),0.0),r);vec3 spec=d*g*f/max(4.0*ndv*max(dot(n,l),0.0),.001);vec3 diffuse=(vec3(1.0)-f)*(1.0-m)*albedo/PI;float att=1.0/(1.0+.035*length(uLight-vWorld)*length(uLight-vWorld));float coatD=Dggx(n,h,.12),coatG=G1(ndv,.12)*G1(max(dot(n,l),0.0),.12);vec3 coat=coatD*coatG*Fschlick(max(dot(h,v),0.0),vec3(.04))*clamp(uMat.w,0.0,1.0)/max(4.0*ndv*max(dot(n,l),0.0),.001)*.25;vec3 hemi=mix(vec3(.055,.048,.04),vec3(.22,.27,.34),clamp(n.y*.5+.5,0.0,1.0));vec3 env=mix(sky(reflect(-v,n)),vec3(.16,.19,.23),r*r);vec3 emissionBase=mix(uEmissiveTint,albedo*uEmissiveTint,uEmissiveUsesAlbedo);vec3 emissiveTexture=pow(max(texture2D(uEmissiveMap,vUV).rgb,vec3(0.0)),vec3(2.2))*uEmissiveTint;vec3 emissionColor=mix(emissionBase,emissiveTexture,uUseEmissiveMap);vec3 c=albedo*hemi*(1.0-m)*uEnvironmentStrength*ao+env*Fschlick(ndv,f0)*(1.0-.42*r)*uEnvironmentStrength*ao+(diffuse+spec+coat)*uLightColor*ndl*att+emissionColor*uMat.z;float fog=1.0-exp(-length(uEye-vWorld)*max(0.0,uFogDensity));c=mix(c,uFogColor,clamp(fog,0.0,1.0));c*=max(0.0,1.0-uVignette*clamp(length((gl_FragCoord.xy/uResolution-.5)*1.65),0.0,1.0));c=max(vec3(0.0),c*max(.1,uExposure));c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0);c=pow(max(c,vec3(0.0)),vec3(.454545));gl_FragColor=vec4(c,1.0);}`;

const RUNTIME = String.raw`(function(){
'use strict';
var canvas=document.getElementById('game'),gl=null,scene=ORVEXA_SCENE;
var status=document.getElementById('status'),playButton=document.getElementById('play'),resetButton=document.getElementById('reset');
var playing=false,keys=new Set(),buffers=new Map(),textureCache=new Map(),whiteTexture=null,angle=0,pitch=0,zoom=7,drag=false,lastX=0,lastY=0,lastTime=0,frame=0,adaptiveScale=1,frameAverage=16.7,perfCount=0;
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
var camera=(scene.objects||[]).find(function(o){return o.type==='camera';}),cp=(camera&&camera.position)||{x:0,y:2,z:7};
angle=Math.atan2(Number(cp.x)||0,Number(cp.z)||7);zoom=clamp(Math.hypot(Number(cp.x)||0,Number(cp.y)||2,Number(cp.z)||7),2.5,24);pitch=Math.atan2(Number(cp.y)||2,Math.hypot(Number(cp.x)||0,Number(cp.z)||7));
var baseline=scene.objects.map(function(o){return {id:o.engineId||o.name,position:Object.assign({},o.position||{x:0,y:0,z:0}),rotation:Object.assign({},o.rotation||{x:0,y:0,z:0}),velocity:Object.assign({},(o.rigidBody&&o.rigidBody.velocity)||{x:0,y:0,z:0}),angularVelocity:Object.assign({},(o.rigidBody&&o.rigidBody.angularVelocity)||{x:0,y:0,z:0})};});
function identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a,b){var o=new Float32Array(16);for(var c=0;c<4;c++)for(var r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function perspective(f,aspect,near,far){var q=1/Math.tan(f/2),nf=1/(near-far),o=new Float32Array(16);o[0]=q/aspect;o[5]=q;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;}
function lookAt(e,c,u){var norm=function(v){var l=Math.hypot(v[0],v[1],v[2])||1;return v.map(function(x){return x/l;});},sub=function(a,b){return a.map(function(x,i){return x-b[i];});},cross=function(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};var z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce(function(s,v,i){return s+v*e[i];},0),-y.reduce(function(s,v,i){return s+v*e[i];},0),-z.reduce(function(s,v,i){return s+v*e[i];},0),1]);}
function modelMatrix(o,time){var p=o.position||{x:0,y:0,z:0},r=Object.assign({},o.rotation||{}),s=o.scale||{x:1,y:1,z:1};var animation=(scene.objects||[]).find(function(a){return a.type==='animation'&&a.name===o.name;});if(animation)r.y=(Number(r.y)||0)+time*.0002*Number(animation.speed||1);var x=Number(r.x)||0,y=Number(r.y)||0,z=Number(r.z)||0,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);var S=new Float32Array([(Number(s.x)||1)*(Number(o.size??1)||1),0,0,0,0,(Number(s.y)||1)*(Number(o.size??1)||1),0,0,0,0,(Number(s.z)||1)*(Number(o.size??1)||1),0,0,0,0,1]);var X=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]),Y=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]),Z=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]),T=identity();T[12]=Number(p.x)||0;T[13]=Number(p.y)||0;T[14]=Number(p.z)||0;return mul(mul(mul(mul(T,Z),Y),X),S);}
function color(v){var m=String(v||'#7c5cff').match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);if(!m)return [0.49,0.36,1].map(function(c){return Math.pow(c,2.2);});var h=m[1];if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');return [0,2,4].map(function(i){var c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});}
function normalMappedFragmentSource(source){if(!gl.getExtension('OES_standard_derivatives'))return source;var helper='vec3 applyNormalMap(vec3 n,vec3 worldPos,vec2 uv){vec3 dp1=dFdx(worldPos),dp2=dFdy(worldPos);vec2 duv1=dFdx(uv),duv2=dFdy(uv);float det=duv1.x*duv2.y-duv1.y*duv2.x;if(abs(det)<0.00001)return n;vec3 t=normalize((dp1*duv2.y-dp2*duv1.y)/det);vec3 b=normalize((-dp1*duv2.x+dp2*duv1.x)/det);t=normalize(t-n*dot(n,t));b=normalize(b-n*dot(n,b)-t*dot(t,b));vec3 sampled=texture2D(uNormalMap,uv).xyz*2.0-1.0;sampled.xy*=clamp(uNormalScale,0.0,4.0);return normalize(mat3(t,b,n)*sampled);}';return source.replace('precision mediump float;','#extension GL_OES_standard_derivatives : enable\nprecision mediump float;').replace('void main(){',helper+'\nvoid main(){').replace('vec3 n=normalize(vNormal);','vec3 n=normalize(vNormal);if(uUseNormalMap>0.5)n=applyNormalMap(n,vWorld,vUV);');}
function shader(type,source){var s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compile failed');return s;}
function interleave(g,uvs){var out=new Float32Array((g.length/3)*8);for(var i=0;i<g.length;i+=9){var ax=g[i],ay=g[i+1],az=g[i+2],bx=g[i+3],by=g[i+4],bz=g[i+5],cx=g[i+6],cy=g[i+7],cz=g[i+8],ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;var points=[[ax,ay,az],[bx,by,bz],[cx,cy,cz]],uAxis=Math.abs(nx)>=Math.abs(ny)&&Math.abs(nx)>=Math.abs(nz)?2:Math.abs(ny)>=Math.abs(nx)&&Math.abs(ny)>=Math.abs(nz)?0:0,vAxis=Math.abs(nx)>=Math.abs(ny)&&Math.abs(nx)>=Math.abs(nz)?1:Math.abs(ny)>=Math.abs(nx)&&Math.abs(ny)>=Math.abs(nz)?2:1;var minU=Math.min(points[0][uAxis],points[1][uAxis],points[2][uAxis]),maxU=Math.max(points[0][uAxis],points[1][uAxis],points[2][uAxis]),minV=Math.min(points[0][vAxis],points[1][vAxis],points[2][vAxis]),maxV=Math.max(points[0][vAxis],points[1][vAxis],points[2][vAxis]);for(var j=0;j<3;j++){var k=i+j*3,o=(i/3+j)*8;out[o]=g[k];out[o+1]=g[k+1];out[o+2]=g[k+2];out[o+3]=nx;out[o+4]=ny;out[o+5]=nz;if(uvs&&uvs.length===g.length/3*2){out[o+6]=Number(uvs[(i/3+j)*2])||0;out[o+7]=Number(uvs[(i/3+j)*2+1])||0;}else{out[o+6]=(points[j][uAxis]-minU)/Math.max(1e-6,maxU-minU);out[o+7]=(points[j][vAxis]-minV)/Math.max(1e-6,maxV-minV);}}}return out;}
function buildMesh(o){var geometry=o.geometry;if(!geometry||!geometry.length)throw new Error('Entity '+o.name+' has no geometry.');var b=gl.createBuffer(),data=interleave(geometry,o.uvs);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return {buffer:b,count:geometry.length/3};}
function textureFor(o,channel){var source=o.material&&o.material[channel||'baseColorImage'];if(typeof source!=='string'||source.indexOf('data:image/')!==0)return null;var id=o.engineId||o.name,key=String(id)+'::'+String(channel||'baseColorImage'),old=textureCache.get(key);if(old&&old.source===source)return old.ready?old.texture:null;if(old)gl.deleteTexture(old.texture);var texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);var record={source:source,texture:texture,ready:false};textureCache.set(key,record);var image=new Image();image.onload=function(){gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);record.ready=true;};image.onerror=function(){record.ready=false;};image.src=source;return null;}
function setup(){gl=canvas.getContext('webgl',{antialias:true,alpha:false});if(!gl){status.textContent='This browser does not support WebGL.';return false;}var program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,ORVEXA_VERTEX_SHADER));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,normalMappedFragmentSource(ORVEXA_FRAGMENT_SHADER)));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed');gl.program=program;gl.loc={p:gl.getAttribLocation(program,'aPosition'),n:gl.getAttribLocation(program,'aNormal'),uv:gl.getAttribLocation(program,'aUV'),mvp:gl.getUniformLocation(program,'uMvp'),model:gl.getUniformLocation(program,'uModel'),color:gl.getUniformLocation(program,'uColor'),light:gl.getUniformLocation(program,'uLight'),lightColor:gl.getUniformLocation(program,'uLightColor'),eye:gl.getUniformLocation(program,'uEye'),mat:gl.getUniformLocation(program,'uMat'),aoStrength:gl.getUniformLocation(program,'uAOStrength'),normalScale:gl.getUniformLocation(program,'uNormalScale'),emissiveTint:gl.getUniformLocation(program,'uEmissiveTint'),emissiveUsesAlbedo:gl.getUniformLocation(program,'uEmissiveUsesAlbedo'),invScale:gl.getUniformLocation(program,'uInvScale'),environmentStrength:gl.getUniformLocation(program,'uEnvironmentStrength'),baseMap:gl.getUniformLocation(program,'uBaseMap'),useBaseMap:gl.getUniformLocation(program,'uUseBaseMap'),metalRoughMap:gl.getUniformLocation(program,'uMetalRoughMap'),useMetalRoughMap:gl.getUniformLocation(program,'uUseMetalRoughMap'),aoMap:gl.getUniformLocation(program,'uAOMap'),useAOMap:gl.getUniformLocation(program,'uUseAOMap'),emissiveMap:gl.getUniformLocation(program,'uEmissiveMap'),useEmissiveMap:gl.getUniformLocation(program,'uUseEmissiveMap'),normalMap:gl.getUniformLocation(program,'uNormalMap'),useNormalMap:gl.getUniformLocation(program,'uUseNormalMap'),exposure:gl.getUniformLocation(program,'uExposure'),fogDensity:gl.getUniformLocation(program,'uFogDensity'),fogColor:gl.getUniformLocation(program,'uFogColor'),vignette:gl.getUniformLocation(program,'uVignette'),resolution:gl.getUniformLocation(program,'uResolution')};whiteTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);(scene.objects||[]).filter(function(o){return ['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'].includes(o.type);}).forEach(function(o){buffers.set(o.engineId||o.name,buildMesh(o));});return true;}
function radius(o){return Math.max(.025,.5*(Number(o.size??o.radius??1)||1)*Math.max(Math.abs(Number(o.scale&&o.scale.x)||1),Math.abs(Number(o.scale&&o.scale.y)||1),Math.abs(Number(o.scale&&o.scale.z)||1)));}
function visibleSphere(o,eye,aspect){var p=o.position||{x:0,y:0,z:0},rel=[(Number(p.x)||0)-eye[0],(Number(p.y)||0)-eye[1],(Number(p.z)||0)-eye[2]],norm=function(v){var q=Math.hypot(v[0],v[1],v[2])||1;return v.map(function(n){return n/q;});},dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];},cross=function(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];},f=norm([-eye[0],-eye[1],-eye[2]]),right=norm(cross(f,[0,1,0])),up=cross(right,f),depth=dot(rel,f),r=radius(o)*1.9,t=Math.tan(Math.PI/8);return !(depth+r<.1||depth-r>500)&&Math.abs(dot(rel,right))<=Math.max(.1,depth)*t*aspect+r&&Math.abs(dot(rel,up))<=Math.max(.1,depth)*t+r;}
function stepPhysics(dt){var objects=scene.objects||[],floors=objects.filter(function(o){return o.type==='plane'&&o.visible!==false;}),shapes=objects.filter(function(o){return o.visible!==false&&['cube','sphere','cylinder','torus','cone','pyramid','capsule','mesh'].includes(o.type);});objects.forEach(function(o){var b=o.rigidBody;if(!b||b.enabled===false||b.bodyType==='static'||b.bodyType==='kinematic'||o.visible===false)return;b.velocity=b.velocity||{x:0,y:0,z:0};b.angularVelocity=b.angularVelocity||{x:0,y:0,z:0};o.position=o.position||{x:0,y:0,z:0};o.rotation=o.rotation||{x:0,y:0,z:0};if(b.useGravity!==false)b.velocity.y-=clamp(Number(scene.gravity??9.81),0,100)*dt;var damp=Math.exp(-clamp(Number(b.linearDamping??.05),0,20)*dt),adamp=Math.exp(-clamp(Number(b.angularDamping??.08),0,20)*dt);['x','y','z'].forEach(function(axis){b.velocity[axis]=(Number(b.velocity[axis])||0)*damp;b.angularVelocity[axis]=(Number(b.angularVelocity[axis])||0)*adamp;o.rotation[axis]+=(Number(b.angularVelocity[axis])||0)*dt;});o.position.x+=(Number(b.velocity.x)||0)*dt;o.position.y+=(Number(b.velocity.y)||0)*dt;o.position.z+=(Number(b.velocity.z)||0)*dt;floors.forEach(function(f){if(f===o)return;var fp=f.position||{x:0,y:0,z:0},w=Math.abs(Number(f.size)||1)*Math.abs(Number(f.scale&&f.scale.x)||1),d=Math.abs(Number(f.size)||1)*Math.abs(Number(f.scale&&f.scale.z)||1),r=radius(o);if(Math.abs(o.position.x-fp.x)<=w/2+r*.35&&Math.abs(o.position.z-fp.z)<=d/2+r*.35&&o.position.y-r<fp.y+.001&&b.velocity.y<=0){o.position.y=fp.y+r;b.velocity.y=Math.abs(b.velocity.y)<.65?0:-b.velocity.y*clamp(Number(b.restitution??.12),0,1);b.velocity.x*=Math.max(0,1-clamp(Number(b.friction??.7),0,1)*dt*4);b.velocity.z*=Math.max(0,1-clamp(Number(b.friction??.7),0,1)*dt*4);}});});shapes.forEach(function(a,i){var ba=a.rigidBody;if(!ba||ba.enabled===false||ba.bodyType!=='dynamic')return;for(var j=i+1;j<shapes.length;j++){var b=shapes[j],bb=b.rigidBody;if(!bb||bb.enabled===false||bb.bodyType!=='dynamic')continue;var dx=(Number(a.position.x)||0)-(Number(b.position.x)||0),dy=(Number(a.position.y)||0)-(Number(b.position.y)||0),dz=(Number(a.position.z)||0)-(Number(b.position.z)||0),d2=dx*dx+dy*dy+dz*dz,dist=radius(a)+radius(b);if(d2>=dist*dist||d2<1e-9)continue;var d=Math.sqrt(d2),nx=dx/d,ny=dy/d,nz=dz/d,ia=1/clamp(Number(ba.mass)||1,.01,100000),ib=1/clamp(Number(bb.mass)||1,.01,100000),sum=ia+ib,overlap=dist-d;a.position.x+=nx*overlap*ia/sum;a.position.y+=ny*overlap*ia/sum;a.position.z+=nz*overlap*ia/sum;b.position.x-=nx*overlap*ib/sum;b.position.y-=ny*overlap*ib/sum;b.position.z-=nz*overlap*ib/sum;var rv=((Number(ba.velocity.x)||0)-(Number(bb.velocity.x)||0))*nx+((Number(ba.velocity.y)||0)-(Number(bb.velocity.y)||0))*ny+((Number(ba.velocity.z)||0)-(Number(bb.velocity.z)||0))*nz;if(rv<0){var e=Math.min(clamp(Number(ba.restitution)||0,0,1),clamp(Number(bb.restitution)||0,0,1)),imp=-(1+e)*rv/sum;[['x',nx],['y',ny],['z',nz]].forEach(function(pair){ba.velocity[pair[0]]=(Number(ba.velocity[pair[0]])||0)+imp*ia*pair[1];bb.velocity[pair[0]]=(Number(bb.velocity[pair[0]])||0)-imp*ib*pair[1];});}}});}
function stepControllers(dt){(scene.objects||[]).forEach(function(o){var c=o.controller;if(!c||o.visible===false)return;o.position=o.position||{x:0,y:0,z:0};var x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),l=Math.hypot(x,z)||1,s=clamp(Number(c.speed??3),0,100);o.position.x+=x/l*s*dt;o.position.z+=z/l*s*dt;var jump=keys.has(' ')||keys.has('space');if(jump&&!c.__jumpHeld&&o.rigidBody&&o.rigidBody.enabled){var fy=(scene.objects||[]).filter(function(f){return f.type==='plane';}).reduce(function(a,f){return Math.max(a,Number(f.position&&f.position.y)||-999);},-999);if(o.position.y<=fy+radius(o)+.12)o.rigidBody.velocity.y=clamp(Number(c.jumpSpeed??5),0,50);}c.__jumpHeld=jump;});}
function render(time){frame=requestAnimationFrame(render);var frameMs=lastTime?Math.max(0,Math.min(100,time-lastTime)):16.7,dt=Math.min(.05,frameMs/1000);lastTime=time;var settings=scene.renderSettings||{};frameAverage=frameAverage*.9+frameMs*.1;if(++perfCount%24===0&&settings.adaptiveResolution!==false){if(frameAverage>24)adaptiveScale=Math.max(.45,Math.round((adaptiveScale-.06)*100)/100);else if(frameAverage<15)adaptiveScale=Math.min(1,Math.round((adaptiveScale+.025)*100)/100);}if(playing){stepControllers(dt);stepPhysics(dt);}var mode=settings.performanceMode||'balanced',maxDpr=mode==='low'?.78:mode==='balanced'?1:mode==='high'?1.25:1.5,dpr=Math.max(.4,Math.min(window.devicePixelRatio||1,maxDpr)*adaptiveScale),w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.055,.055,.095,1);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(gl.program);var eye=[Math.sin(angle)*zoom,Math.sin(pitch)*zoom,Math.cos(angle)*zoom],view=lookAt(eye,[0,0,0],[0,1,0]),vp=mul(perspective(Math.PI/4,w/h,.1,500),view),light=(scene.objects||[]).find(function(o){return o.type==='light';})||{position:{x:3,y:5,z:4},color:'#ffffff'},lp=light.position||{x:3,y:5,z:4};gl.uniform3f(gl.loc.light,Number(lp.x)||3,Number(lp.y)||5,Number(lp.z)||4);gl.uniform3fv(gl.loc.lightColor,color(light.color));gl.uniform3f(gl.loc.eye,eye[0],eye[1],eye[2]);gl.uniform1f(gl.loc.environmentStrength,clamp(Number(settings.environmentStrength??1),0,2.5));gl.uniform1f(gl.loc.exposure,clamp(Number(settings.exposure??1.15),.1,3));gl.uniform1f(gl.loc.fogDensity,settings.fog?clamp(Number(settings.fogDensity??.012),0,.08):0);gl.uniform3fv(gl.loc.fogColor,color(settings.fogColor||'#7788aa'));gl.uniform1f(gl.loc.vignette,settings.postProcessing===false?0:clamp(Number(settings.vignette??.22),0,.6));gl.uniform2f(gl.loc.resolution,w,h);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.uniform1i(gl.loc.baseMap,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.uniform1i(gl.loc.metalRoughMap,2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.uniform1i(gl.loc.aoMap,3);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.uniform1i(gl.loc.emissiveMap,4);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.uniform1i(gl.loc.normalMap,5);gl.activeTexture(gl.TEXTURE0);(scene.objects||[]).forEach(function(o){if(o.visible===false||!buffers.has(o.engineId||o.name)||!visibleSphere(o,eye,w/h))return;var m=modelMatrix(o,time),mvp=mul(vp,m),b=buffers.get(o.engineId||o.name),mat=o.material||{},texture=textureFor(o,'baseColorImage'),mrTexture=textureFor(o,'metallicRoughnessImage'),aoTexture=textureFor(o,'aoImage'),emissiveTexture=textureFor(o,'emissiveImage'),normalTexture=textureFor(o,'normalImage'),sc=o.scale||{x:1,y:1,z:1};gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.enableVertexAttribArray(gl.loc.p);gl.enableVertexAttribArray(gl.loc.n);gl.enableVertexAttribArray(gl.loc.uv);gl.vertexAttribPointer(gl.loc.p,3,gl.FLOAT,false,32,0);gl.vertexAttribPointer(gl.loc.n,3,gl.FLOAT,false,32,12);gl.vertexAttribPointer(gl.loc.uv,2,gl.FLOAT,false,32,24);gl.uniformMatrix4fv(gl.loc.mvp,false,mvp);gl.uniformMatrix4fv(gl.loc.model,false,m);gl.uniform3fv(gl.loc.color,color(o.color));gl.uniform4f(gl.loc.mat,clamp(Number(mat.metallic)||0,0,1),clamp(Number(mat.roughness??.68),.045,1),clamp(Number(mat.emissive)||0,0,2),clamp(Number(mat.clearcoat)||0,0,1));gl.uniform1f(gl.loc.aoStrength,clamp(Number(mat.aoStrength??1),0,1));gl.uniform1f(gl.loc.normalScale,clamp(Number(mat.normalScale??1),0,4));var hasEmissiveTint=Array.isArray(mat.emissiveTint)&&mat.emissiveTint.length>=3,tint=hasEmissiveTint?mat.emissiveTint:[1,1,1],usesAlbedo=typeof mat.emissiveUsesAlbedo==='boolean'?mat.emissiveUsesAlbedo:!hasEmissiveTint;gl.uniform3f(gl.loc.emissiveTint,clamp(Number(tint[0]??1),0,1),clamp(Number(tint[1]??1),0,1),clamp(Number(tint[2]??1),0,1));gl.uniform1f(gl.loc.emissiveUsesAlbedo,usesAlbedo?1:0);gl.uniform3f(gl.loc.invScale,1/Math.max(.01,Number(sc.x)||1),1/Math.max(.01,Number(sc.y)||1),1/Math.max(.01,Number(sc.z)||1));gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture||whiteTexture);gl.uniform1f(gl.loc.useBaseMap,texture?1:0);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,mrTexture||whiteTexture);gl.uniform1f(gl.loc.useMetalRoughMap,mrTexture?1:0);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,aoTexture||whiteTexture);gl.uniform1f(gl.loc.useAOMap,aoTexture?1:0);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,emissiveTexture||whiteTexture);gl.uniform1f(gl.loc.useEmissiveMap,emissiveTexture?1:0);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,normalTexture||whiteTexture);gl.uniform1f(gl.loc.useNormalMap,normalTexture?1:0);gl.activeTexture(gl.TEXTURE0);gl.drawArrays(gl.TRIANGLES,0,b.count);});}
function setPlaying(v){playing=!!v;playButton.textContent=playing?'Ⅱ Pause':'▶ Play';status.textContent=playing?'RUNNING · WASD / ARROWS MOVE · SPACE JUMP':'PAUSED · press Play to run the scene';if(!playing)keys.clear();}
function reset(){scene.objects.forEach(function(o){var b=baseline.find(function(x){return x.id===(o.engineId||o.name);});if(!b)return;o.position=Object.assign({},b.position);o.rotation=Object.assign({},b.rotation);if(o.rigidBody){o.rigidBody.velocity=Object.assign({},b.velocity);o.rigidBody.angularVelocity=Object.assign({},b.angularVelocity);}if(o.controller)o.controller.__jumpHeld=false;});setPlaying(false);}
var movement=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','space']);document.querySelectorAll('[data-key]').forEach(function(button){var key=button.dataset.key,down=function(e){e.preventDefault();keys.add(key);button.classList.add('pressed');button.setPointerCapture&&button.setPointerCapture(e.pointerId);},up=function(e){e.preventDefault();keys.delete(key);button.classList.remove('pressed');};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);button.addEventListener('contextmenu',function(e){e.preventDefault();});});window.addEventListener('keydown',function(e){var k=String(e.key).toLowerCase();if(movement.has(k)){keys.add(k);if(k.startsWith('arrow')||k===' ')e.preventDefault();}});window.addEventListener('keyup',function(e){keys.delete(String(e.key).toLowerCase());});window.addEventListener('blur',function(){keys.clear();});
canvas.addEventListener('pointerdown',function(e){drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',function(e){if(!drag)return;angle+=(e.clientX-lastX)*.009;pitch=clamp(pitch+(e.clientY-lastY)*.008,-1.15,1.15);lastX=e.clientX;lastY=e.clientY;});canvas.addEventListener('pointerup',function(){drag=false;});canvas.addEventListener('pointercancel',function(){drag=false;});canvas.addEventListener('wheel',function(e){e.preventDefault();zoom=clamp(zoom+e.deltaY*.008,2.5,24);},{passive:false});playButton.addEventListener('click',function(){setPlaying(!playing);});resetButton.addEventListener('click',reset);
try{if(setup()){setPlaying(false);frame=requestAnimationFrame(render);}}catch(e){status.textContent='Could not start game: '+e.message;}
})();`;

function safeObject(object) {
  const out = {
    engineId: object.engineId || object.name,
    type: object.type,
    name: String(object.name || object.type || 'Entity').slice(0, 100),
    position: { x: Number(object.position?.x) || 0, y: Number(object.position?.y) || 0, z: Number(object.position?.z) || 0 },
    rotation: { x: Number(object.rotation?.x) || 0, y: Number(object.rotation?.y) || 0, z: Number(object.rotation?.z) || 0 },
    scale: { x: Number(object.scale?.x) || 1, y: Number(object.scale?.y) || 1, z: Number(object.scale?.z) || 1 },
    size: Number(object.size ?? object.radius ?? 1) || 1,
    color: String(object.color || '#7c5cff'),
    visible: object.visible !== false,
    material: { metallic: Number(object.material?.metallic) || 0, roughness: Number(object.material?.roughness ?? 0.68), emissive: Number(object.material?.emissive) || 0, clearcoat: Number(object.material?.clearcoat) || 0, aoStrength: Number(object.material?.aoStrength ?? 1), normalScale: Number(object.material?.normalScale ?? 1), emissiveUsesAlbedo: !(Array.isArray(object.material?.emissiveTint) && object.material.emissiveTint.length >= 3), emissiveTint: Array.isArray(object.material?.emissiveTint) && object.material.emissiveTint.length >= 3 ? object.material.emissiveTint.slice(0, 3).map(v => Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : 1) : [1,1,1], ...(typeof object.material?.baseColorImage === 'string' ? { baseColorImage: object.material.baseColorImage } : {}), ...(typeof object.material?.metallicRoughnessImage === 'string' ? { metallicRoughnessImage: object.material.metallicRoughnessImage } : {}), ...(typeof object.material?.aoImage === 'string' ? { aoImage: object.material.aoImage } : {}), ...(typeof object.material?.emissiveImage === 'string' ? { emissiveImage: object.material.emissiveImage } : {}), ...(typeof object.material?.normalImage === 'string' ? { normalImage: object.material.normalImage } : {}) },
  };
  if (object.rigidBody) out.rigidBody = { enabled: object.rigidBody.enabled !== false, bodyType: object.rigidBody.bodyType || 'dynamic', mass: Number(object.rigidBody.mass) || 1, restitution: Number(object.rigidBody.restitution) || 0, friction: Number(object.rigidBody.friction) || 0.7, useGravity: object.rigidBody.useGravity !== false, linearDamping: Number(object.rigidBody.linearDamping ?? 0.05), angularDamping: Number(object.rigidBody.angularDamping ?? 0.08), velocity: { x: Number(object.rigidBody.velocity?.x) || 0, y: Number(object.rigidBody.velocity?.y) || 0, z: Number(object.rigidBody.velocity?.z) || 0 }, angularVelocity: { x: Number(object.rigidBody.angularVelocity?.x) || 0, y: Number(object.rigidBody.angularVelocity?.y) || 0, z: Number(object.rigidBody.angularVelocity?.z) || 0 } };
  if (object.controller) out.controller = { speed: Number(object.controller.speed) || 3, jumpSpeed: Number(object.controller.jumpSpeed) || 5 };
  if (object.uvs && (Array.isArray(object.uvs) || ArrayBuffer.isView(object.uvs)) && object.uvs.length <= 500_000) out.uvs = Array.from(object.uvs);
  if (object.geometry && (Array.isArray(object.geometry) || ArrayBuffer.isView(object.geometry))) out.geometry = Array.from(object.geometry);
  return out;
}

export function buildStandaloneGame(scene, title = 'Orvexa Game') {
  if (!scene || !Array.isArray(scene.objects)) throw new Error('Choose a 3D scene before building the game.');
  const objects = scene.objects.filter(o => ['camera', 'light', 'animation', 'cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule', 'mesh'].includes(o.type)).map(object => {
    const out = safeObject(object);
    if (!['camera', 'light', 'animation'].includes(out.type) && (!out.geometry || !out.geometry.length)) { const segments = ({low:8,balanced:12,high:18,ultra:24})[scene.renderSettings?.performanceMode] || 16; out.geometry = Array.from(createMeshGeometry(out.type, segments)); }
    return out;
  });
  const payload = { engine: 'Orvexa Forge', engineVersion: ENGINE_VERSION, scene: String(scene.name || title).slice(0, 100), gravity: Number(scene.simulation?.gravity ?? 9.81), renderSettings: { exposure: Number(scene.renderSettings?.exposure ?? 1.15), postProcessing: scene.renderSettings?.postProcessing !== false, fog: scene.renderSettings?.fog === true, fogDensity: Number(scene.renderSettings?.fogDensity ?? 0.012), fogColor: String(scene.renderSettings?.fogColor || '#7788aa'), vignette: Number(scene.renderSettings?.vignette ?? 0.22), environmentStrength: Math.max(0, Math.min(2.5, Number(scene.renderSettings?.environmentStrength ?? 1))), performanceMode: ['low','balanced','high','ultra'].includes(scene.renderSettings?.performanceMode) ? scene.renderSettings.performanceMode : 'balanced', adaptiveResolution: scene.renderSettings?.adaptiveResolution !== false }, objects };
  const json = JSON.stringify(payload);
  if (new TextEncoder().encode(json).length > 18_000_000) throw new Error('This game scene is larger than the standalone export limit (18 MB). Remove some high-detail meshes and try again.');
  const embedded = json.replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#101019"><title>${String(title).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101019;color:#f4f0ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}#game{display:block;width:100%;height:100%;touch-action:none;outline:none}.hud{position:fixed;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(12px,3vw,24px);background:linear-gradient(#080810a8,transparent 22%,transparent 72%,#080810a0)}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.title{font-size:clamp(15px,3vw,22px);font-weight:800;letter-spacing:-.04em}.sub{margin-top:4px;font-size:10px;color:#bbb4d4;letter-spacing:.08em}.status{color:#cfc7ff;font:10px ui-monospace,monospace;text-align:right;max-width:50vw}.bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}.help{font-size:11px;line-height:1.8;color:#d3cdeb}.actions{display:flex;gap:8px;pointer-events:auto}.actions button{border:1px solid #514773;border-radius:10px;padding:10px 14px;background:#24203b;color:#fff;font:700 11px system-ui;cursor:pointer}.actions button:first-child{background:#785cf6;border-color:#9b88ff}.actions button:active{transform:translateY(1px)}@media(max-width:560px){.hud{padding:12px}.bottom{align-items:flex-start}.help{max-width:62%}.actions button{padding:9px 10px}}.touch-controls{display:none;position:fixed;left:14px;bottom:92px;z-index:5;pointer-events:auto;touch-action:none;user-select:none}.touch-pad{display:grid;grid-template-columns:repeat(3,42px);grid-template-rows:repeat(2,42px);gap:5px}.touch-controls button{border:1px solid #8275b9;border-radius:12px;background:#24203bcc;color:#fff;font:700 17px system-ui;box-shadow:0 5px 18px #0006;touch-action:none;user-select:none}.touch-controls button:active,.touch-controls button.pressed{background:#785cf6}.touch-up{grid-column:2}.touch-left{grid-column:1;grid-row:2}.touch-down{grid-column:2;grid-row:2}.touch-right{grid-column:3;grid-row:2}.touch-jump{position:fixed;right:16px;bottom:106px;width:66px;height:66px;border-radius:50%!important;font-size:12px!important;letter-spacing:.04em}@media(pointer:coarse),(max-width:700px){.touch-controls{display:block}}
</style></head><body><canvas id="game" aria-label="Playable Orvexa Forge 3D game"></canvas><div class="touch-controls" aria-label="Touch movement controls"><div class="touch-pad"><button class="touch-up" data-key="w" aria-label="Move forward">▲</button><button class="touch-left" data-key="a" aria-label="Move left">◀</button><button class="touch-down" data-key="s" aria-label="Move backward">▼</button><button class="touch-right" data-key="d" aria-label="Move right">▶</button></div><button class="touch-jump" data-key="space" aria-label="Jump">JUMP</button></div><div class="hud"><div class="top"><div><div class="title">${String(title).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div><div class="sub">ORVEXA FORGE · STANDALONE GAME</div></div><div class="status" id="status">Loading engine…</div></div><div class="bottom"><div class="help">W A S D / ARROW KEYS · MOVE PLAYER<br>SPACE · JUMP WHEN GROUNDED<br>DRAG · ORBIT CAMERA &nbsp; SCROLL · ZOOM</div><div class="actions"><button id="play">▶ Play</button><button id="reset">↺ Reset</button></div></div></div><script>const ORVEXA_SCENE=${embedded};const ORVEXA_VERTEX_SHADER=${JSON.stringify(VERTEX_SHADER)};const ORVEXA_FRAGMENT_SHADER=${JSON.stringify(FRAGMENT_SHADER)};${RUNTIME}</script></body></html>`;
  const stats = countSceneStats({ objects });
  const readme = `${title}\n\nBuilt with Orvexa Forge ${ENGINE_VERSION}.\n\nRun: open index.html in a modern browser with WebGL enabled, or host this folder as a static website.\nControls: WASD / arrow keys or on-screen touch D-pad to move scripted controller entities, Space / touch JUMP to jump where a dynamic rigid body is grounded, drag to orbit, scroll to zoom, Play/Pause and Reset buttons included.\n\nThis is an original lightweight WebGL runtime with simple arcade physics. It is not a native APK build and does not include advanced Unreal/Blender systems such as skeletal animation, full collision meshes, networking, path tracing or a full production asset pipeline.\n\nScene stats (approx): ${stats.objects} entities, ${stats.vertices} vertices, ${stats.triangles} triangles.\n`;
  return new Blob([zipSync({
    'index.html': zipText(html),
    'scene.json': zipText(JSON.stringify(payload, null, 2)),
    'README-GAME.txt': zipText(readme),
  })], { type: 'application/zip' });
}


/** Build a native Android WebView project plus local and hosted APK build routes. */
export async function buildAndroidProjectZip(scene, title = 'Orvexa Android Game') {
  const gameBlob = buildStandaloneGame(scene, title);
  const gameEntries = await unzip(new Uint8Array(await gameBlob.arrayBuffer()), { maxUncompressed: 24_000_000, maxEntryBytes: 20_000_000 });
  const html = gameEntries['index.html'];
  if (!html) throw new Error('Playable game HTML was missing from the export.');
  const appTitle = String(title || 'Orvexa Game').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40).trim() || 'Orvexa Game';
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="false" android:usesCleartextTraffic="false" android:label="${appTitle}" android:theme="@android:style/Theme.Material.NoActionBar" android:hardwareAccelerated="true"><activity android:name=".MainActivity" android:exported="true" android:screenOrientation="unspecified" android:configChanges="orientation|screenSize|keyboardHidden"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`;
  // Java avoids the previous Kotlin source / missing Kotlin Gradle plugin mismatch.
  const java = `package com.orvexa.game;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
  private WebView gameView;
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    requestWindowFeature(Window.FEATURE_NO_TITLE);
    getWindow().setStatusBarColor(Color.rgb(16, 16, 25));
    getWindow().setNavigationBarColor(Color.rgb(16, 16, 25));
    gameView = new WebView(this);
    gameView.setBackgroundColor(Color.rgb(16, 16, 25));
    WebSettings settings = gameView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(false);
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    gameView.setWebViewClient(new WebViewClient());
    gameView.setWebChromeClient(new WebChromeClient());
    gameView.setFocusableInTouchMode(true);
    setContentView(gameView);
    gameView.loadUrl("file:///android_asset/index.html");
  }
  @Override protected void onPause() { if (gameView != null) gameView.onPause(); super.onPause(); }
  @Override protected void onResume() { super.onResume(); if (gameView != null) gameView.onResume(); }
  @Override protected void onDestroy() { if (gameView != null) { gameView.stopLoading(); gameView.destroy(); gameView = null; } super.onDestroy(); }
  @Override public void onBackPressed() { if (gameView != null && gameView.canGoBack()) gameView.goBack(); else super.onBackPressed(); }
}
`;
  const settings = `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = "OrvexaGame"
include(":app")
`;
  const rootBuild = `plugins { id 'com.android.application' version '8.6.1' apply false }
`;
  const appBuild = `plugins { id 'com.android.application' }

android {
    namespace 'com.orvexa.game'
    compileSdk 35
    defaultConfig {
        applicationId 'com.orvexa.game'
        minSdk 23
        targetSdk 35
        versionCode 1
        versionName '1.0'
    }
}
`;
  const gradleProps = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
android.useAndroidX=true
android.nonTransitiveRClass=true
`;
  const workflow = `name: Build Orvexa Game APK
on:
  workflow_dispatch:
  push:
    branches: [main, master]
permissions:
  contents: read
  actions: read
jobs:
  build-debug-apk:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    steps:
      - name: Check out Android project
        uses: actions/checkout@v7
      - name: Install Java 17
        uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: '17'
      - name: Install Android SDK packages
        uses: android-actions/setup-android@v4
        with:
          packages: 'platform-tools platforms;android-35 build-tools;35.0.0'
      - name: Install compatible Gradle 8.7
        uses: gradle/actions/setup-gradle@v6
        with:
          gradle-version: '8.7'
          cache-provider: basic
      - name: Build debug APK
        run: gradle --no-daemon --stacktrace assembleDebug
      - name: Verify APK and write checksum
        run: |
          test -s app/build/outputs/apk/debug/app-debug.apk
          sha256sum app/build/outputs/apk/debug/app-debug.apk | tee app/build/outputs/apk/debug/SHA256SUMS.txt
      - name: Upload downloadable APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: orvexa-game-debug-apk
          path: |
            app/build/outputs/apk/debug/app-debug.apk
            app/build/outputs/apk/debug/SHA256SUMS.txt
          if-no-files-found: error
          retention-days: 14
`;
  const sdkSetup = `#!/usr/bin/env bash
set -euo pipefail
# Linux x86_64 helper. For Android/ARM phones, prefer the hosted GitHub Actions build.
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "Local Android SDK installation helper supports Linux x86_64 only." >&2
  echo "On Android/ARM or another OS, push this folder to a GitHub repository and run Actions > Build Orvexa Game APK." >&2
  exit 2
fi
if ! command -v java >/dev/null 2>&1; then
  echo "A compatible JDK 17–21 is required. Install it first, then rerun this script." >&2
  exit 2
fi
if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
  echo "curl and unzip are required to download Android command-line tools." >&2
  exit 2
fi
SDK_ROOT="\${ANDROID_SDK_ROOT:-\${ANDROID_HOME:-$HOME/Android/Sdk}}"
TOOLS_VERSION="15859902"
TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$SDK_ROOT/cmdline-tools"
if [[ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Downloading Android command-line tools \${TOOLS_VERSION} …"
  curl -fL --retry 3 --connect-timeout 20 "$TOOLS_URL" -o "$TMP_DIR/tools.zip"
  unzip -q "$TMP_DIR/tools.zip" -d "$TMP_DIR/unpacked"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$TMP_DIR/unpacked/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
fi
export ANDROID_HOME="$SDK_ROOT" ANDROID_SDK_ROOT="$SDK_ROOT"
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
chmod +x "$SDKMANAGER"
set +o pipefail
yes | "$SDKMANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null
set -o pipefail
"$SDKMANAGER" --sdk_root="$SDK_ROOT" 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
echo "Android SDK installed at $SDK_ROOT"
echo "You can now run ./scripts/build-apk.sh"
`;
  const buildApk = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ "$(uname -s)" == "Linux" && ("$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64") && ( -n "\${ANDROID_ROOT:-}" || -n "\${TERMUX_VERSION:-}" || -x "$(command -v getprop 2>/dev/null || echo /nonexistent)" ) ]]; then
  echo "This looks like an Android/ARM shell. Android's host SDK build tools generally target desktop Linux and may not run here." >&2
  echo "Recommended no-local-SDK route: upload the contents of this project folder to a GitHub repository; the included Actions workflow builds and provides the APK artifact." >&2
  exit 2
fi
JAVA_MAJOR=""
if command -v java >/dev/null 2>&1; then JAVA_MAJOR="$(java -version 2>&1 | sed -n '1s/.*version "\\?\\([0-9]*\\).*/\\1/p' || true)"; fi
if [[ -z "$JAVA_MAJOR" || "$JAVA_MAJOR" -lt 17 || "$JAVA_MAJOR" -gt 21 ]]; then
  command -v curl >/dev/null 2>&1 || { echo "curl is required to bootstrap JDK 17." >&2; exit 2; }
  command -v tar >/dev/null 2>&1 || { echo "tar is required to unpack JDK 17." >&2; exit 2; }
  JDK_DIR="\${XDG_CACHE_HOME:-$HOME/.cache}/orvexa-jdk17"
  JDK_BIN="$(find "$JDK_DIR" -type f -path '*/bin/java' -print -quit 2>/dev/null || true)"
  if [[ -z "$JDK_BIN" ]]; then
    TMP_JDK="$(mktemp -d)"
    trap 'rm -rf "$TMP_JDK"' EXIT
    mkdir -p "$JDK_DIR"
    echo "Downloading a compatible Temurin JDK 17 into $JDK_DIR …"
    curl -fL --retry 3 --connect-timeout 20 "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o "$TMP_JDK/jdk.tar.gz"
    tar -xzf "$TMP_JDK/jdk.tar.gz" -C "$JDK_DIR"
    JDK_BIN="$(find "$JDK_DIR" -type f -path '*/bin/java' -print -quit 2>/dev/null || true)"
  fi
  if [[ -z "$JDK_BIN" || ! -x "$JDK_BIN" ]]; then echo "Could not find the downloaded JDK 17 java binary in $JDK_DIR." >&2; exit 2; fi
  export JAVA_HOME="$(dirname "$(dirname "$JDK_BIN")")"
  export PATH="$JAVA_HOME/bin:$PATH"
  JAVA_MAJOR="$(java -version 2>&1 | sed -n '1s/.*version "\\?\\([0-9]*\\).*/\\1/p' || true)"
fi
if [[ -z "$JAVA_MAJOR" || "$JAVA_MAJOR" -lt 17 || "$JAVA_MAJOR" -gt 21 ]]; then echo "A compatible JDK 17–21 is required (detected major version: \${JAVA_MAJOR:-unknown})." >&2; exit 2; fi
SDK_ROOT="\${ANDROID_SDK_ROOT:-\${ANDROID_HOME:-$HOME/Android/Sdk}}"
if [[ ! -x "$SDK_ROOT/platforms/android-35/android.jar" ]]; then
  echo "Android SDK API 35 not found at $SDK_ROOT. Installing required packages…"
  ANDROID_SDK_ROOT="$SDK_ROOT" ANDROID_HOME="$SDK_ROOT" bash "$ROOT/scripts/setup-android-sdk.sh"
fi
export ANDROID_HOME="$SDK_ROOT" ANDROID_SDK_ROOT="$SDK_ROOT"
# Always use the project's pinned Gradle version instead of an arbitrary system install.
GRADLE_VERSION='8.7'
CACHE_DIR="\${XDG_CACHE_HOME:-$HOME/.cache}/orvexa-gradle"
GRADLE_HOME="$CACHE_DIR/gradle-$GRADLE_VERSION"
mkdir -p "$CACHE_DIR"
if [[ ! -x "$GRADLE_HOME/bin/gradle" ]]; then
  command -v curl >/dev/null 2>&1 || { echo "curl is required to download Gradle $GRADLE_VERSION." >&2; exit 2; }
  command -v unzip >/dev/null 2>&1 || { echo "unzip is required to unpack Gradle." >&2; exit 2; }
  curl -fL --retry 3 "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip" -o "$CACHE_DIR/gradle.zip"
  unzip -q -o "$CACHE_DIR/gradle.zip" -d "$CACHE_DIR"
  rm -f "$CACHE_DIR/gradle.zip"
fi
GRADLE_CMD="$GRADLE_HOME/bin/gradle"
"$GRADLE_CMD" --no-daemon --stacktrace assembleDebug
APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
echo "APK created: $APK"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$APK"; fi
`;
  const readme = `${appTitle} — Orvexa Forge Android APK bundle

WHAT IS INCLUDED
- A native Java Android Activity + WebView that loads this project's self-contained local WebGL game.
- All game assets under app/src/main/assets/; game startup needs no network connection.
- A local SDK/Gradle bootstrap path for supported desktop Linux x86_64 hosts.
- A GitHub Actions workflow that installs Java and Android SDK on a hosted runner, builds app-debug.apk, and uploads it as a downloadable workflow artifact.

FASTEST ROUTE FROM AN ANDROID PHONE (NO LOCAL SDK/JDK INSTALL)
1. Extract this ZIP. Create a new repository on GitHub.
2. Upload the extracted contents of the OrvexaGame folder into the repository root, including the hidden .github/workflows/build-android-apk.yml file. Do not upload only the ZIP file; the workflow must exist in the repository at .github/workflows/build-android-apk.yml.
3. Commit the files. A build starts automatically on main/master; you can also open Actions → Build Orvexa Game APK → Run workflow.
4. When the workflow finishes successfully, open its run → Artifacts → orvexa-game-debug-apk and download it. Extract the artifact ZIP and install app-debug.apk on Android (allow installation from that source when Android asks).
5. This output is a debug APK, suitable for testing. A distributable/release APK should be signed with your own private keystore; never commit a private signing key to the repository.

LOCAL DESKTOP ROUTE
On Linux x86_64 with Java 17–21 and network access, run: bash scripts/build-apk.sh. It can download a Temurin JDK 17, Android command-line tools, required SDK packages, and Gradle 8.7 when the tools are missing. SDK package licenses and large downloads may be required. Local build scripts intentionally refuse Android/ARM environments where desktop Android build tools usually cannot execute.

REQUIREMENTS / LIMITATIONS
- This source ZIP is not itself a compiled APK. APK compilation happens on the hosted Actions runner or a compatible desktop SDK/JDK environment.
- The app wraps the exported HTML/WebGL game; it is not a native 3D renderer. Performance depends on the phone's WebView/GPU.
- The debug artifact expires after 14 days unless downloaded. GitHub account/repository and Actions availability/usage limits apply.
- For a signed release APK, configure a private keystore securely in CI secrets and a separate release signing step.
`;
  const gitignore = `.gradle/\nlocal.properties\n.idea/\nbuild/\napp/build/\n*.iml\n.DS_Store\n`;
  return new Blob([zipSync({
    'OrvexaGame/README-BUILD-APK.txt': zipText(readme),
    'OrvexaGame/settings.gradle': zipText(settings),
    'OrvexaGame/build.gradle': zipText(rootBuild),
    'OrvexaGame/gradle.properties': zipText(gradleProps),
    'OrvexaGame/app/build.gradle': zipText(appBuild),
    'OrvexaGame/app/src/main/AndroidManifest.xml': zipText(manifest),
    'OrvexaGame/app/src/main/java/com/orvexa/game/MainActivity.java': zipText(java),
    'OrvexaGame/app/src/main/assets/index.html': html,
    'OrvexaGame/app/src/main/assets/scene.json': gameEntries['scene.json'] || zipText('{}'),
    'OrvexaGame/.github/workflows/build-android-apk.yml': zipText(workflow),
    'OrvexaGame/scripts/setup-android-sdk.sh': zipText(sdkSetup),
    'OrvexaGame/scripts/build-apk.sh': zipText(buildApk),
    'OrvexaGame/.gitignore': zipText(gitignore),
  })], { type: 'application/zip' });
}
