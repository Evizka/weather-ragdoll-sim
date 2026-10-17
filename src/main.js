import './style.css'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

// ---------- SCENE SETUP ----------
const canvas = document.getElementById('c')
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0b111e, 0.012)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.02, 1200)
camera.position.set(0, 2.2, 14)

// world environment map - simple gradient sky
const skyColorTop = new THREE.Color(0x1a2a4a)
const skyColorBottom = new THREE.Color(0x6b8cff)
scene.background = new THREE.Color(0x0a1220)

const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.4)
sunLight.position.set(60, 80, 40)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(2048,2048)
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 500
sunLight.shadow.camera.left = -120
sunLight.shadow.camera.right = 120
sunLight.shadow.camera.top = 120
sunLight.shadow.camera.bottom = -120
sunLight.shadow.bias = -0.0005
scene.add(sunLight)

const hemi = new THREE.HemisphereLight(0x8fbfff, 0x1a2a1a, 0.6)
scene.add(hemi)
const ambient = new THREE.AmbientLight(0xffffff, 0.35)
scene.add(ambient)

// ---------- PHYSICS ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) })
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.defaultContactMaterial.friction = 0.45
world.defaultContactMaterial.restitution = 0.15

const groundMat = new CANNON.Material('ground')
const groundContact = new CANNON.ContactMaterial(groundMat, groundMat, { friction:0.6, restitution:0.1 })
world.addContactMaterial(groundContact)

// Ground plane
const groundBody = new CANNON.Body({ mass:0, shape:new CANNON.Plane(), material: groundMat })
groundBody.quaternion.setFromEuler(-Math.PI/2,0,0)
world.addBody(groundBody)

// Visual ground
const groundGeo = new THREE.PlaneGeometry(600,600,120,120)
const groundPos = groundGeo.attributes.position
for(let i=0;i<groundPos.count;i++){
  const x = groundPos.getX(i), y = groundPos.getY(i)
  const h = Math.sin(x*0.02)*2.5 + Math.cos(y*0.015)*2.2 + Math.sin((x+y)*0.01)*1.5
  // crater / city flatten
  const dist = Math.sqrt(x*x + y*y)
  let flat = 1
  if(dist<110) flat = Math.max(0, (dist-30)/80)
  if(dist<30) flat = 0
  groundPos.setZ(i, h*flat)
}
groundGeo.computeVertexNormals()
const groundMatVisual = new THREE.MeshStandardMaterial({ color:0x1b2a45, roughness:0.95, metalness:0.02, flatShading:false })
const groundMesh = new THREE.Mesh(groundGeo, groundMatVisual)
groundMesh.rotation.x = -Math.PI/2
groundMesh.receiveShadow = true
scene.add(groundMesh)

// Second ground for city asphalt
const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(220,220), new THREE.MeshStandardMaterial({ color:0x0f1a2f, roughness:0.9 }))
cityFloor.rotation.x = -Math.PI/2
cityFloor.position.y = 0.08
cityFloor.receiveShadow = true
scene.add(cityFloor)
const gridHelper = new THREE.GridHelper(220, 22, 0x1e3a5f, 0x162a4a)
gridHelper.position.y = 0.09
scene.add(gridHelper)

// ---------- BUILDINGS & PROPS ----------
const buildingGroup = new THREE.Group()
scene.add(buildingGroup)
const buildingBodies = []
const debrisBodies = []
const debrisMeshes = []
const buildings = []

function createBuilding(x,z,w,d,h,color){
  const geo = new THREE.BoxGeometry(w,h,d)
  // add window emissive randomness via vertex colors? simple
  const mat = new THREE.MeshStandardMaterial({ color: color || 0x2a3a5a, roughness:0.7, metalness:0.15 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, h/2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  buildingGroup.add(mesh)
  // physics
  const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2))
  const body = new CANNON.Body({ mass:0, shape, position:new CANNON.Vec3(x,h/2,z) })
  world.addBody(body)
  buildingBodies.push(body)
  buildings.push({ mesh, body, w,d,h, x,z, originalY: h/2, color, broken:false })
  // windows
  if(Math.random()>0.3){
    const winGeo = new THREE.PlaneGeometry(w*0.8, h*0.75)
    const winMat = new THREE.MeshStandardMaterial({ color:0x7fb8ff, emissive:0x1a3a7a, emissiveIntensity:0.6, transparent:true, opacity:0.35, side:THREE.DoubleSide })
    const win = new THREE.Mesh(winGeo, winMat)
    win.position.set(x+0.01, h/2, z + d/2 + 0.02)
    // orient
    if(w<d){ win.rotation.y = Math.PI/2; win.position.set(x + w/2+0.02, h/2, z)}
    buildingGroup.add(win)
  }
}

// procedural city
const cityColors=[0x2e3e66,0x3a4a70,0x24324f,0x3a3f5c,0x2a3a54]
for(let i=0;i<42;i++){
  const angle = (i/42)*Math.PI*2 + (Math.random()*0.3)
  const radius = 35 + Math.random()*75
  const x = Math.cos(angle)*radius + (Math.random()-0.5)*12
  const z = Math.sin(angle)*radius + (Math.random()-0.5)*12
  const w = 6 + Math.random()*9
  const d = 6 + Math.random()*9
  const h = 9 + Math.random()*22 + (radius<50? 8:0)
  createBuilding(x,z,w,d,h, cityColors[i%cityColors.length])
}
// center plaza buildings
for(let i=0;i<8;i++){
  const x = (Math.random()-0.5)*40
  const z = (Math.random()-0.5)*40
  if(Math.sqrt(x*x+z*z)<15) continue
  createBuilding(x,z, 5+Math.random()*5, 5+Math.random()*5, 7+Math.random()*10, 0x1e2f4a)
}

// props / debris crates
function spawnDebris(n=30){
  for(let i=0;i<n;i++){
    const sx = 0.7+Math.random()*1.1, sy=0.7+Math.random()*1.1, sz=0.7+Math.random()*1.1
    const geo = new THREE.BoxGeometry(sx,sy,sz)
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.06+Math.random()*0.08, 0.5, 0.5), roughness:0.8 })
    const mesh = new THREE.Mesh(geo, mat)
    const x = (Math.random()-0.5)*140, z=(Math.random()-0.5)*140
    mesh.position.set(x, 1+Math.random()*6, z)
    mesh.castShadow=true
    mesh.receiveShadow=true
    scene.add(mesh)
    const shape=new CANNON.Box(new CANNON.Vec3(sx/2,sy/2,sz/2))
    const body=new CANNON.Body({ mass: 6+Math.random()*18, shape, position:new CANNON.Vec3(x, mesh.position.y, z) })
    body.angularDamping=0.35
    body.linearDamping=0.12
    world.addBody(body)
    debrisBodies.push(body)
    debrisMeshes.push({ mesh, body, sx,sy,sz })
  }
}
spawnDebris(64)

// cars
const carMeshes=[]
for(let i=0;i<18;i++){
  const geo=new THREE.BoxGeometry(2.2,1.2,4.2)
  const mat=new THREE.MeshStandardMaterial({ color: Math.random()>0.5?0x1e90ff:0xff3b30, roughness:0.4, metalness:0.3 })
  const mesh=new THREE.Mesh(geo, mat)
  const x=(Math.random()-0.5)*120, z=(Math.random()-0.5)*120
  mesh.position.set(x,0.7,z)
  mesh.rotation.y=Math.random()*Math.PI
  mesh.castShadow=true
  scene.add(mesh)
  const shape=new CANNON.Box(new CANNON.Vec3(1.1,0.6,2.1))
  const body=new CANNON.Body({ mass: 900, shape, position:new CANNON.Vec3(x,0.7,z) })
  body.quaternion.setFromEuler(0, mesh.rotation.y, 0)
  world.addBody(body)
  debrisBodies.push(body)
  debrisMeshes.push({ mesh, body, isCar:true })
  carMeshes.push({mesh,body})
}

// trees
function addTree(x,z){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.26,3.2,7), new THREE.MeshStandardMaterial({color:0x2b1d12}))
  trunk.position.set(x,1.6,z)
  trunk.castShadow=true
  scene.add(trunk)
  const leaves=new THREE.Mesh(new THREE.ConeGeometry(1.8,4.5,8), new THREE.MeshStandardMaterial({color:0x1d4a2a}))
  leaves.position.set(x,4.6,z)
  leaves.castShadow=true
  scene.add(leaves)
}
for(let i=0;i<70;i++){
  const a=Math.random()*Math.PI*2, r=85+Math.random()*120
  addTree(Math.cos(a)*r, Math.sin(a)*r)
}

// ---------- RAGDOLLS ----------
const ragdolls=[]
function createRagdoll(x,z){
  const group=new THREE.Group()
  const bodies=[]
  const meshes=[]
  const makePart=(shape, mass, pos, color, size)=>{
    const body=new CANNON.Body({ mass, shape, position:new CANNON.Vec3(pos.x,pos.y,pos.z) })
    body.linearDamping=0.12; body.angularDamping=0.22
    world.addBody(body)
    bodies.push(body)
    let mesh
    if(shape instanceof CANNON.Sphere){
      mesh=new THREE.Mesh(new THREE.SphereGeometry(shape.radius,12,10), new THREE.MeshStandardMaterial({color}))
    } else if(shape instanceof CANNON.Box){
      const he=shape.halfExtents
      mesh=new THREE.Mesh(new THREE.BoxGeometry(he.x*2,he.y*2,he.z*2), new THREE.MeshStandardMaterial({color}))
    } else if(shape instanceof CANNON.Cylinder){
      mesh=new THREE.Mesh(new THREE.CapsuleGeometry? new THREE.CapsuleGeometry(0.22,0.9,4,10) : new THREE.CylinderGeometry(0.22,0.22,1.1,8), new THREE.MeshStandardMaterial({color}))
    }
    mesh.castShadow=true
    scene.add(mesh)
    meshes.push({mesh,body})
    return body
  }
  // ragdoll parts approx
  const head = makePart(new CANNON.Sphere(0.38), 4, new THREE.Vector3(x,2.9,z), 0xffd6b8)
  const torso = makePart(new CANNON.Box(new CANNON.Vec3(0.42,0.58,0.26)), 12, new THREE.Vector3(x,1.95,z), 0x2e7bff)
  const lArm = makePart(new CANNON.Box(new CANNON.Vec3(0.14,0.42,0.14)), 3, new THREE.Vector3(x-0.62,1.95,z), 0xffd6b8)
  const rArm = makePart(new CANNON.Box(new CANNON.Vec3(0.14,0.42,0.14)), 3, new THREE.Vector3(x+0.62,1.95,z), 0xffd6b8)
  const lLeg = makePart(new CANNON.Box(new CANNON.Vec3(0.18,0.52,0.18)), 5, new THREE.Vector3(x-0.22,0.82,z), 0x1a2a4a)
  const rLeg = makePart(new CANNON.Box(new CANNON.Vec3(0.18,0.52,0.18)), 5, new THREE.Vector3(x+0.22,0.82,z), 0x1a2a4a)

  function connect(a,b, pivotA, pivotB){
    const c=new CANNON.PointToPointConstraint(a, pivotA, b, pivotB, 800)
    world.addConstraint(c)
  }
  connect(torso, head, new CANNON.Vec3(0,0.58,0), new CANNON.Vec3(0,-0.38,0))
  connect(torso, lArm, new CANNON.Vec3(-0.42,0.35,0), new CANNON.Vec3(0,0.42,0))
  connect(torso, rArm, new CANNON.Vec3(0.42,0.35,0), new CANNON.Vec3(0,0.42,0))
  connect(torso, lLeg, new CANNON.Vec3(-0.22,-0.58,0), new CANNON.Vec3(0,0.52,0))
  connect(torso, rLeg, new CANNON.Vec3(0.22,-0.58,0), new CANNON.Vec3(0,0.52,0))

  ragdolls.push({ bodies, meshes, torso })
  return { bodies, meshes }
}
for(let i=0;i<10;i++){
  createRagdoll((Math.random()-0.5)*60, (Math.random()-0.5)*60+10)
}

// ---------- CONTROLS ----------
const controls = new PointerLockControls(camera, document.body)
const centerPrompt = document.getElementById('center-prompt')
controls.addEventListener('lock', ()=> centerPrompt.classList.add('hidden'))
controls.addEventListener('unlock', ()=> centerPrompt.classList.remove('hidden'))
canvas.addEventListener('click', ()=> { if(!controls.isLocked) controls.lock() })

// player physics body (capsule approx via sphere)
const playerBody = new CANNON.Body({
  mass: 80,
  shape: new CANNON.Sphere(0.55),
  position: new CANNON.Vec3(0,3,8),
  fixedRotation: true,
  linearDamping: 0.05,
  material: new CANNON.Material('player')
})
world.addBody(playerBody)

// movement state
const keys={}
window.addEventListener('keydown', e=>{
  keys[e.code.toLowerCase()]=true
  if(e.code==='KeyT') setDisaster('tornado')
  if(e.code==='KeyG') setDisaster('storm')
  if(e.code==='KeyF') setDisaster('flood')
  if(e.code==='KeyE' && !e.repeat) triggerEarthquake()
  if(e.code==='KeyC') isCrouching = !isCrouching
  if(e.code==='Space' && canJump) { playerBody.velocity.y = 6.2; canJump=false }
})
window.addEventListener('keyup', e=> keys[e.code.toLowerCase()]=false)

let canJump=true
let isCrouching=false
let isSprinting=false
let stamina=100
let yaw=0, pitch=0
let moveSpeed=5.2

// mouse look is handled by controls, but we also need to read camera direction
// For physics sync we will simply set camera position = playerBody.position + offset

// ---------- WEATHER / DISASTERS ----------
let currentDisaster='clear'
let intensity=65
let windStrength=30
let destruction=80
let timeOfDay=0 // 0 day, 1 night

const windVector = new THREE.Vector3(1,0,0.3)
let tornadoPos = new THREE.Vector3(55,0,0)
let tornadoActive=false
let tornadoMesh=null
let tornadoParticles=null
let waterLevel = -2
let targetWaterLevel=-2
let isNight=false

// Rain system
const rainCount=9000
const rainGeo=new THREE.BufferGeometry()
const rainPositions=new Float32Array(rainCount*3)
for(let i=0;i<rainCount;i++){
  rainPositions[i*3]=(Math.random()-0.5)*420
  rainPositions[i*3+1]=Math.random()*140+10
  rainPositions[i*3+2]=(Math.random()-0.5)*420
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions,3))
const rainMat=new THREE.PointsMaterial({ color:0x9ec6ff, size:0.42, transparent:true, opacity:0, sizeAttenuation:true, depthWrite:false })
const rainPoints=new THREE.Points(rainGeo, rainMat)
scene.add(rainPoints)

// Snow system
const snowCount=7000
const snowGeo=new THREE.BufferGeometry()
const snowPos=new Float32Array(snowCount*3)
for(let i=0;i<snowCount;i++){
  snowPos[i*3]=(Math.random()-0.5)*400
  snowPos[i*3+1]=Math.random()*120+5
  snowPos[i*3+2]=(Math.random()-0.5)*400
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos,3))
const snowMat=new THREE.PointsMaterial({ color:0xffffff, size:0.9, transparent:true, opacity:0 })
const snowPoints=new THREE.Points(snowGeo, snowMat)
scene.add(snowPoints)

// Water plane
const waterGeo=new THREE.PlaneGeometry(600,600,80,80)
const waterMat=new THREE.MeshStandardMaterial({ color:0x0a2a55, transparent:true, opacity:0.0, roughness:0.15, metalness:0.4, emissive:0x052a7a, emissiveIntensity:0.15 })
const waterMesh=new THREE.Mesh(waterGeo, waterMat)
waterMesh.rotation.x=-Math.PI/2
waterMesh.position.y=waterLevel
scene.add(waterMesh)

// tornado funnel
function createTornado(){
  if(tornadoMesh) scene.remove(tornadoMesh)
  const height=36
  const segs=48
  const radial=20
  const geo=new THREE.BufferGeometry()
  const verts=[]
  const idx=[]
  const uvs=[]
  for(let y=0;y<=segs;y++){
    const t=y/segs
    const h=t*height
    const r= (1 - t*0.88)*7 + Math.sin(t*Math.PI*2)*0.2 // radius narrows top
    const twist = t* Math.PI*3.5
    for(let rI=0;rI<radial;rI++){
      const ang=(rI/radial)*Math.PI*2 + twist
      const x=Math.cos(ang)*r
      const z=Math.sin(ang)*r
      verts.push(x,h,z)
      uvs.push(rI/radial, t)
    }
  }
  for(let y=0;y<segs;y++){
    for(let rI=0;rI<radial;rI++){
      const a=y*radial + rI
      const b=y*radial + (rI+1)%radial
      const c=(y+1)*radial + (rI+1)%radial
      const d=(y+1)*radial + rI
      idx.push(a,b,c, a,c,d)
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mat=new THREE.MeshStandardMaterial({
    color:0x9fb4cf, transparent:true, opacity:0, side:THREE.DoubleSide,
    roughness:0.9, emissive:0x1a2a44, emissiveIntensity:0.2
  })
  tornadoMesh=new THREE.Mesh(geo, mat)
  tornadoMesh.position.copy(tornadoPos)
  tornadoMesh.frustumCulled=false
  scene.add(tornadoMesh)

  // debris swirl particles tornado
  if(tornadoParticles) scene.remove(tornadoParticles)
  const pGeo=new THREE.BufferGeometry()
  const pCount=900
  const pPos=new Float32Array(pCount*3)
  for(let i=0;i<pCount;i++){
    const ang=Math.random()*Math.PI*2
    const rad=Math.random()*7
    pPos[i*3]=Math.cos(ang)*rad
    pPos[i*3+1]=Math.random()*height
    pPos[i*3+2]=Math.sin(ang)*rad
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3))
  const pMat=new THREE.PointsMaterial({ color:0xcbd6ea, size:0.45, transparent:true, opacity:0 })
  tornadoParticles=new THREE.Points(pGeo,pMat)
  tornadoParticles.position.copy(tornadoPos)
  scene.add(tornadoParticles)
}
createTornado()

// lightning
const lightningLight=new THREE.PointLight(0xcfe8ff, 0, 300)
lightningLight.position.set(40,60,40)
scene.add(lightningLight)
let nextLightning=0

// fog / atmosphere helpers
function updateAtmosphere(){
  const isRain = ['rain','storm','hurricane','blizzard'].includes(currentDisaster)
  const isStormish = ['storm','hurricane'].includes(currentDisaster)
  // fog density
  let targetFog = 0.012
  if(currentDisaster==='clear') targetFog=0.008
  if(currentDisaster==='rain') targetFog=0.014
  if(currentDisaster==='storm') targetFog=0.018
  if(currentDisaster==='hurricane') targetFog=0.022
  if(currentDisaster==='blizzard') targetFog=0.025
  if(currentDisaster==='flood') targetFog=0.015
  if(currentDisaster==='tornado') targetFog=0.020
  scene.fog = new THREE.FogExp2(isNight?0x060a14: (isRain?0x0b152a:0x0b111e), targetFog)

  // background color lerp
  const bgDay = new THREE.Color(0xa8c6ff)
  const bgStorm = new THREE.Color(0x0a1220)
  const bgNight = new THREE.Color(0x02030a)
  const bgFlood = new THREE.Color(0x0a1d38)
  let targetBg = bgDay.clone()
  if(isRain || isStormish || currentDisaster==='tornado' || currentDisaster==='hurricane') targetBg=bgStorm
  if(isNight) targetBg=bgNight
  if(currentDisaster==='blizzard') targetBg=new THREE.Color(0x8ea0b8)
  if(currentDisaster==='flood') targetBg=bgFlood
  scene.background.lerp(targetBg, 0.03)
}

// ---------- UI BINDINGS ----------
const disasterCards=document.querySelectorAll('.disaster-card')
const intensityEl=document.getElementById('intensity')
const windEl=document.getElementById('wind-control')
const destrEl=document.getElementById('destruction')
const waterEl=document.getElementById('water-level')
intensityEl.addEventListener('input', e=>{ intensity=+e.target.value; document.getElementById('intensity-val').textContent=intensity+'%'; updateWarning() })
windEl.addEventListener('input', e=>{ windStrength=+e.target.value; document.getElementById('wind-val').textContent=windStrength+'%'; })
destrEl.addEventListener('input', e=>{ destruction=+e.target.value; document.getElementById('destr-val').textContent=destruction+'%' })
waterEl.addEventListener('input', e=>{
  const v=+e.target.value
  targetWaterLevel = -2 + v/100*8
  document.getElementById('water-val').textContent = (targetWaterLevel+2).toFixed(1)+' м'
})

disasterCards.forEach(card=>{
  card.addEventListener('click', ()=> setDisaster(card.dataset.disaster))
})

function setDisaster(name){
  currentDisaster=name
  disasterCards.forEach(c=> c.classList.toggle('active', c.dataset.disaster===name))
  // configure
  tornadoActive = (name==='tornado' || name==='hurricane')
  if(name==='flood') targetWaterLevel = -2 + intensity/100*7
  if(name==='clear'){ targetWaterLevel=-2; tornadoActive=false }
  if(name==='blizzard' || name==='rain' || name==='storm' || name==='hurricane'){} // keep
  updateWarning()
  // flash for storm
  if(name==='storm' || name==='hurricane'){
    nextLightning = performance.now()+ 800+ Math.random()*2000
  }
}

function updateWarning(){
  const el=document.getElementById('warning-text')
  const map={
    clear:'Система мониторинга активна. Атмосфера стабильна. Идеально для прогулки.',
    rain:'ВНИМАНИЕ: Сильный ливень. Улицы затопляет. Видимость снижена.',
    storm:'ОПАСНО: Грозовой фронт! Ожидаются удары молний. Укройтесь!',
    tornado:'КРИТИЧЕСКИ: Воронка торнадо зафиксирована! Ветер до 90 м/с. Объекты затягивает!',
    hurricane:'ЭКСТРЕННО: Ураган категории 4! Порывы 120 м/с. Здания под угрозой!',
    flood:'ТРЕВОГА: Уровень воды поднимается! Эвакуация низин! Физика плавучести активна.',
    earthquake:'ЗЕМЛЕТРЯСЕНИЕ: Магнитуда 7.4! Толчки разрушают конструкции!',
    blizzard:'БУРАН: Температура -18°, видимость 20м. Ветер сносит с ног.'
  }
  el.textContent= map[currentDisaster] || map.clear
  document.getElementById('weather-pill').textContent=
    ({clear:'⛅ ЯСНО', rain:'🌧️ ЛИВЕНЬ', storm:'⛈️ ГРОЗА', tornado:'🌪️ ТОРНАДО', hurricane:'🌀 УРАГАН', flood:'🌊 ПОТОП', earthquake:'🏚️ ЗЕМЛЕТРЯСЕНИЕ', blizzard:'❄️ БУРАН'}[currentDisaster]||'⛅ ЯСНО')
}

document.getElementById('btn-daynight').addEventListener('click', ()=>{
  isNight=!isNight
  sunLight.intensity = isNight? 0.12:1.4
  hemi.intensity = isNight?0.15:0.6
  ambient.intensity = isNight?0.15:0.35
})
document.getElementById('btn-reset').addEventListener('click', resetWorld)
document.getElementById('btn-ragdolls').addEventListener('click', ()=>{
  for(let i=0;i<4;i++) createRagdoll((Math.random()-0.5)*40, (Math.random()-0.5)*40)
})
document.getElementById('btn-explosion').addEventListener('click', ()=>{
  const p=playerBody.position
  triggerExplosion(p.x, p.y, p.z, 22)
})
document.getElementById('btn-wave').addEventListener('click', ()=>{
  // wave impulse: raise water then drop
  targetWaterLevel=4
  waterEl.value=75
  setTimeout(()=>{ targetWaterLevel=-2; waterEl.value=0; document.getElementById('water-val').textContent='0 м' }, 4200)
})

function triggerExplosion(x,y,z, radius=18){
  const bodies=[...debrisBodies, ...buildingBodies, ...ragdolls.flatMap(r=>r.bodies)]
  bodies.forEach(b=>{
    const dx=b.position.x-x, dy=b.position.y-y, dz=b.position.z-z
    const dist=Math.sqrt(dx*dx+dy*dy+dz*dz)
    if(dist<radius){
      const power=(1-dist/radius)* (180 + destruction*1.2)
      const dir=new CANNON.Vec3(dx, dy+1.2, dz)
      dir.normalize()
      dir.scale(power, dir)
      if(b.mass===0){
        // make building dynamic on big explosion if destruction high
        if(destruction>60 && Math.random()<0.45){
          // convert to dynamic: create debris from building
          b.mass=1200
          b.type=CANNON.Body.DYNAMIC
          b.updateMassProperties()
        } else {
          return
        }
      }
      b.applyImpulse(dir, b.position)
      b.applyForce(new CANNON.Vec3(0, power*0.6,0), b.position)
    }
  })
  // flash
  const flash=document.getElementById('flash')
  flash.classList.add('on')
  setTimeout(()=> flash.classList.remove('on'), 140)
  // particles
  // shockwave ring
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.8,radius,32), new THREE.MeshBasicMaterial({ color:0xff6a00, transparent:true, opacity:0.55, side:THREE.DoubleSide }))
  ring.position.set(x,y+0.2,z)
  ring.rotation.x=-Math.PI/2
  scene.add(ring)
  let t=0
  function animRing(){
    t+=0.03
    ring.scale.set(1+t*1.2,1+t*1.2,1)
    ring.material.opacity-=0.02
    if(ring.material.opacity>0) requestAnimationFrame(animRing)
    else scene.remove(ring)
  }
  animRing()
}

function triggerEarthquake(){
  setDisaster('earthquake')
  const duration=3600
  const start=performance.now()
  const intensityQ= 4+ destruction/25
  function quake(){
    const now=performance.now()
    const p=(now-start)/duration
    if(p>1) { updateWarning(); return }
    const mag=Math.sin(now*0.04)* intensityQ * (1-p*0.3)
    camera.position.x += (Math.random()-0.5)*0.35* intensityQ
    camera.position.y += (Math.random()-0.5)*0.18* intensityQ
    // shake bodies
    debrisBodies.forEach(b=>{
      b.applyImpulse(new CANNON.Vec3((Math.random()-0.5)*intensityQ*22, Math.random()*6, (Math.random()-0.5)*intensityQ*22), b.position)
    })
    ragdolls.forEach(r=> r.bodies.forEach(b=>{
      b.applyImpulse(new CANNON.Vec3((Math.random()-0.5)*40, Math.random()*30, (Math.random()-0.5)*40), b.position)
    }))
    // occasionally break buildings
    if(Math.random()<0.08 && destruction>50){
      const bld=buildings[Math.floor(Math.random()*buildings.length)]
      if(!bld.broken && Math.random()<0.5){
        bld.broken=true
        bld.body.mass=1500
        bld.body.type=CANNON.Body.DYNAMIC
        bld.body.updateMassProperties()
        bld.body.applyImpulse(new CANNON.Vec3((Math.random()-0.5)*900, 200, (Math.random()-0.5)*900), bld.body.position)
        bld.mesh.material.color.setHSL(0,0.5,0.25)
      }
    }
    requestAnimationFrame(quake)
  }
  quake()
}

function resetWorld(){
  // reset water
  targetWaterLevel=-2; waterLevel=-2; waterMesh.position.y=-2; waterMat.opacity=0
  waterEl.value=0; document.getElementById('water-val').textContent='0 м'
  // reset buildings if broken
  buildings.forEach(b=>{
    if(b.broken){
      b.broken=false
      b.body.mass=0; b.body.type=CANNON.Body.STATIC; b.body.updateMassProperties()
      b.body.position.set(b.x,b.originalY,b.z)
      b.body.velocity.set(0,0,0)
      b.body.angularVelocity.set(0,0,0)
      b.body.quaternion.set(0,0,0,1)
      b.mesh.position.set(b.x,b.originalY,b.z)
      b.mesh.quaternion.set(0,0,0,1)
      b.mesh.material.color.setHex(b.color)
    }
  })
  // reset debris
  debrisMeshes.forEach((d,i)=>{
    const b=d.body
    b.position.set((Math.random()-0.5)*120, 2+Math.random()*4, (Math.random()-0.5)*120)
    b.velocity.set(0,0,0)
    b.angularVelocity.set(0,0,0)
  })
  // reset ragdolls
  ragdolls.forEach(r=>{
    // remove old
    r.bodies.forEach(b=> world.removeBody(b))
    r.meshes.forEach(m=> scene.remove(m.mesh))
  })
  ragdolls.length=0
  for(let i=0;i<8;i++) createRagdoll((Math.random()-0.5)*50,(Math.random()-0.5)*50)
  setDisaster('clear')
  playerBody.position.set(0,3,8)
  playerBody.velocity.set(0,0,0)
}

// ---------- CLOUDS (fake with planes) ----------
const cloudGroup=new THREE.Group()
scene.add(cloudGroup)
for(let i=0;i<16;i++){
  const geo=new THREE.PlaneGeometry(50+Math.random()*80, 22+Math.random()*18)
  const mat=new THREE.MeshStandardMaterial({ color:0xffffff, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false })
  const m=new THREE.Mesh(geo, mat)
  m.position.set((Math.random()-0.5)*380, 55+Math.random()*18, (Math.random()-0.5)*380)
  m.rotation.z=Math.random()*0.2
  cloudGroup.add(m)
}

// ---------- LIGHTNING GENERATOR ----------
function spawnLightning(){
  // flash
  const flash=document.getElementById('flash')
  flash.classList.add('on')
  setTimeout(()=> flash.classList.remove('on'), 110)
  lightningLight.intensity= 18 + Math.random()*10
  lightningLight.distance= 420
  lightningLight.position.set((Math.random()-0.5)*140, 55, (Math.random()-0.5)*140)
  setTimeout(()=> lightningLight.intensity=0, 150+Math.random()*90)
  // thunder shake and sound via WebAudio
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)()
    const o=ctx.createOscillator()
    const g=ctx.createGain()
    o.type='triangle'
    o.frequency.value= 45+Math.random()*30
    g.gain.value=0.6
    o.connect(g); g.connect(ctx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+1.2)
    setTimeout(()=>{ o.stop(); ctx.close() },1300)
  }catch(e){}
  // create bolt line
  const points=[]
  const start=new THREE.Vector3(lightningLight.position.x, 56, lightningLight.position.z)
  const end=new THREE.Vector3(start.x + (Math.random()-0.5)*18, 0, start.z + (Math.random()-0.5)*18)
  const segments=10
  for(let i=0;i<=segments;i++){
    const t=i/segments
    const p=new THREE.Vector3().lerpVectors(start,end,t)
    p.x += (Math.random()-0.5)*4*(1-Math.abs(t-0.5)*1.5)
    p.z += (Math.random()-0.5)*4*(1-Math.abs(t-0.5)*1.5)
    points.push(p)
  }
  const geo=new THREE.BufferGeometry().setFromPoints(points)
  const mat=new THREE.LineBasicMaterial({ color:0xc8e6ff, transparent:true, opacity:0.95 })
  const line=new THREE.Line(geo,mat)
  line.frustumCulled=false
  scene.add(line)
  setTimeout(()=> scene.remove(line), 140)

  // explosion-like push near strike
  triggerExplosion(end.x, 1, end.z, 14)
}

// ---------- MAIN LOOP ----------
let lastTime=performance.now()
let fps=60, frameCount=0, lastFpsTime=performance.now()
const windForce = new CANNON.Vec3()

function animate(){
  requestAnimationFrame(animate)
  const now=performance.now()
  const dt=Math.min(0.033, (now-lastTime)/1000)
  lastTime=now

  // FPS counter
  frameCount++
  if(now-lastFpsTime>520){
    fps=Math.round(frameCount*1000/(now-lastFpsTime))
    document.getElementById('fps-pill').textContent=fps+' FPS'
    lastFpsTime=now; frameCount=0
    document.getElementById('obj-count').textContent=`Объектов: ${debrisMeshes.length + buildings.length + ragdolls.length*6}`
  }

  // input movement
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward); forward.y=0; forward.normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).negate()
  // Actually right = forward cross up
  // fix: compute correctly
  // Let's recompute: right = forward x up
  // forward x up = (-forward.z,0, forward.x) ?

  let moveX=0, moveZ=0
  if(keys['keyw']) moveZ+=1
  if(keys['keys']) moveZ-=1
  if(keys['keya']) moveX-=1
  if(keys['keyd']) moveX+=1
  isSprinting = !!keys['shiftleft'] || !!keys['shiftright']
  const sprintMult = isSprinting && stamina>0 ? 1.65 : 1
  if(isSprinting && (moveX||moveZ)) stamina=Math.max(0, stamina-22*dt)
  else stamina=Math.min(100, stamina+28*dt)
  document.getElementById('stamina-bar').style.width=stamina+'%'

  const inputDir=new THREE.Vector3()
  // movement relative to camera yaw
  // get yaw from camera quaternion
  const camDir=new THREE.Vector3()
  camera.getWorldDirection(camDir)
  const yawAngle=Math.atan2(camDir.x, camDir.z)
  // compute forward/right correctly
  const fwd=new THREE.Vector3(Math.sin(yawAngle),0,Math.cos(yawAngle))
  const rgt=new THREE.Vector3(Math.sin(yawAngle+Math.PI/2),0,Math.cos(yawAngle+Math.PI/2))

  inputDir.addScaledVector(fwd, moveZ)
  inputDir.addScaledVector(rgt, moveX)
  if(inputDir.length()>0) inputDir.normalize()

  const targetSpeed = inputDir.length()>0 ? moveSpeed * sprintMult * (isCrouching?0.55:1) : 0
  const accel= inputDir.clone().multiplyScalar(targetSpeed)

  // apply to playerBody velocity (xz), preserve y
  const vx=playerBody.velocity.x
  const vz=playerBody.velocity.z
  // lerp velocity toward desired
  const lerp= 11*dt
  playerBody.velocity.x += (accel.x - vx)*lerp
  playerBody.velocity.z += (accel.z - vz)*lerp

  // ground check simple: if y <0.95 then on ground
  const onGround = playerBody.position.y < 1.05
  if(onGround && playerBody.velocity.y < 0.2) canJump=true
  if(!onGround){
    // air control slightly reduced, gravity already
  }

  // crouch changes camera offset
  const desiredHeight = isCrouching ? 0.9 : 1.75
  // step physics
  world.step(1/60, dt, 4)

  // sync camera
  const eyeOffset = new THREE.Vector3(0, desiredHeight, 0)
  camera.position.copy(playerBody.position).add(eyeOffset)
  // keep controls object synced
  controls.getObject().position.copy(camera.position)

  // collisions: push player out of ground if below
  if(playerBody.position.y<0.6){
    playerBody.position.y=0.6
    playerBody.velocity.y=0
  }

  // sync debris meshes
  debrisMeshes.forEach(d=>{
    d.mesh.position.copy(d.body.position)
    d.mesh.quaternion.copy(d.body.quaternion)
  })
  buildings.forEach(b=>{
    if(b.broken){
      b.mesh.position.copy(b.body.position)
      b.mesh.quaternion.copy(b.body.quaternion)
    }
  })
  ragdolls.forEach(r=>{
    r.meshes.forEach(m=>{ m.mesh.position.copy(m.body.position); m.mesh.quaternion.copy(m.body.quaternion) })
  })

  // update weather particles
  const rainActive = ['rain','storm','hurricane'].includes(currentDisaster)
  const snowActive = currentDisaster==='blizzard'
  const stormActive = currentDisaster==='storm' || currentDisaster==='hurricane'
  // animate clouds
  cloudGroup.children.forEach((c,i)=>{
    c.position.x += (0.4 + intensity/140)*dt * (i%2?1:-1)
    if(c.position.x>200) c.position.x=-200
    if(c.position.x<-200) c.position.x=200
    c.material.opacity = THREE.MathUtils.lerp(c.material.opacity, currentDisaster==='clear'?0.08:0.32, dt*1.5)
    c.lookAt(camera.position)
  })

  // rain update
  if(rainActive){
    rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, 0.62 + intensity/250, dt*3)
    const posAttr=rainGeo.attributes.position
    const arr=posAttr.array
    const fallSpeed = 42 + intensity*0.28
    const windX = windVector.x * (windStrength/28) + (tornadoActive? Math.sin(now*0.001)*1.1:0)
    const windZ = windVector.z * (windStrength/28)
    for(let i=0;i<rainCount;i++){
      let y=arr[i*3+1]
      y -= fallSpeed*dt * (0.7+ Math.random()*0.3)
      arr[i*3] += (windX + (Math.random()-0.5)*0.6)* dt *12
      arr[i*3+2] += windZ*dt*12
      if(y<0.2){
        y= 70+Math.random()*70
        arr[i*3]=(Math.random()-0.5)*420 + camera.position.x*0.22
        arr[i*3+2]=(Math.random()-0.5)*420 + camera.position.z*0.22
      }
      arr[i*3+1]=y
    }
    posAttr.needsUpdate=true
  } else {
    rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, 0, dt*2)
  }

  // snow update
  if(snowActive){
    snowMat.opacity = THREE.MathUtils.lerp(snowMat.opacity, 0.78, dt*3)
    const posAttr=snowGeo.attributes.position
    const arr=posAttr.array
    const fall= 3.2 + intensity*0.04
    for(let i=0;i<snowCount;i++){
      arr[i*3+1] -= fall*dt * (0.6+Math.random()*0.6)
      arr[i*3] += Math.sin(now*0.001 + i)*0.8 *dt*6 + windVector.x*0.3*dt*6
      arr[i*3+2] += Math.cos(now*0.001 + i*0.7)*0.8 *dt*6
      if(arr[i*3+1]<0.3){
        arr[i*3+1]= 60+Math.random()*60
        arr[i*3]=(Math.random()-0.5)*340 + camera.position.x*0.3
        arr[i*3+2]=(Math.random()-0.5)*340 + camera.position.z*0.3
      }
    }
    posAttr.needsUpdate=true
  } else {
    snowMat.opacity = THREE.MathUtils.lerp(snowMat.opacity, 0, dt*2)
  }

  // tornado update
  if(tornadoActive){
    // move tornado slowly around center, circle path
    const speed = 0.18 + intensity*0.004
    const t=now*0.00022 * speed*6
    tornadoPos.x = Math.cos(t)*55 + Math.sin(t*0.7)*12
    tornadoPos.z = Math.sin(t)*42 + Math.cos(t*1.3)*10
    tornadoPos.y=0
    if(tornadoMesh){
      tornadoMesh.position.lerp(tornadoPos, dt*0.7)
      tornadoMesh.position.y=0
      tornadoMesh.rotation.y += dt*1.9
      tornadoMesh.material.opacity = THREE.MathUtils.lerp(tornadoMesh.material.opacity, 0.62, dt*1.2)
      // scale pulse
      const s=1+ Math.sin(now*0.003)*0.03
      tornadoMesh.scale.set(s,1,s)
    }
    if(tornadoParticles){
      tornadoParticles.position.copy(tornadoMesh.position)
      tornadoParticles.rotation.y -= dt*2.2
      tornadoParticles.material.opacity = 0.55
      const pArr=tornadoParticles.geometry.attributes.position.array
      for(let i=0;i<pArr.length/3;i++){
        // swirl up
        const y=pArr[i*3+1]
        pArr[i*3+1] += dt*7
        if(pArr[i*3+1]>36) pArr[i*3+1]=0.2
        // orbit
        const ang=Math.atan2(pArr[i*3+2], pArr[i*3]) + dt*3.0
        const rad=Math.sqrt(pArr[i*3]**2 + pArr[i*3+2]**2)
        const newRad= THREE.MathUtils.lerp(rad, (1 - pArr[i*3+1]/36)*6 +0.4, dt*2)
        pArr[i*3]=Math.cos(ang)*newRad
        pArr[i*3+2]=Math.sin(ang)*newRad
      }
      tornadoParticles.geometry.attributes.position.needsUpdate=true
    }
    // physics forces
    const center=new CANNON.Vec3(tornadoPos.x,0,tornadoPos.z)
    const allBodies=[...debrisBodies, ...ragdolls.flatMap(r=>r.bodies), playerBody]
    // include cars etc already in debrisBodies
    allBodies.forEach(b=>{
      const dx=center.x - b.position.x
      const dz=center.z - b.position.z
      const distXZ=Math.sqrt(dx*dx+dz*dz)
      if(distXZ < 62){
        const pull = (1 - distXZ/62) * (22 + intensity*0.55)
        const tangentialX = -dz
        const tangentialZ = dx
        const len=Math.sqrt(tangentialX*tangentialX+tangentialZ*tangentialZ) ||1
        const upForce = (62-distXZ)/10 * (5+ intensity*0.12)
        // apply
        b.applyForce(new CANNON.Vec3(
          (dx/distXZ)*pull*0.55 + (tangentialX/len)*pull*1.25,
          upForce* b.mass*0.45 + (distXZ<10? 28*b.mass*0.18:0),
          (dz/distXZ)*pull*0.55 + (tangentialZ/len)*pull*1.25
        ), b.position)
        // add torque
        b.angularVelocity.x += (Math.random()-0.5)*0.6
        b.angularVelocity.z += (Math.random()-0.5)*0.6
      }
    })
    // also affect broken buildings
    buildingBodies.forEach(b=>{
      if(b.mass===0) return
      const dx=center.x - b.position.x, dz=center.z - b.position.z
      const d=Math.sqrt(dx*dx+dz*dz)
      if(d<48) b.applyForce(new CANNON.Vec3(dx/d*4200, 900, dz/d*4200), b.position)
    })
    // wind HUD
    document.getElementById('wind-pill').textContent=`Ветер ${Math.round(62+intensity*0.8)} м/с`
  } else {
    if(tornadoMesh) tornadoMesh.material.opacity = THREE.MathUtils.lerp(tornadoMesh.material.opacity, 0, dt*1.8)
    if(tornadoParticles) tornadoParticles.material.opacity = THREE.MathUtils.lerp(tornadoParticles.material.opacity, 0, dt*1.8)
    if(currentDisaster==='clear') document.getElementById('wind-pill').textContent=`Ветер ${Math.round(windStrength*0.28)} м/с`
    else document.getElementById('wind-pill').textContent=`Ветер ${Math.round(8+intensity*0.42 + windStrength*0.2)} м/с`
  }

  // hurricane wind (directional)
  if(currentDisaster==='hurricane'){
    windVector.set(1+Math.sin(now*0.0004)*0.3,0.12,0.45)
    const hForce = 18 + intensity*0.22
    debrisBodies.forEach(b=>{
      b.applyForce(new CANNON.Vec3(windVector.x*hForce* b.mass*0.06, Math.random()*2, windVector.z*hForce* b.mass*0.06), b.position)
    })
    ragdolls.forEach(r=> r.bodies.forEach(b=>{
      b.applyForce(new CANNON.Vec3(windVector.x*18, 1.2, windVector.z*18), b.position)
    }))
    // lean trees? camera shake
    camera.rotation.z = Math.sin(now*0.002)*0.02 + Math.sin(now*0.007)*0.01
  } else {
    camera.rotation.z *= 0.92
  }

  // water update
  waterLevel = THREE.MathUtils.lerp(waterLevel, targetWaterLevel, dt*0.45)
  waterMesh.position.y = waterLevel
  // wave deformation
  const wPos=waterGeo.attributes.position
  for(let i=0;i<wPos.count;i++){
    const x=wPos.getX(i), y=wPos.getY(i)
    const wave = Math.sin(x*0.03 + now*0.0016)*0.6 + Math.cos(y*0.035 + now*0.0011)*0.6 + Math.sin((x+y)*0.015 + now*0.0013)*0.45
    wPos.setZ(i, wave * (currentDisaster==='flood'|| currentDisaster==='hurricane'? 1.8 : 0.45))
  }
  wPos.needsUpdate=true
  waterGeo.computeVertexNormals()
  if(waterLevel>-1.2){
    waterMat.opacity = THREE.MathUtils.lerp(waterMat.opacity, 0.82, dt*1.4)
  } else {
    waterMat.opacity = THREE.MathUtils.lerp(waterMat.opacity, 0, dt*1.4)
  }
  // buoyancy
  if(waterLevel>-1.5){
    const all=[...debrisBodies, ...ragdolls.flatMap(r=>r.bodies), playerBody]
    all.forEach(b=>{
      const depth = waterLevel - b.position.y
      if(depth> -0.8){
        const buoyant = Math.max(0, depth+0.8) * 18 * b.mass
        b.applyForce(new CANNON.Vec3(0, buoyant, 0), b.position)
        b.linearDamping=0.45
        // drift with water flow
        b.applyForce(new CANNON.Vec3(windVector.x*2,0, windVector.z*2), b.position)
      } else {
        b.linearDamping=0.12
      }
    })
  }

  // storm lightning timing
  if(stormActive && now>nextLightning){
    spawnLightning()
    nextLightning = now + 900 + Math.random()*3200 * (1 - intensity/130)
  }

  // temperature/humidity simulation
  const tempMap={ clear:22, rain:16, storm:14, tornado:18, hurricane:19, flood:17, earthquake:24, blizzard:-14 }
  const humMap={ clear:45, rain:92, storm:88, tornado:62, hurricane:85, flood:95, earthquake:35, blizzard:78 }
  const pressMap={ clear:760, rain:742, storm:728, tornado:710, hurricane:698, flood:745, earthquake:762, blizzard:755 }
  document.getElementById('temp-val').textContent=(tempMap[currentDisaster] + Math.round(Math.sin(now*0.0006)*2))+'°'
  document.getElementById('hum-val').textContent=humMap[currentDisaster]+'%'
  document.getElementById('press-val').textContent=pressMap[currentDisaster]+' мм'
  document.getElementById('vis-val').textContent= ({clear:'10 км', rain:'3.2 км', storm:'1.8 км', tornado:'0.6 км', hurricane:'0.9 км', flood:'4 км', earthquake:'7 км', blizzard:'0.08 км'}[currentDisaster]||'10 км')

  // speed/alt
  const speedKmh=Math.round(Math.sqrt(playerBody.velocity.x**2+playerBody.velocity.z**2)*3.6)
  document.getElementById('speed-val').textContent=speedKmh+' км/ч'
  document.getElementById('alt-val').textContent= playerBody.position.y.toFixed(1)+' м'

  updateAtmosphere()

  // subtle camera bob when moving
  if(inputDir.length()>0 && onGround){
    camera.position.y += Math.sin(now*0.012* (isSprinting?1.6:1))*0.04
  }

  renderer.render(scene,camera)
}
animate()

// resize
window.addEventListener('resize', ()=>{
  camera.aspect=window.innerWidth/window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth,window.innerHeight)
})

// hide loader after short delay
setTimeout(()=>{
  document.getElementById('loader').classList.add('hidden')
  // gentle intro: sun animate
  let t=0
  const intro=setInterval(()=>{
    t+=0.04
    sunLight.intensity= 1.4 + Math.sin(t)*0.04
    if(t>1) clearInterval(intro)
  },16)
}, 1300)

// Mobile joystick fallback: if not pointer lock supported, allow touch drag to look
let touchActive=false, lastTouchX=0, lastTouchY=0
canvas.addEventListener('touchstart', e=>{
  touchActive=true
  lastTouchX=e.touches[0].clientX
  lastTouchY=e.touches[0].clientY
},{passive:false})
canvas.addEventListener('touchmove', e=>{
  if(!touchActive) return
  const dx=e.touches[0].clientX-lastTouchX
  const dy=e.touches[0].clientY-lastTouchY
  lastTouchX=e.touches[0].clientX; lastTouchY=e.touches[0].clientY
  // emulate look: rotate camera via controls
  // fallback: directly rotate camera
  camera.rotation.y -= dx*0.004
  camera.rotation.x -= dy*0.004
  camera.rotation.x=Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, camera.rotation.x))
  e.preventDefault()
},{passive:false})
canvas.addEventListener('touchend', ()=> touchActive=false)

// panel toggle for mobile
document.getElementById('menu-toggle').addEventListener('click', ()=>{
  const p=document.getElementById('left-panel')
  p.style.display= p.style.display==='none'? 'flex':'none'
})

// expose for console
window._sim={ setDisaster, triggerExplosion, triggerEarthquake, playerBody, world }

