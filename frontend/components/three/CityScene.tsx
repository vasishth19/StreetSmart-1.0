'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { LightBeams } from './LightBeams';

function createWindowTexture(floors: number, cols: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width  = cols * 14;
  canvas.height = floors * 18;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#04080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.38) {
        const r = Math.random();
        const color = r < 0.5  ? `rgba(255,238,170,${0.55+Math.random()*0.4})`
                    : r < 0.8  ? `rgba(170,215,255,${0.5+Math.random()*0.4})`
                    :             `rgba(255,195,90,${0.45+Math.random()*0.35})`;
        const x = c * 14 + 2;
        const y = f * 18 + 3;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 9, 12);
      }
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function Building({ position, height, width, depth }: {
  position:[number,number,number]; height:number; width:number; depth:number;
}) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return createWindowTexture(Math.max(3, Math.floor(height * 2.5)), Math.max(2, Math.floor(width * 2)));
  }, [height, width]);

  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({
    color:'#050b14', emissive:'#010306', emissiveIntensity:0.04, metalness:0.65, roughness:0.35,
  }), []);

  const facadeMat = useMemo(() => !texture ? baseMat : new THREE.MeshStandardMaterial({
    map:texture, emissiveMap:texture, emissive:new THREE.Color(1,1,1),
    emissiveIntensity:0.35, metalness:0.5, roughness:0.5,
  }), [texture, baseMat]);

  const mats = useMemo(() => [baseMat, baseMat, baseMat, baseMat, facadeMat, facadeMat], [baseMat, facadeMat]);

  return (
    <mesh position={[position[0], position[1]+height/2, position[2]]} material={mats}>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  );
}

function Antenna({ position }: { position:[number,number,number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(s => {
    if (ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(s.clock.elapsedTime*3)*1.2;
  });
  return (
    <>
      <mesh position={[position[0], position[1]+0.9, position[2]]}>
        <cylinderGeometry args={[0.035, 0.035, 1.8, 5]} />
        <meshStandardMaterial color="#151f2e" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh ref={ref} position={[position[0], position[1]+2.0, position[2]]}>
        <sphereGeometry args={[0.09, 7, 7]} />
        <meshStandardMaterial emissive="#FF3030" emissiveIntensity={2} color="#FF2020" />
      </mesh>
    </>
  );
}

function SpireTower({ position }: { position: [number, number, number] }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const height = 26;
  useFrame((s) => {
    if (beaconRef.current) {
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.4 + Math.sin(s.clock.elapsedTime * 2.2) * 1.1;
    }
  });
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return createWindowTexture(70, 8);
  }, []);
  const facadeMat = useMemo(
    () =>
      texture
        ? new THREE.MeshStandardMaterial({
            map: texture, emissiveMap: texture, emissive: new THREE.Color(1, 1, 1),
            emissiveIntensity: 0.4, metalness: 0.55, roughness: 0.4,
          })
        : new THREE.MeshStandardMaterial({ color: '#050b14', metalness: 0.6, roughness: 0.35 }),
    [texture]
  );
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} material={facadeMat}>
        <cylinderGeometry args={[1.6, 2.6, height, 4]} />
      </mesh>
      <mesh position={[0, height + 3, 0]}>
        <cylinderGeometry args={[0.05, 0.12, 6, 6]} />
        <meshStandardMaterial color="#151f2e" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh ref={beaconRef} position={[0, height + 6.2, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial emissive="#00E5FF" emissiveIntensity={1.6} color="#00E5FF" />
      </mesh>
    </group>
  );
}

function RoadLights() {
  const pts = useMemo(() => {
    const l: {x:number,z:number,id:string}[] = [];
    for (let x=-18; x<=18; x+=7) for (let z=-18; z<=18; z+=7) l.push({x,z,id:`${x}-${z}`});
    return l;
  }, []);
  return <>{pts.map(l=>(
    <mesh key={l.id} position={[l.x,0.08,l.z]}>
      <sphereGeometry args={[0.06,5,5]}/>
      <meshStandardMaterial emissive="#FFC060" emissiveIntensity={2} color="#FFC060"/>
    </mesh>
  ))}</>;
}

function CityParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 70;
  const positions = useMemo(()=>{
    const a = new Float32Array(count*3);
    for(let i=0;i<count;i++){a[i*3]=(Math.random()-.5)*50;a[i*3+1]=2+Math.random()*18;a[i*3+2]=(Math.random()-.5)*50;}
    return a;
  },[]);
  useFrame(s=>{if(ref.current)ref.current.rotation.y=s.clock.elapsedTime*0.008;});
  const geo = useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return g;},[positions]);
  return <points ref={ref} geometry={geo}><pointsMaterial color="#8ab8d8" size={0.04} transparent opacity={0.28} sizeAttenuation/></points>;
}

function AutoCamera() {
  useFrame((s) => {
    const cam = s.camera;
    const cycle = 46; // seconds for one full cinematic loop
    const t = (s.clock.elapsedTime % cycle) / cycle; // 0 → 1
    // ease in/out so the descent doesn't feel linear/robotic
    const ease = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);

    // Wide, high establishing orbit that swoops down and in toward the
    // spire, then rises back out — a continuous, seamless loop.
    const radius = 34 - ease * 14;
    const angle = t * Math.PI * 2 * 0.6 + Math.PI * 0.15;
    const height = 20 - ease * 10 + Math.sin(t * Math.PI * 4) * 0.6;

    cam.position.x = Math.sin(angle) * radius;
    cam.position.z = Math.cos(angle) * radius;
    cam.position.y = height;

    // subtle handheld-drone drift + banking roll for a realistic feel
    const drift = Math.sin(s.clock.elapsedTime * 0.4) * 0.15;
    cam.up.set(Math.sin(drift), Math.cos(drift), 0);
    cam.lookAt(0, 6 + Math.sin(t * Math.PI * 2) * 1.5, 0);
  });
  return null;
}

function SceneContent() {
  const {buildings, antennas} = useMemo(()=>{
    const b:any[]=[],a:any[]=[];
    for(let x=-22;x<=22;x+=3.5){
      for(let z=-22;z<=22;z+=3.5){
        if(Math.random()>0.2 && Math.hypot(x-0, z-(-2))>4.5){
          const sky=Math.random()>.75, tall=Math.random()>.5;
          const h=sky?12+Math.random()*18:tall?6+Math.random()*8:2+Math.random()*4;
          const w=1.1+Math.random()*1.7, d=1.1+Math.random()*1.7;
          const px=x+(Math.random()-.5)*1.2, pz=z+(Math.random()-.5)*1.2;
          b.push({id:`${x}-${z}`,pos:[px,0,pz] as [number,number,number],height:h,width:w,depth:d});
          if(h>13&&Math.random()>.45) a.push({id:`ant-${x}-${z}`,pos:[px,h,pz] as [number,number,number]});
        }
      }
    }
    return {buildings:b,antennas:a};
  },[]);

  return (
    <>
      <ambientLight intensity={0.1} color="#000c18"/>
      <directionalLight position={[15,30,10]} intensity={0.3} color="#a8c8f0"/>
      <pointLight position={[0,1,0]}    intensity={0.9} color="#FFC060" distance={45}/>
      <pointLight position={[-14,2,-14]} intensity={0.45} color="#00C8E8" distance={28}/>
      <pointLight position={[14,2,14]}  intensity={0.45} color="#00E880" distance={28}/>
      <pointLight position={[14,2,-14]} intensity={0.35} color="#E83030" distance={22}/>
      <pointLight position={[-14,2,14]} intensity={0.35} color="#9060C0" distance={22}/>
      <pointLight position={[0,35,0]}   intensity={0.5}  color="#001428" distance={80}/>

      <Stars radius={120} depth={60} count={2500} factor={2.5} saturation={0.08} fade speed={0.15}/>
      <gridHelper args={[80,40,'#081828','#050f1a']} position={[0,-0.05,0]}/>
      <RoadLights/>
      <CityParticles/>
      <SpireTower position={[0, 0, -2]} />
      <LightBeams />

      {buildings.map(b=>(
        <Building key={b.id} position={b.pos} height={b.height} width={b.width} depth={b.depth}/>
      ))}
      {antennas.map(a=>(<Antenna key={a.id} position={a.pos}/>))}

      <Float speed={0.7} floatIntensity={1.0}>
        <mesh position={[-7,10,-5]}>
          <sphereGeometry args={[0.15]}/>
          <meshStandardMaterial emissive="#00CCFF" emissiveIntensity={4} color="#00CCFF"/>
        </mesh>
      </Float>
      <Float speed={0.9} floatIntensity={1.2}>
        <mesh position={[9,7,7]}>
          <sphereGeometry args={[0.12]}/>
          <meshStandardMaterial emissive="#00FF88" emissiveIntensity={4} color="#00FF88"/>
        </mesh>
      </Float>

      <AutoCamera/>
    </>
  );
}

function CSSCityFallback() {
  const buildings = useMemo(()=>Array.from({length:30},(_,i)=>({
    id:i, left:`${2+(i%10)*10}%`, height:`${12+Math.random()*58}%`,
    width:`${4+Math.random()*4}%`, delay:`${Math.random()*2}s`,
  })),[]);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{background:'#020810'}}>
      <div className="absolute inset-0" style={{background:'linear-gradient(to bottom,#020810 0%,#040c1a 60%,#060e18 100%)' }}/>
      <div className="absolute inset-0 opacity-30" style={{backgroundImage:`linear-gradient(rgba(0,180,220,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,180,220,0.05) 1px,transparent 1px)`,backgroundSize:'40px 40px'}}/>
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-1">
        {buildings.map(b=>(
          <motion.div key={b.id} initial={{height:0}} animate={{height:b.height}}
            transition={{duration:1.8,delay:parseFloat(b.delay),ease:'easeOut'}}
            className="relative flex-shrink-0 overflow-hidden"
            style={{width:b.width,backgroundColor:'#060f1c',border:'1px solid #0a1622'}}>
            <div className="absolute inset-0 p-0.5 grid gap-0.5" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
              {Array.from({length:30}).map((_,wi)=>{
                const lit=Math.random()>.38;
                return <div key={wi} className="rounded-sm" style={{
                  backgroundColor:lit?(Math.random()>.5?'rgba(255,235,140,0.5)':'rgba(150,205,255,0.45)'):'transparent',
                  animation:lit?`wf ${2.5+Math.random()*4}s ease-in-out infinite`:'none',
                  animationDelay:`${Math.random()*3}s`,
                }}/>;
              })}
            </div>
            <div className="absolute top-0 left-0 right-0 h-px" style={{backgroundColor:'rgba(0,200,230,0.35)',boxShadow:'0 0 5px rgba(0,200,230,0.35)'}}/>
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({length:120}).map((_,i)=>(
          <div key={i} className="absolute rounded-full bg-white" style={{
            left:`${Math.random()*100}%`,top:`${Math.random()*65}%`,
            width:`${0.5+Math.random()*1.5}px`,height:`${0.5+Math.random()*1.5}px`,
            opacity:0.08+Math.random()*0.45,
            animation:`tw ${2+Math.random()*4}s ease-in-out infinite`,
            animationDelay:`${Math.random()*4}s`,
          }}/>
        ))}
      </div>
      <div className="absolute" style={{top:'8%',right:'12%',width:24,height:24,borderRadius:'50%',background:'radial-gradient(circle at 35% 35%,#e5e5cc,#a8a888)',boxShadow:'0 0 16px rgba(210,210,170,0.25)',opacity:0.65}}/>
      <div className="absolute bottom-0 left-0 right-0 h-20" style={{background:'linear-gradient(to top,rgba(0,180,220,0.035),transparent)'}}/>
      <style>{`@keyframes wf{0%,100%{opacity:1}45%{opacity:0.2}50%{opacity:0.85}}@keyframes tw{0%,100%{opacity:0.08}50%{opacity:0.6}}`}</style>
    </div>
  );
}

export default function CityScene() {
  const [webglSupported, setWebglSupported] = useState<boolean|null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(()=>{
    try {
      const canvas=document.createElement('canvas');
      const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      if(!gl||(gl as WebGLRenderingContext).isContextLost()){setWebglSupported(false);return;}
      setWebglSupported(true);
    } catch {setWebglSupported(false);}
  },[]);

  if(webglSupported===null) return null;
  if(!webglSupported||contextLost) return <CSSCityFallback/>;

  return (
    <Canvas
      camera={{position:[0,13,30],fov:58}}
      gl={{antialias:false,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:false}}
      dpr={Math.min(window.devicePixelRatio,1.5)}
      frameloop="always"
      onCreated={({gl})=>{
        gl.domElement.addEventListener('webglcontextlost',(e)=>{e.preventDefault();setContextLost(true);});
      }}
      style={{background:'transparent'}}
    >
      <color attach="background" args={['#020810']}/>
      <fog attach="fog" args={['#020810',32,72]}/>
      <SceneContent/>
    </Canvas>
  );
}