import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

'use strict';
const $ = (id)=>document.getElementById(id);
const view = { menu:$('menu'), hud:$('hud'), pause:$('pause'), results:$('results'), dialog:$('dialog'), mobile:$('mobile-controls') };
const STORAGE = 'neonstrike_afterlight_v2';
const loadJSON = (k,fallback)=>{try {const x=JSON.parse(localStorage.getItem(STORAGE+'_'+k)); return x??fallback;}catch{return fallback;}};
const store = (k,value)=>{try{localStorage.setItem(STORAGE+'_'+k,JSON.stringify(value));}catch{}};
const DEFAULT = {graphics:'High',shadows:true,particles:true,resolution:1,fps:false,master:0.65,music:0.20,sfx:0.65,mute:false,sensitivity:1,invertY:false,crosshair:'#51ecfb',skin:'Ion Blue'};
const options = {...DEFAULT,...loadJSON('settings',{})};
const highScores = loadJSON('scores',[]);
const achievements = loadJSON('achievements',{});
let checkpoint = loadJSON('checkpoint',null);
let screen='loading', returnFromDialog='menu', lastFrame=performance.now(), fps=60, hudTicker=0, checkpointTicker=0, waveDelay=0, damageFlash=0, hitFlash=0, comboTimer=0, recoil=0, shotCooldown=0, animTime=0, nextNotice=0;
const mobile = matchMedia('(pointer:coarse)').matches;
const controls={keys:new Set(),fire:false,stickX:0,stickY:0,jump:false};
const player={x:0,y:1.8,z:10,yaw:Math.PI,pitch:0,vy:0,grounded:true,stamina:100,health:100,shield:75,regenWait:0,sprint:false};
let active=0, reloadRemaining=0, gameSeconds=0, shots=0, hits=0, eliminations=0, score=0, combo=0, xp=0, level=1, wave=1, clearedWaves=0, enemies=[];
const FINAL_WAVE=5, LEVEL_XP=(n)=>n*250;
const arsenal=[
 {name:'VOLT CARBINE',tag:'ION RIFLE',size:30,reserve:180,damage:22,rate:.135,reload:1.5,spread:.007,auto:true,color:0x55ebff},
 {name:'PULSE REPEATER',tag:'PLASMA SMG',size:42,reserve:252,damage:13,rate:.076,reload:1.8,spread:.016,auto:true,color:0xb677ff},
 {name:'ARC LANCER',tag:'PRECISION EMITTER',size:10,reserve:60,damage:68,rate:.6,reload:2.1,spread:.0015,auto:false,color:0xff5f9b}
];
let ammo=arsenal.map(w=>w.size), reserves=arsenal.map(w=>w.reserve);
const clamp=THREE.MathUtils.clamp, lerp=THREE.MathUtils.lerp;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x030916); scene.fog=new THREE.FogExp2(0x071326,.0125);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,230); camera.rotation.order='YXZ'; scene.add(camera);
const renderer=new THREE.WebGLRenderer({canvas:$('stage'),antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.9,.4,.72);composer.addPass(bloom);
let qualityPost=true; const obstacles=[], solidMeshes=[], hitMeshes=[], projectiles=[], projectilePool=[], effects=[], effectPool=[], lights=[], signs=[];
const worldGroup=new THREE.Group();scene.add(worldGroup);
const viewWeapon=new THREE.Group();camera.add(viewWeapon);
const worldClock=new THREE.Clock();
const c=new THREE.Color();const vec=new THREE.Vector3();const scratch=new THREE.Vector3();const raycaster=new THREE.Raycaster();
const rand=(a,b)=>a+Math.random()*(b-a);
const mat=(color,emissive=0x000000,strength=0,roughness=.55,metalness=.35)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:strength,metalness,roughness});
const cyanMat=mat(0x143747,0x15dfff,2.3,.2,.65),purpleMat=mat(0x291443,0xa149ff,1.5),pinkMat=mat(0x54172c,0xff2863,1.6);
const darkMetal=mat(0x142030,0x030714,.3,.35,.8),floorMetal=mat(0x101928,0x010814,.22,.24,.72);
const boxGeo=new THREE.BoxGeometry(1,1,1);
function cube(parent,w,h,d,x,y,z,material){const m=new THREE.Mesh(boxGeo,material);m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;}
function labelTexture(text,color='#6ceefa'){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const x=canvas.getContext('2d');
 x.fillStyle='#02101b';x.fillRect(0,0,512,128);x.strokeStyle=color;x.lineWidth=4;x.strokeRect(5,5,502,118);
 x.fillStyle=color;x.font='bold 63px Arial';x.textAlign='center';x.shadowColor=color;x.shadowBlur=15;x.fillText(text,256,84);
 const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;return tx;
}
function groundTexture(normal=false){const can=document.createElement('canvas');can.width=128;can.height=128;const ctx=can.getContext('2d');ctx.fillStyle=normal?'#8080ff':'#111827';ctx.fillRect(0,0,128,128);
 for(let i=0;i<420;i++){const v=Math.floor(rand(48,110));ctx.fillStyle=normal?`rgba(${v+35},${v+35},255,.2)`:`rgba(100,160,205,${rand(.025,.12)})`;ctx.fillRect(rand(0,128),rand(0,128),rand(1,5),rand(1,5));}
 const tx=new THREE.CanvasTexture(can);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(22,22);return tx;
}
function addObstacle(w,h,d,x,z,material=darkMetal){const a=cube(worldGroup,w,h,d,x,h/2,z,material);solidMeshes.push(a);obstacles.push({x,z,hx:w/2+.6,hz:d/2+.6});return a;}
function addStrip(x,z,w,d,material=cyanMat){const a=cube(worldGroup,w,.035,d,x,.07,z,material);a.castShadow=false;return a;}
function buildArena(){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(130,130),new THREE.MeshStandardMaterial({color:0x0b1627,map:groundTexture(),normalMap:groundTexture(true),roughness:.25,metalness:.68}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;worldGroup.add(ground);
 const grid=new THREE.GridHelper(100,50,0x26608a,0x17304b);grid.position.y=.035;grid.material.transparent=true;grid.material.opacity=.3;worldGroup.add(grid);
 for(let j=-4;j<=4;j++){addStrip(j*10,0,.06,88,j%2?purpleMat:cyanMat);addStrip(0,j*10,88,.06,j%2?cyanMat:purpleMat);}
 const wallMat=mat(0x101827,0x0c1a32,.5,.8,.3);
 addObstacle(93,12,2,0,-46,wallMat);addObstacle(93,12,2,0,46,wallMat);addObstacle(2,12,90,-46,0,wallMat);addObstacle(2,12,90,46,0,wallMat);
 const cover=[[-21,-18,6,3],[-9,-22,8,3],[9,-20,7,3],[24,-12,6,3],[-27,6,5,5],[-12,5,6,4],[11,8,6,5],[24,20,6,3],[-24,21,6,4],[-4,25,9,3],[18,-1,4,4],[-5,-8,5,4]];
 for(let i=0;i<cover.length;i++){const [x,z,w,d]=cover[i];const h=rand(2.3,3.8);const m=addObstacle(w,h,d,x,z,i%3===0?mat(0x1b2d3c,0x071e36,.45):darkMetal);m.castShadow=i%2===0;cube(worldGroup,w+.08,.07,d+.08,x,h,z,i%2?cyanMat:purpleMat);}
 // Instanced city geometry: a very small number of draw calls for the skyline.
 const columns=[];for(let i=0;i<190;i++){const a=rand(0,Math.PI*2),r=rand(53,94);let x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<48&&Math.abs(z)<48)continue;columns.push({x,z,w:rand(3,10),d:rand(3,10),h:rand(10,55)});}
 const cityMat=mat(0x0d1b2d,0x020912,.22,.7,.58);const buildings=new THREE.InstancedMesh(boxGeo,cityMat,columns.length);buildings.instanceMatrix.setUsage(THREE.StaticDrawUsage);const dummy=new THREE.Object3D();columns.forEach((v,i)=>{dummy.position.set(v.x,v.h/2-1,v.z);dummy.scale.set(v.w,v.h,v.d);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);});buildings.receiveShadow=true;worldGroup.add(buildings);
 // Procedural lit windows, one InstancedMesh, far outside walkable area.
 const windows=[];for(const b of columns){const count=Math.floor(b.h/3);for(let k=2;k<count;k++)if(Math.random()>.5){const side=Math.random()<.5?-1:1;windows.push({x:b.x+(b.w/2+.025)*side,y:k*3,z:b.z+rand(-b.d*.37,b.d*.37),rot:Math.PI/2});} }
 const winMat=new THREE.MeshBasicMaterial({color:0x6ae7fc,transparent:true,opacity:.5,side:THREE.DoubleSide});const winGeo=new THREE.PlaneGeometry(.9,1.2);const instWin=new THREE.InstancedMesh(winGeo,winMat,windows.length);windows.forEach((w,i)=>{dummy.position.set(w.x,w.y,w.z);dummy.rotation.set(0,w.rot,0);dummy.scale.setScalar(1);dummy.updateMatrix();instWin.setMatrixAt(i,dummy.matrix);});worldGroup.add(instWin);
 for(let i=0;i<11;i++){const a=(i/11)*Math.PI*2,r=50,x=Math.cos(a)*r,z=Math.sin(a)*r;const pillar=cube(worldGroup,1.5,18,1.5,x,9,z,darkMetal);pillar.castShadow=false;cube(worldGroup,1.7,.3,1.7,x,15,z,i%2?purpleMat:cyanMat);
 if(i%2===0){const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.25),new THREE.MeshBasicMaterial({map:labelTexture(['SECTOR 07','NOVA GRID','AFTERLIGHT','STAY ONLINE','NEON CITY','DANGER'][Math.floor(i/2)],i%3?'#6eefff':'#ff63bc'),transparent:true,side:THREE.DoubleSide}));sign.position.set(x,12,z);sign.rotation.y=-a+Math.PI/2;worldGroup.add(sign);}
 }
 const sky=new THREE.Mesh(new THREE.SphereGeometry(220,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPosition;void main(){float h=normalize(vPosition).y;vec3 top=vec3(.005,.013,.048);vec3 horizon=vec3(.028,.075,.115);gl_FragColor=vec4(mix(horizon,top,smoothstep(-.22,.65,h)),1.);}'}));scene.add(sky);
 scene.add(new THREE.AmbientLight(0x456a96,.3));scene.add(new THREE.HemisphereLight(0x5ca6e8,0x091020,.95));
 const moon=new THREE.DirectionalLight(0x8dc7ff,1.6);moon.position.set(16,42,-23);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-55;moon.shadow.camera.right=55;moon.shadow.camera.top=55;moon.shadow.camera.bottom=-55;moon.shadow.bias=-.0003;scene.add(moon);lights.push(moon);
 [[-30,-28,0x1acbff],[28,26,0xd342f8],[-27,28,0x974dff],[27,-29,0xff226d]].forEach(([x,z,col])=>{const l=new THREE.PointLight(col,55,33,2);l.position.set(x,7,z);scene.add(l);lights.push(l);const pole=cube(worldGroup,.45,8,.45,x,4,z,darkMetal);pole.castShadow=false;cube(worldGroup,1,.25,1,x,8.2,z,col===0xff226d?pinkMat:cyanMat);});
 const rainCount=1350;const rainP=new Float32Array(rainCount*3);for(let i=0;i<rainCount;i++){rainP[i*3]=rand(-50,50);rainP[i*3+1]=rand(1,32);rainP[i*3+2]=rand(-50,50);}const rainG=new THREE.BufferGeometry();rainG.setAttribute('position',new THREE.BufferAttribute(rainP,3));const rain=new THREE.Points(rainG,new THREE.PointsMaterial({color:0x66b6e3,size:.065,transparent:true,opacity:.47,depthWrite:false}));rain.frustumCulled=false;worldGroup.add(rain);scene.userData.rain=rain;
 const holo=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,3.6,8,1,true),new THREE.MeshBasicMaterial({color:0x2dddfb,wireframe:true,transparent:true,opacity:.19,depthWrite:false}));holo.position.set(0,5,0);worldGroup.add(holo);scene.userData.holo=holo;
}
function rebuildWeapon(){viewWeapon.traverse(o=>{if(o.isMesh){if(o.geometry!==boxGeo)o.geometry.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();}});viewWeapon.clear();const gun=arsenal[active];const skin=options.skin==='Plasma Violet'?0xba68ff:options.skin==='Crimson Pulse'?0xff718c:gun.color;const shell=mat(0x1b2b3f,0x040d20,.3,.24,.8),neon=mat(skin,skin,2.4,.18,.4),black=mat(0x071321,0x000000,0,.25,.8);
 const p=new THREE.Group();p.position.set(.42,-.34,-.64);viewWeapon.add(p);viewWeapon.userData.model=p;
 cube(p,.22,.22,.65,0,0,-.1,shell);cube(p,.17,.12,.3,0,-.11,.08,shell);cube(p,.12,.33,.13,0,-.28,.1,black);cube(p,.16,.06,.53,0,.14,-.13,neon);cube(p,.15,.15,.3,0,.01,-.52,black);cube(p,.055,.055,.37,0,.015,-.72,neon);cube(p,.2,.1,.19,0,.22,.1,shell);cube(p,.08,.035,.13,0,.28,.1,neon);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.35,10),shell);barrel.rotation.x=Math.PI/2;barrel.position.set(0,0,-.78);p.add(barrel);
 const muzzle=new THREE.PointLight(skin,0,5,2);muzzle.position.set(0,0,-.95);p.add(muzzle);viewWeapon.userData.flash=muzzle;viewWeapon.userData.flashT=0;
}
function applyGraphics(){const presets={Low:{ratio:.65,bloom:false,shadows:false,rain:0},Medium:{ratio:.84,bloom:true,shadows:false,rain:650},High:{ratio:1,bloom:true,shadows:true,rain:1350}};const p=presets[options.graphics]||presets.High;const dpr=Math.min(devicePixelRatio||1,2)*p.ratio*clamp(Number(options.resolution)||1,.5,1);renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);composer.setPixelRatio(dpr);composer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=p.shadows&&options.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 qualityPost=p.bloom;const rain=scene.userData.rain;if(rain){rain.visible=Boolean(options.particles)&&p.rain>0;rain.geometry.setDrawRange(0,p.rain);}
 $('fps-counter').hidden=!options.fps;}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();applyGraphics();}window.addEventListener('resize',resize);
function showScreen(next){screen=next;$('loading').classList.toggle('hidden',next!=='loading');viewWeapon.visible=next!=='menu';Object.entries(view).forEach(([name,el])=>{if(name!=='mobile')el.classList.toggle('hidden',name!==next);});view.mobile.classList.toggle('hidden',!(mobile&&next==='hud'));$('continue-btn').hidden=!checkpoint;
 $('hud-tip').style.display=mobile?'none':'';}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.id);toast.id=setTimeout(()=>el.classList.add('hidden'),2300);}
function award(id,title){if(achievements[id])return;achievements[id]={title,when:new Date().toISOString()};store('achievements',achievements);notify('ACHIEVEMENT // '+title);}
function notify(msg){const stack=$('notification-stack');const item=document.createElement('div');item.className='notification';item.textContent=msg;stack.prepend(item);if(stack.childElementCount>3)stack.lastChild.remove();setTimeout(()=>item.remove(),1900);}
const audio={ctx:null,amb:null,gain:null,start(){try{if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume();if(!this.amb){this.amb=this.ctx.createOscillator();this.amb.type='sine';this.amb.frequency.value=54;this.gain=this.ctx.createGain();this.gain.gain.value=0;this.amb.connect(this.gain).connect(this.ctx.destination);this.amb.start();}this.update();}catch{}},update(){if(this.gain)this.gain.gain.setTargetAtTime(screen==='hud'&&!options.mute?options.master*options.music*.1:0,this.ctx.currentTime,.08)},beep(freq=400,dur=.07,type='sawtooth',vol=.13){if(options.mute||!options.master||!options.sfx||!this.ctx)return;try{const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,this.ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.55),this.ctx.currentTime+dur);gain.gain.setValueAtTime(options.master*options.sfx*vol,this.ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+dur);osc.connect(gain).connect(this.ctx.destination);osc.start();osc.stop(this.ctx.currentTime+dur+.02);}catch{}}};
const ENEMIES={
 scout:{title:'SCOUT DRONE',hp:48,speed:6,range:19,damage:7,cooldown:2.05,scale:.72,color:0x55f5ff,score:120,xp:48},
 assault:{title:'ASSAULT UNIT',hp:94,speed:3.7,range:25,damage:9,cooldown:1.85,scale:1,color:0xff5987,score:180,xp:63},
 heavy:{title:'HEAVY MECH',hp:260,speed:2.35,range:22,damage:17,cooldown:3,scale:1.65,color:0xf7934d,score:420,xp:125},
 sniper:{title:'SNIPER DRONE',hp:67,speed:3.1,range:43,damage:20,cooldown:3.2,scale:.85,color:0xae8aff,score:250,xp:90},
 boss:{title:'OVERSEER PRIME',hp:1050,speed:2.2,range:33,damage:15,cooldown:2.5,scale:2.7,color:0xfd518e,score:2200,xp:750}
};
const enemyCoreGeo=new THREE.OctahedronGeometry(.62,1),eyeGeo=new THREE.SphereGeometry(.18,12,8),ringGeo=new THREE.TorusGeometry(.7,.06,6,20),orbGeo=new THREE.SphereGeometry(.2,8,6);
function enemyMesh(type){const cfg=ENEMIES[type],g=new THREE.Group();g.scale.setScalar(cfg.scale);
 const bodyMat=mat(0x243144,0x080d1d,.2,.25,.75),glow=mat(cfg.color,cfg.color,2,.2,.45);
 const body=new THREE.Mesh(enemyCoreGeo,bodyMat);body.position.y=1.7;body.castShadow=true;g.add(body);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),glow);core.position.y=1.7;g.add(core);
 const head=new THREE.Mesh(new THREE.BoxGeometry(.64,.5,.63),bodyMat);head.position.y=2.56;g.add(head);head.castShadow=true;
 const eye=new THREE.Mesh(eyeGeo,glow);eye.scale.set(1.6,.52,.4);eye.position.set(0,2.56,.36);g.add(eye);
 for(let s of [-1,1]){cube(g,.38,.18,.85,s*.84,1.75,0,bodyMat);cube(g,.18,.1,.55,s*.84,1.72,-.4,glow);if(type==='assault'||type==='heavy'||type==='boss'){cube(g,.42,1.05,.42,s*.39,.63,.05,bodyMat);cube(g,.35,.12,.35,s*.39,.2,.08,glow);}}
 if(type==='scout'||type==='sniper'){const ring=new THREE.Mesh(ringGeo,glow);ring.rotation.x=Math.PI/2;ring.position.y=1.65;g.add(ring);}else{cube(g,.7,.24,.72,0,.77,0,bodyMat);}
 const under=new THREE.Mesh(new THREE.RingGeometry(.75,.85,28),new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));under.rotation.x=-Math.PI/2;under.position.y=.035;g.add(under);
 body.userData.hit='body';head.userData.hit='head';core.userData.hit='core';return {g,body,head,core,glow,bodyMat,under};
}
function spawnEnemy(type,x,z){const cfg=ENEMIES[type],m=enemyMesh(type),unit={type,cfg,...m,x,z,hp:cfg.hp,maxhp:cfg.hp,attack:rand(.6,2),telegraph:0,stun:0,seed:rand(0,100),phase:1,retreat:rand(-1,1),flash:0,alive:true};unit.g.position.set(x,0,z);worldGroup.add(unit.g);for(const mesh of [unit.body,unit.head,unit.core]){mesh.userData.enemy=unit;hitMeshes.push(mesh);}enemies.push(unit);return unit;}
function freeEnemy(unit){unit.alive=false;worldGroup.remove(unit.g);for(const mesh of [unit.body,unit.head,unit.core]){const i=hitMeshes.indexOf(mesh);if(i!==-1)hitMeshes.splice(i,1);}unit.g.traverse(o=>{if(o.isMesh){if(o.geometry!==boxGeo && o.geometry!==enemyCoreGeo && o.geometry!==eyeGeo && o.geometry!==ringGeo){o.geometry.dispose();}if(o.material&&!Array.isArray(o.material))o.material.dispose();}});}
function playerBlocked(x,z){if(x< -43.7||x>43.7||z< -43.7||z>43.7)return true;for(const o of obstacles){if(Math.abs(x-o.x)<o.hx&&Math.abs(z-o.z)<o.hz)return true;}return false;}
function enemyBlocked(x,z){if(x< -42||x>42||z< -42||z>42)return true;for(const o of obstacles)if(Math.abs(x-o.x)<o.hx+.35&&Math.abs(z-o.z)<o.hz+.35)return true;return false;}
function randomSpawn(){for(let i=0;i<60;i++){const angle=rand(0,Math.PI*2),r=rand(21,38),x=Math.cos(angle)*r,z=Math.sin(angle)*r;if(!enemyBlocked(x,z)&&Math.hypot(player.x-x,player.z-z)>17)return {x,z};}return {x:rand(-36,36),z:-36};}
function beginWave(){if(wave>FINAL_WAVE){finish(true);return;}clearEnemies();const n=3+wave*2;for(let i=0;i<n;i++){let type='scout';if(wave>1 && i%3===0)type='assault';if(wave>=3 && i%5===0)type='sniper';if(wave>=4 && i%6===0)type='heavy';if(wave===5 && i===n-1)type='boss';const pos=randomSpawn();spawnEnemy(type,pos.x,pos.z);}
 player.health=clamp(player.health+10,0,100);player.shield=clamp(player.shield+22,0,75);for(let i=0;i<3;i++){reserves[i]=Math.min(arsenal[i].reserve,reserves[i]+arsenal[i].size);}
 $('wave-banner').classList.remove('hidden');$('wave-banner').querySelector('strong').textContent=`WAVE ${String(wave).padStart(2,'0')}`;setTimeout(()=>$('wave-banner').classList.add('hidden'),1900);saveCheckpoint();audio.beep(350,.26,'sine',.16);}
function clearEnemies(){for(const en of enemies)freeEnemy(en);enemies=[];}
function saveCheckpoint(){if(screen!=='hud'&&screen!=='pause')return;checkpoint={wave,health:player.health,shield:player.shield,score,eliminations,shots,hits,gameSeconds,xp,level,ammo:[...ammo],reserves:[...reserves],clearedWaves};store('checkpoint',checkpoint);$('continue-btn').hidden=false;}
function resetTransient(){clearEnemies();for(const p of projectiles){worldGroup.remove(p.mesh);projectilePool.push(p);}projectiles.length=0;for(const e of effects){scene.remove(e.mesh);effectPool.push(e);}effects.length=0;controls.keys.clear();controls.fire=false;controls.jump=false;controls.stickX=0;controls.stickY=0;reloadRemaining=0;recoil=0;shotCooldown=0;waveDelay=0;combo=0;comboTimer=0;hitFlash=0;damageFlash=0;}
function startGame(saved=null){resetTransient();wave=Number(saved?.wave)||1;clearedWaves=Number(saved?.clearedWaves)||0;player.x=0;player.y=1.8;player.z=10;player.yaw=0;player.pitch=0;player.vy=0;player.stamina=100;player.grounded=true;player.health=clamp(saved?.health??100,1,100);player.shield=clamp(saved?.shield??75,0,75);player.regenWait=0;
 score=saved?.score||0;eliminations=saved?.eliminations||0;shots=saved?.shots||0;hits=saved?.hits||0;xp=saved?.xp||0;level=saved?.level||1;gameSeconds=saved?.gameSeconds||0;ammo=saved?.ammo?.length===3?[...saved.ammo]:arsenal.map(w=>w.size);reserves=saved?.reserves?.length===3?[...saved.reserves]:arsenal.map(w=>w.reserve);active=0;rebuildWeapon();showScreen('hud');audio.start();beginWave();updateHUD();$('hud-tip').style.opacity='1';if(!mobile)lockPointer();}
function lockPointer(){try{if(document.pointerLockElement!==renderer.domElement){const pending=renderer.domElement.requestPointerLock?.();pending?.catch?.(()=>toast('Click the arena to enable mouse look'));}}catch{toast('Pointer lock is unavailable; try a desktop browser.');}}
function unlockPointer(){if(document.pointerLockElement)document.exitPointerLock?.();}
function pauseGame(){if(screen!=='hud')return;saveCheckpoint();showScreen('pause');unlockPointer();audio.update();}
function resumeGame(){if(screen!=='pause')return;showScreen('hud');audio.start();if(!mobile)lockPointer();}
function quitToMenu(){if(screen==='hud'||screen==='pause')saveCheckpoint();resetTransient();showScreen('menu');unlockPointer();audio.update();}
function restartGame(){checkpoint=null;store('checkpoint',null);startGame();}
function accuracy(){return shots?Math.round(hits/shots*100):0;}
function timeString(sec){const s=Math.floor(sec);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function finish(victory){if(screen!=='hud')return;if(victory)award('champion','AFTERLIGHT CHAMPION');resetTransient();checkpoint=null;store('checkpoint',null);unlockPointer();
 const report={score,wave,clearedWaves,eliminations,accuracy:accuracy(),gameSeconds,level,when:new Date().toISOString(),victory};highScores.push(report);highScores.sort((a,b)=>b.score-a.score);highScores.length=Math.min(15,highScores.length);store('scores',highScores);
 $('result-eyebrow').textContent=victory?'MISSION COMPLETE // AFTERLIGHT CLEARED':'MISSION REPORT // SIGNAL LOST';$('result-title').innerHTML=victory?'MISSION <em>COMPLETE</em>':'MISSION <em>FAILED</em>';$('result-subtitle').textContent=victory?'The sector is secure. Your signal lives on.':'Your signal was lost in the Afterlight sector.';
 $('result-score').textContent=String(score).padStart(6,'0');$('result-waves').textContent=clearedWaves;$('result-kills').textContent=eliminations;$('result-accuracy').textContent=accuracy()+'%';$('result-time').textContent=timeString(gameSeconds);$('result-best').textContent=(highScores[0]?.score||0).toLocaleString();$('result-level').textContent=level;
 showScreen('results');audio.update();audio.beep(victory?740:180,.4,'sine',.18);
}
function addXP(amount){xp+=amount;while(xp>=LEVEL_XP(level)){xp-=LEVEL_XP(level);level++;notify(`LEVEL ${String(level).padStart(2,'0')} REACHED`);audio.beep(650,.3,'sine',.13);if(level===3){notify('SKIN UNLOCKED: PLASMA VIOLET');}if(level===5){notify('SKIN UNLOCKED: CRIMSON PULSE');}}}
function enemyDamage(unit,dmg,hitLoc){if(!unit.alive)return;unit.hp-=dmg;if(hitLoc==='head')award('precision','PRECISION STRIKE');unit.flash=.13;unit.stun=.1;unit.body.material.emissive.setHex(0xe2fcff);hitFlash=.13;$('hit-marker').classList.add('show');
 if(unit.hp<=0){score+=unit.cfg.score+Math.round(combo*15);eliminations++;if(eliminations===1)award('first','FIRST CONTACT');combo=clamp(combo+1,0,10);comboTimer=5;addXP(unit.cfg.xp);notify(`${hitLoc==='head'?'PRECISION HIT · ':''}${unit.cfg.title} +${unit.cfg.score}`);spawnSpark(unit.g.position.clone().add(new THREE.Vector3(0,1.7*unit.cfg.scale,0)),unit.cfg.color,9);freeEnemy(unit);enemies.splice(enemies.indexOf(unit),1);audio.beep(210,.19,'triangle',.14);if(enemies.length===0){clearedWaves=wave;if(wave===1)award('wave_one','SURVIVOR');waveDelay=3;notify('SECTOR CLEARED // STAND BY');}}else{score+=hitLoc==='head'?22:10;spawnSpark(unit.g.position.clone().add(new THREE.Vector3(0,2.1*unit.cfg.scale,0)),unit.cfg.color,3);audio.beep(560,.05,'sine',.06);}
}
function lineEffect(from,to,color=0x59eafe){let e=effectPool.pop();if(!e){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const mesh=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));e={mesh,ttl:.1,max:.1};}e.mesh.material.color.setHex(color);e.mesh.material.opacity=.9;const a=e.mesh.geometry.attributes.position.array;a[0]=from.x;a[1]=from.y;a[2]=from.z;a[3]=to.x;a[4]=to.y;a[5]=to.z;e.mesh.geometry.attributes.position.needsUpdate=true;e.ttl=.13;e.max=.13;scene.add(e.mesh);effects.push(e);}
function spawnSpark(pos,color,n=5){for(let i=0;i<n;i++){const end=pos.clone().add(new THREE.Vector3(rand(-1.3,1.3),rand(-1,1.5),rand(-1.3,1.3)));lineEffect(pos,end,color);}}
function fireWeapon(){if(screen!=='hud'||reloadRemaining>0||shotCooldown>0||waveDelay>0)return;const w=arsenal[active];if(ammo[active]<=0){reloadWeapon();return;}
 ammo[active]--;shots++;shotCooldown=w.rate;recoil=Math.min(recoil+.11,.32);viewWeapon.userData.flash.intensity=5;viewWeapon.userData.flashT=.055;audio.beep(active===2?130:active===1?245:190,.09,'sawtooth',.14);
 camera.updateMatrixWorld(true);raycaster.setFromCamera({x:rand(-w.spread,w.spread),y:rand(-w.spread,w.spread)},camera);raycaster.far=82;
 const candidates=raycaster.intersectObjects([...hitMeshes,...solidMeshes],false);const source=new THREE.Vector3();camera.getWorldPosition(source);const target=new THREE.Vector3();raycaster.ray.at(75,target);
 if(candidates.length){const first=candidates[0];target.copy(first.point);const unit=first.object.userData.enemy;if(unit){hits++;const loc=first.object.userData.hit;enemyDamage(unit,Math.round(w.damage*(loc==='head'?1.65:1)),loc);}}
 const origin=new THREE.Vector3();viewWeapon.userData.model.getWorldPosition(origin);origin.y-=.1;lineEffect(origin,target,w.color);
}
function reloadWeapon(){if(screen!=='hud'||reloadRemaining>0)return;const w=arsenal[active];if(ammo[active]===w.size||reserves[active]<=0)return;reloadRemaining=w.reload;audio.beep(440,.1,'triangle',.06);notify('ENERGY CELL RECHARGING');}
function switchWeapon(i){if(screen!=='hud'||i<0||i>=arsenal.length||i===active)return;active=i;reloadRemaining=0;shotCooldown=.22;rebuildWeapon();notify(`${arsenal[i].name} EQUIPPED`);audio.beep(550,.06,'triangle',.08);}
function collideAt(x,z){return !playerBlocked(x,z);}
function updateMovement(dt){const sprintKey=controls.keys.has('ShiftLeft')||controls.keys.has('ShiftRight');const crouch=controls.keys.has('ControlLeft')||controls.keys.has('KeyC');let forward=0,side=0;
 if(controls.keys.has('KeyW'))forward++;if(controls.keys.has('KeyS'))forward--;if(controls.keys.has('KeyA'))side--;if(controls.keys.has('KeyD'))side++;
 forward+=-controls.stickY;side+=controls.stickX;const l=Math.hypot(forward,side);if(l>1){forward/=l;side/=l;}
 player.sprint=sprintKey&&!crouch&&forward>.1&&player.stamina>2;const speed=crouch?3.0:player.sprint?10.5:6.7;
 if(player.sprint)player.stamina=Math.max(0,player.stamina-27*dt);else player.stamina=Math.min(100,player.stamina+17*dt);
 const dx=(Math.sin(player.yaw)*-forward+Math.cos(player.yaw)*side)*speed*dt;
 const dz=(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*side)*speed*dt;
 if(collideAt(player.x+dx,player.z))player.x+=dx;if(collideAt(player.x,player.z+dz))player.z+=dz;
 if((controls.keys.has('Space')||controls.jump)&&player.grounded){player.vy=6;player.grounded=false;audio.beep(180,.09,'sine',.05);}
 if(!player.grounded){player.vy-=16*dt;player.y+=player.vy*dt;if(player.y<=1.8){player.y=1.8;player.vy=0;player.grounded=true;}}
 const eyeTarget=(crouch?1.05:1.8);const bob=l>.08&&player.grounded?Math.sin(animTime*(player.sprint?15:10))*.045:0;
 camera.position.set(player.x,player.y-(1.8-eyeTarget)+bob,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
 const wm=viewWeapon.userData.model;if(wm){wm.position.x=lerp(wm.position.x,.42+Math.sin(animTime*9)*l*.012,Math.min(1,dt*10));wm.position.y=lerp(wm.position.y,-.34+Math.cos(animTime*11)*l*.008-recoil*.35,Math.min(1,dt*10));wm.rotation.x=lerp(wm.rotation.x,recoil*.8,Math.min(1,dt*13));}
 recoil=Math.max(0,recoil-dt*.75);
}
function playerDamage(amount,fromX,fromZ){if(screen!=='hud')return;player.regenWait=5;let left=amount;if(player.shield>0){const absorbed=Math.min(player.shield,left);player.shield-=absorbed;left-=absorbed;}player.health=Math.max(0,player.health-left);damageFlash=.45;const angle=(Math.atan2(fromX-player.x,player.z-fromZ)-player.yaw)*180/Math.PI;$('damage-indicator').style.setProperty('--angle',angle+'deg');audio.beep(105,.21,'sine',.15);if(player.health<=0)finish(false);}
function energyOrb(x,y,z,dx,dy,dz,type,color,speed,damage){let p=projectilePool.pop();if(!p){const mesh=new THREE.Mesh(orbGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthWrite:false}));p={mesh};}p.mesh.material.color.setHex(color);p.mesh.position.set(x,y,z);p.x=x;p.y=y;p.z=z;p.dx=dx;p.dy=dy;p.dz=dz;p.type=type;p.speed=speed;p.damage=damage;p.ttl=5;p.mesh.scale.setScalar(type==='boss'?.2/.2:1);worldGroup.add(p.mesh);projectiles.push(p);}
function launchEnemyShot(en){const launchY=en.type==='boss'?3.6:1.7*en.cfg.scale,deltaY=camera.position.y-launchY;const d=Math.hypot(player.x-en.x,player.z-en.z,deltaY),dx=(player.x-en.x)/Math.max(.1,d),dz=(player.z-en.z)/Math.max(.1,d),dy=deltaY/Math.max(.1,d),cfg=en.cfg;
 if(en.type==='boss'){const phase=en.hp/en.maxhp<.5?2:1;for(let i=-phase;i<=phase;i++){const a=Math.atan2(dx,dz)+i*.16;const planar=Math.hypot(dx,dz);energyOrb(en.x,launchY,en.z,Math.sin(a)*planar,dy,Math.cos(a)*planar,en.type,cfg.color,11,cfg.damage);} }
 else energyOrb(en.x,launchY,en.z,dx,dy,dz,en.type,cfg.color,en.type==='sniper'?21:13,cfg.damage);
 audio.beep(en.type==='boss'?130:370,.16,'triangle',.09);
}
function updateEnemies(dt){for(let i=enemies.length-1;i>=0;i--){const en=enemies[i],cfg=en.cfg,dX=player.x-en.x,dZ=player.z-en.z,dist=Math.max(.01,Math.hypot(dX,dZ));
 en.flash-=dt;en.stun=Math.max(0,en.stun-dt);if(en.flash<=0)en.body.material.emissive.setHex(0x080d1d);
 en.g.rotation.y=lerp(en.g.rotation.y,Math.atan2(dX,dZ),Math.min(1,dt*7));en.g.position.y=(en.type==='scout'||en.type==='sniper'?Math.sin(animTime*3+en.seed)*.26+.25:0);en.under.material.opacity=.19+Math.sin(animTime*4+en.seed)*.08;
 en.attack-=dt;const safe=dist<(en.type==='sniper'?17:en.type==='scout'?7:11),want=dist>(en.type==='sniper'?24:en.type==='scout'?8:14);let mx=0,mz=0;
 if(en.stun<=0){if(want){mx=dX/dist;mz=dZ/dist;}else if(safe){mx=-dX/dist;mz=-dZ/dist;}else{mx=-dZ/dist*en.retreat*.7;mz=dX/dist*en.retreat*.7;}}
 if(dist<cfg.range*1.2){const step=dt*cfg.speed*(en.telegraph>0?.25:1);const nx=en.x+mx*step,nz=en.z+mz*step;if(!enemyBlocked(nx,en.z))en.x=nx;else if(!enemyBlocked(en.x,nz))en.z=nz;else{en.retreat*=-1;en.x+=rand(-.02,.02);}}
 en.g.position.x=en.x;en.g.position.z=en.z;
 if(en.telegraph>0){en.telegraph-=dt;en.core.material.emissiveIntensity=3+Math.sin(animTime*35)*2;if(en.telegraph<=0){en.core.material.emissiveIntensity=2;if(dist<cfg.range+8)launchEnemyShot(en);en.attack=cfg.cooldown*(en.type==='boss'&&en.hp/en.maxhp<.5?.62:1);}}
 else if(en.attack<=0&&dist<cfg.range){en.telegraph=en.type==='sniper'?1:en.type==='boss'?.8:.56;en.attack=cfg.cooldown;}
 }}
function updateOrbs(dt){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.dx*p.speed*dt;p.y+=p.dy*p.speed*dt;p.z+=p.dz*p.speed*dt;p.ttl-=dt;p.mesh.position.set(p.x,p.y,p.z);const collision=Math.hypot(p.x-player.x,p.z-player.z)<.8&&Math.abs(p.y-camera.position.y)<1.05;
 if(collision){playerDamage(p.damage,p.x,p.z);if(screen!=='hud')return;}if(p.ttl<=0||collision||enemyBlocked(p.x,p.z)){worldGroup.remove(p.mesh);projectiles.splice(i,1);projectilePool.push(p);}}
}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.ttl-=dt;e.mesh.material.opacity=Math.max(0,e.ttl/e.max);if(e.ttl<=0){scene.remove(e.mesh);effects.splice(i,1);effectPool.push(e);}}
 if(viewWeapon.userData.flashT>0){viewWeapon.userData.flashT-=dt;if(viewWeapon.userData.flashT<=0)viewWeapon.userData.flash.intensity=0;}
 if(hitFlash>0){hitFlash-=dt;if(hitFlash<=0)$('hit-marker').classList.remove('show');}
 damageFlash=Math.max(0,damageFlash-dt);$('damage-indicator').style.opacity=Math.min(1,damageFlash*1.7).toFixed(2);
}
function updateGame(dt){gameSeconds+=dt;animTime+=dt;updateMovement(dt);shotCooldown=Math.max(0,shotCooldown-dt);
 if(reloadRemaining>0){reloadRemaining-=dt;const w=arsenal[active];if(reloadRemaining<=0){const n=Math.min(w.size-ammo[active],reserves[active]);ammo[active]+=n;reserves[active]-=n;reloadRemaining=0;audio.beep(680,.12,'triangle',.09);}}
 if(controls.fire&&(arsenal[active].auto||!controls.firedOnce)){fireWeapon();controls.firedOnce=true;}
 if(!controls.fire)controls.firedOnce=false;
 if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0;}
 player.regenWait-=dt;if(player.regenWait<=0){player.shield=Math.min(75,player.shield+dt*7);}
 if(waveDelay>0){waveDelay-=dt;if(waveDelay<=0){wave++;beginWave();}}
 updateEnemies(dt);updateOrbs(dt);updateEffects(dt);
 hudTicker-=dt;if(hudTicker<=0){hudTicker=.09;updateHUD();}checkpointTicker+=dt;if(checkpointTicker>18){checkpointTicker=0;saveCheckpoint();}
}
function updateHUD(){const w=arsenal[active];$('hud-wave').innerHTML=`${String(wave).padStart(2,'0')}<span>/05</span>`;$('hud-enemies').textContent=enemies.length;$('hud-score').textContent=String(score).padStart(6,'0');$('hud-kills').textContent=eliminations;$('hud-accuracy').textContent=accuracy()+'%';$('hud-combo').textContent='×'+(1+combo*.15).toFixed(1);
 $('hud-health-text').textContent=`${Math.ceil(player.health)} / 100`;$('health-fill').style.width=player.health+'%';$('hud-shield-text').textContent=`${Math.ceil(player.shield)} / 75`;$('shield-fill').style.width=player.shield/75*100+'%';$('sprint-fill').style.width=player.stamina+'%';$('hud-weapon').textContent=w.name;$('hud-weapon-index').textContent=`0${active+1} / 03`;$('hud-ammo').textContent=String(ammo[active]).padStart(2,'0');$('hud-reserve').textContent=reserves[active];$('reload-label').textContent=reloadRemaining>0?'RECHARGING...':ammo[active]?'ENERGY CELL LOADED':'PRESS R TO RELOAD';$('reload-fill').style.width=(reloadRemaining>0?(1-reloadRemaining/w.reload)*100:100)+'%';$('hud-xp').textContent=`LVL ${String(level).padStart(2,'0')} // ${xp} XP`;$('xp-fill').style.width=(xp/LEVEL_XP(level)*100)+'%';$('hud-mission').textContent=waveDelay>0?'SECTOR CLEARED // NEXT WAVE INCOMING':'ELIMINATE HOSTILE UNITS';
 $('crosshair').style.setProperty('--cyan',options.crosshair);$('crosshair').style.width=(40+recoil*80)+'px';$('crosshair').style.height=(40+recoil*80)+'px';}
function renderFrame(now){requestAnimationFrame(renderFrame);const delta=Math.min((now-lastFrame)/1000,.05);lastFrame=now;const rawFps=1/Math.max(.005,delta);fps=lerp(fps,rawFps,.07);if(options.fps)$('fps-counter').textContent=Math.round(fps)+' FPS';
 if(screen==='hud'){updateGame(delta);}else if(screen==='menu'||screen==='loading'){animTime+=delta;camera.position.set(Math.sin(animTime*.11)*23,12,35+Math.cos(animTime*.13)*8);camera.lookAt(0,3,0);}
 const rain=scene.userData.rain;if(rain?.visible && screen!=='pause'&&screen!=='dialog'&&screen!=='results'){const a=rain.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i+1]-=delta*17;if(a[i+1]<0)a[i+1]=32;}rain.geometry.attributes.position.needsUpdate=true;}
 if(scene.userData.holo&&(screen==='hud'||screen==='menu'))scene.userData.holo.rotation.y+=delta*.15;
 if(qualityPost)composer.render();else renderer.render(scene,camera);
}
const CONTROL_ROWS=[['MOVE','W / A / S / D'],['AIM','MOUSE / RIGHT-SIDE TOUCH DRAG'],['FIRE','LEFT CLICK / FIRE BUTTON'],['SPRINT','SHIFT'],['JUMP','SPACE'],['CROUCH','CTRL OR C'],['RELOAD','R'],['SWITCH LOADOUT','1 / 2 / 3'],['PAUSE / RESUME','ESC'],['FULLSCREEN','⛶ HUD BUTTON']];
function dialogFrame(eyebrow,title,body){if(screen==='hud')pauseGame();returnFromDialog=screen==='dialog'?returnFromDialog:screen;showScreen('dialog');$('dialog-eyebrow').textContent=eyebrow;$('dialog-title').innerHTML=title;$('dialog-body').innerHTML=body;}
function closeDialog(){showScreen(returnFromDialog==='pause'?'pause':'menu');audio.update();}
function settingSelect(id,label,choices,value){return `<label class="field">${label}<select id="set-${id}">${choices.map(x=>`<option value="${x}" ${String(x)===String(value)?'selected':''}>${x}</option>`).join('')}</select></label>`;}
function settingRange(id,label,min,max,step,value){return `<label class="field">${label}<input type="range" id="set-${id}" min="${min}" max="${max}" step="${step}" value="${value}"><span id="out-${id}">${value}</span></label>`;}
function settingCheck(id,label,value){return `<label class="field">${label}<input type="checkbox" id="set-${id}" ${value?'checked':''}></label>`;}
function showSettings(){const unlock=Math.max(level,...highScores.map(x=>x.level||1),1),skins=['Ion Blue',...(unlock>=3?['Plasma Violet']:[]),...(unlock>=5?['Crimson Pulse']:[])];if(!skins.includes(options.skin))options.skin='Ion Blue';
 dialogFrame('OPERATIONS // CONFIGURATION','SYSTEM <em>SETTINGS</em>',`
 <div class="settings-grid"><div class="setting-group"><h3>01 / GRAPHICS</h3>${settingSelect('graphics','Quality preset',['Low','Medium','High'],options.graphics)}${settingCheck('shadows','Dynamic shadows',options.shadows)}${settingCheck('particles','Rain / particles',options.particles)}${settingRange('resolution','Resolution scale',.5,1,.1,options.resolution)}${settingCheck('fps','FPS counter',options.fps)}</div>
 <div class="setting-group"><h3>02 / AUDIO</h3>${settingRange('master','Master volume',0,1,.05,options.master)}${settingRange('music','Atmosphere',0,1,.05,options.music)}${settingRange('sfx','Sound effects',0,1,.05,options.sfx)}${settingCheck('mute','Mute all',options.mute)}</div>
 <div class="setting-group"><h3>03 / CONTROLS</h3>${settingRange('sensitivity','Look sensitivity',.3,3,.1,options.sensitivity)}${settingCheck('invertY','Invert vertical look',options.invertY)}<label class="field">Crosshair color <input type="color" id="set-crosshair" value="${options.crosshair}"></label></div>
 <div class="setting-group"><h3>04 / CUSTOMIZATION</h3>${settingSelect('skin','Loadout skin',skins,options.skin)}<p class="dialog-note">New visual skins unlock at levels 3 and 5. Settings are saved in this browser. On Low quality, bloom and shadows are disabled.</p></div></div><p class="dialog-note">Settings apply live; graphics presets automatically change rendering resolution and rain density.</p><button class="dialog-action" id="save-settings">SAVE AND RETURN ↗</button>`);
 Object.keys(DEFAULT).forEach(key=>{const el=$('set-'+key);if(!el)return;el.addEventListener('input',()=>{const value=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;options[key]=value;if($('out-'+key))$('out-'+key).textContent=Number(value).toFixed(key==='sensitivity'?1:2);if(key==='graphics'||key==='resolution'||key==='particles'||key==='shadows'||key==='fps')applyGraphics();if(key==='skin')rebuildWeapon();if(['master','music','sfx','mute'].includes(key))audio.update();store('settings',options);});});
 $('save-settings').onclick=()=>{store('settings',options);closeDialog();toast('CONFIGURATION SAVED');};
}
function showControls(){dialogFrame('FIELD MANUAL // KNOW YOUR SYSTEMS','HOW TO <em>PLAY</em>',`<p class="dialog-note">Survive five escalating waves of fictional training robots. Gain XP, switch energy emitters, take cover and keep your shield charged. Orange or flashing enemy cores signal an incoming energy pulse.</p><table class="controls-table">${CONTROL_ROWS.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><p class="dialog-note">CONTINUE resumes from a saved wave checkpoint. Local saves do not synchronize between browsers or devices.</p><button class="dialog-action" id="manual-back">ACKNOWLEDGED ↗</button>`);$('manual-back').onclick=closeDialog;}
function showLeaderboard(){dialogFrame('PERSONAL RECORDS // THIS DEVICE','LOCAL <em>LEADERBOARD</em>',`<p class="dialog-note">These scores belong only to this browser. There are no global rankings or online accounts.</p><table class="leaderboard-table"><thead><tr><th>#</th><th>DATE / RESULT</th><th>SCORE</th></tr></thead><tbody>${highScores.length?highScores.slice(0,10).map((s,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td>${new Date(s.when).toLocaleDateString()} — ${s.victory?'VICTORY':'WAVE '+s.wave}</td><td>${Number(s.score).toLocaleString()}</td></tr>`).join(''):'<tr><td colspan="3">No completed missions yet. Start playing to set a record.</td></tr>'}</tbody></table><p class="dialog-note">Achievements unlocked: ${Object.keys(achievements).length} / 4 · ${Object.values(achievements).map(x=>x.title).join(' · ')||'None yet'}</p><p class="dialog-note">Highest saved level: ${Math.max(level,...highScores.map(x=>x.level||1),1)} &nbsp; / &nbsp; Highest score: ${(highScores[0]?.score||0).toLocaleString()}</p><button class="dialog-action" id="records-back">RETURN ↗</button>`);$('records-back').onclick=closeDialog;}
$('start-btn').addEventListener('click',()=>startGame());$('continue-btn').addEventListener('click',()=>{if(checkpoint)startGame(checkpoint);});$('settings-btn').addEventListener('click',showSettings);$('how-btn').addEventListener('click',showControls);$('leaderboard-btn').addEventListener('click',showLeaderboard);$('dialog-close').addEventListener('click',closeDialog);
$('resume-btn').addEventListener('click',resumeGame);$('restart-btn').addEventListener('click',restartGame);$('quit-btn').addEventListener('click',quitToMenu);$('pause-settings').addEventListener('click',showSettings);$('pause-controls').addEventListener('click',showControls);$('retry-btn').addEventListener('click',restartGame);$('results-menu-btn').addEventListener('click',quitToMenu);$('hud-pause').addEventListener('click',pauseGame);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-shell').requestFullscreen();}catch{toast('Fullscreen is not available on this device.');}});
function lookBy(dx,dy){player.yaw-=dx*.0022*Number(options.sensitivity);player.pitch+=dy*.0022*Number(options.sensitivity)*(options.invertY?1:-1);player.pitch=clamp(player.pitch,-1.4,1.4);}
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&screen==='hud')e.preventDefault();
 if(e.code==='Escape'){if(screen==='dialog')closeDialog();else if(screen==='hud')pauseGame();else if(screen==='pause')resumeGame();return;}
 if(screen!=='hud')return;controls.keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyR')reloadWeapon();if(/^Digit[123]$/.test(e.code))switchWeapon(Number(e.code.at(-1))-1);
});document.addEventListener('keyup',e=>controls.keys.delete(e.code));window.addEventListener('blur',()=>{controls.keys.clear();controls.fire=false;if(screen==='hud')pauseGame();});
document.addEventListener('pointerlockchange',()=>{if(!mobile&&screen==='hud'&&document.pointerLockElement!==renderer.domElement)pauseGame();});
$('stage').addEventListener('pointerdown',e=>{if(screen!=='hud')return;if(mobile){return;}if(document.pointerLockElement!==renderer.domElement){lockPointer();return;}if(e.button===0){controls.fire=true;controls.firedOnce=false;}});
document.addEventListener('pointerup',e=>{if(e.button===0){controls.fire=false;controls.firedOnce=false;}});document.addEventListener('mousemove',e=>{if(screen==='hud'&&document.pointerLockElement===renderer.domElement&&!mobile)lookBy(e.movementX,e.movementY);});
document.addEventListener('contextmenu',e=>{if(screen==='hud')e.preventDefault();});
$('stage').addEventListener('touchstart',e=>{if(screen==='hud'&&mobile){for(const t of e.changedTouches){if(t.clientX>innerWidth*.38){aimTouch=t.identifier;lastTouchX=t.clientX;lastTouchY=t.clientY;break;}}}},{passive:true});
let aimTouch=null,lastTouchX=0,lastTouchY=0,stickPointer=null;
$('stage').addEventListener('touchmove',e=>{if(screen!=='hud'||!mobile)return;for(const t of e.changedTouches){if(t.identifier===aimTouch){lookBy((t.clientX-lastTouchX)*1.2,(t.clientY-lastTouchY)*1.2);lastTouchX=t.clientX;lastTouchY=t.clientY;e.preventDefault();}}},{passive:false});
$('stage').addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===aimTouch)aimTouch=null;});
$('joystick').addEventListener('pointerdown',e=>{stickPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);});
$('joystick').addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
function moveStick(e){const r=$('joystick').getBoundingClientRect(),x=clamp((e.clientX-r.left-r.width/2)/(r.width*.32),-1,1),y=clamp((e.clientY-r.top-r.height/2)/(r.height*.32),-1,1);controls.stickX=x;controls.stickY=y;$('stick-knob').style.transform=`translate(${x*37}px,${y*37}px)`;}
function releaseStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;controls.stickX=controls.stickY=0;$('stick-knob').style.transform='translate(0,0)';}
$('joystick').addEventListener('pointerup',releaseStick);$('joystick').addEventListener('pointercancel',releaseStick);
$('touch-fire').addEventListener('pointerdown',e=>{if(screen!=='hud')return;e.currentTarget.setPointerCapture(e.pointerId);controls.fire=true;controls.firedOnce=false;});const stopFire=()=>{controls.fire=false;controls.firedOnce=false;};$('touch-fire').addEventListener('pointerup',stopFire);$('touch-fire').addEventListener('pointercancel',stopFire);
$('touch-reload').addEventListener('pointerdown',e=>{e.preventDefault();reloadWeapon();});$('touch-weapon').addEventListener('pointerdown',e=>{e.preventDefault();switchWeapon((active+1)%3);});$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();controls.jump=true;});$('touch-jump').addEventListener('pointerup',()=>controls.jump=false);$('touch-jump').addEventListener('pointercancel',()=>controls.jump=false);
// Keep controls from sticking when the browser cancels a gesture.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='hud')pauseGame();});
function init(){buildArena();rebuildWeapon();resize();$('loading-progress').style.width='100%';$('loading-detail').textContent='Battlefield ready';setTimeout(()=>{showScreen('menu');audio.update();},250);requestAnimationFrame(renderFrame);}
try{init();}catch(error){console.error('Neon Strike initialization failed:',error);$('loading-detail').textContent='Renderer initialization failed. WebGL support is required.';}
