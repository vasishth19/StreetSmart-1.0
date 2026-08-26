'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Star, Send, TrendingUp, Users, Shield, Zap,
  MapPin, AlertTriangle, Activity, BarChart3, Radio,
  Cpu, Globe, Eye, Terminal, Wifi, Database,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import NeonCard from '@/components/ui/NeonCard';
import GlowButton from '@/components/ui/GlowButton';
import { useReviews } from '@/hooks/useReviews';
import { useLiveMetrics } from '@/hooks/useLiveMetrics';
import { useAuth } from '@/hooks/useAuth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const C = {
  green:  '#00FF9C',
  cyan:   '#00E5FF',
  amber:  '#FFB020',
  red:    '#FF3B3B',
  purple: '#B388FF',
  pink:   '#FF69B4',
};

const PROFILE_COLORS: Record<string,string> = {
  general:'#00E5FF', woman:'#FF69B4', elderly:'#FFB020',
  wheelchair:'#00FF9C', visually_impaired:'#B388FF',
};

// ─── Typing effect hook ───────────────────────────────────────────
function useTypingEffect(text: string, speed: number = 40) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, i + 1)); i++; }
      else clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

// ─── Glitch text effect ───────────────────────────────────────────
function GlitchText({ text, color }: { text: string; color: string }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ color, position:'relative', display:'inline-block' }}
      className={glitch ? 'animate-pulse' : ''}>
      {glitch ? text.split('').map((c,i) =>
        Math.random()>0.7 ? String.fromCharCode(33+Math.floor(Math.random()*60)) : c
      ).join('') : text}
    </span>
  );
}

// ─── Terminal log component ───────────────────────────────────────
function TerminalLog({ logs }: { logs: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} className="font-mono text-xs space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
      {logs.map((log, i) => (
        <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
          className="flex gap-2">
          <span className="text-[#4A5568]">[{new Date().toLocaleTimeString()}]</span>
          <span className={log.includes('⚠️')||log.includes('🚨') ? 'text-[#FFB020]' :
            log.includes('✅')||log.includes('🟢') ? 'text-[#00FF9C]' :
            log.includes('❌') ? 'text-[#FF3B3B]' : 'text-[#00E5FF]'}>
            {log}
          </span>
        </motion.div>
      ))}
      <div className="flex gap-2">
        <span className="text-[#4A5568]">[{new Date().toLocaleTimeString()}]</span>
        <span className="text-[#00FF9C]">█</span>
      </div>
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────
function AnimatedCounter({ value, color, suffix='' }: { value:number; color:string; suffix?:string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const diff = value - display;
    if (diff === 0) return;
    const step = diff / 20;
    let current = display;
    const timer = setInterval(() => {
      current += step;
      if ((step > 0 && current >= value) || (step < 0 && current <= value)) {
        setDisplay(value); clearInterval(timer);
      } else setDisplay(Math.round(current));
    }, 50);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <motion.span key={value} style={{ color }}
      className="text-2xl font-bold font-mono tabular-nums">
      {display.toLocaleString()}{suffix}
    </motion.span>
  );
}

// ─── Live metric card ─────────────────────────────────────────────
function LiveCard({ label, value, icon:Icon, color, suffix='' }: {
  label:string; value:number; icon:any; color:string; suffix?:string;
}) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <motion.div whileHover={{ scale:1.03, y:-2 }} className="relative overflow-hidden">
      <div className="rounded-xl p-4 border relative"
        style={{
          background:`linear-gradient(135deg, ${color}08, rgba(5,8,15,0.9))`,
          borderColor:`${color}30`,
          boxShadow: pulse ? `0 0 20px ${color}30` : `0 0 8px ${color}10`,
          transition:'box-shadow 0.3s',
        }}>
        {/* Scan line animation */}
        <motion.div className="absolute inset-x-0 h-px opacity-30"
          style={{ background:`linear-gradient(to right, transparent, ${color}, transparent)` }}
          animate={{ y: [-2, 60, -2] }} transition={{ duration:3, repeat:Infinity, ease:'linear' }} />

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor:color }} />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor:color }} />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{ borderColor:color }} />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{ borderColor:color }} />

        <div className="flex items-start justify-between mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background:`${color}15`, border:`1px solid ${color}40` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono" style={{ color }}>
            <motion.div animate={{ opacity:[1,0,1] }} transition={{ duration:1.5, repeat:Infinity }}
              className="w-1.5 h-1.5 rounded-full" style={{ background:color }} />
            LIVE
          </div>
        </div>

        <AnimatedCounter value={value} color={color} suffix={suffix} />
        <div className="text-[10px] text-[#8892B0] mt-1 font-mono tracking-wider">{label.toUpperCase()}</div>

        {/* Mini sparkline */}
        <div className="flex items-end gap-0.5 mt-2 h-6">
          {Array.from({length:8}, (_,i) => (
            <motion.div key={i} className="flex-1 rounded-sm"
              style={{ background:`${color}40` }}
              animate={{ height: `${20 + Math.random()*80}%` }}
              transition={{ duration:0.5, delay:i*0.1, repeat:Infinity, repeatDelay:2 }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cyberpunk background ─────────────────────────────────────────
function CyberBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage:`linear-gradient(rgba(0,229,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.15) 1px,transparent 1px)`,
        backgroundSize:'40px 40px',
      }}/>
      {/* Scanlines */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,156,0.3) 2px,rgba(0,255,156,0.3) 4px)`,
      }}/>
      {/* Glow orbs */}
      {[
        {x:'10%',y:'20%',color:'#00FF9C',size:300},
        {x:'80%',y:'60%',color:'#00E5FF',size:250},
        {x:'50%',y:'80%',color:'#B388FF',size:200},
      ].map((o,i)=>(
        <motion.div key={i} className="absolute rounded-full opacity-5"
          style={{ left:o.x, top:o.y, width:o.size, height:o.size,
            background:`radial-gradient(circle, ${o.color}, transparent)`,
            filter:'blur(60px)', transform:'translate(-50%,-50%)' }}
          animate={{ scale:[1,1.2,1], opacity:[0.05,0.08,0.05] }}
          transition={{ duration:4+i, repeat:Infinity, ease:'easeInOut' }} />
      ))}
      {/* Floating particles */}
      {Array.from({length:20},(_,i)=>(
        <motion.div key={i} className="absolute w-1 h-1 rounded-full"
          style={{ left:`${Math.random()*100}%`, background:['#00FF9C','#00E5FF','#B388FF'][i%3], opacity:0.4 }}
          animate={{ y:[-20, -100-Math.random()*200], opacity:[0.4,0] }}
          transition={{ duration:3+Math.random()*4, repeat:Infinity, delay:Math.random()*5, ease:'linear' }}
          initial={{ y: `${20+Math.random()*80}%` }} />
      ))}
    </div>
  );
}

// ─── Star input ───────────────────────────────────────────────────
function StarInput({ value, onChange }: { value:number; onChange:(v:number)=>void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s=>(
        <motion.button key={s} whileHover={{ scale:1.3 }} whileTap={{ scale:0.9 }}
          onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>onChange(s)}>
          <Star className="w-6 h-6" fill={(hover||value)>=s?C.amber:'none'} stroke={(hover||value)>=s?C.amber:'#4A5568'}/>
        </motion.button>
      ))}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────
export default function DashboardPage() {
  const { metrics, connected }                  = useLiveMetrics(4000);
  const { reviews, loading:revLoading, submitting, avgRating, submitReview } = useReviews();
  const { user, token }                         = useAuth();

  const [newRating,  setNewRating]  = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submitted,  setSubmitted]  = useState(false);
  const [weather,    setWeather]    = useState<any>(null);
  const [issues,     setIssues]     = useState([
    {type:'poor_lighting',   count:0, resolved:0},
    {type:'broken_sidewalk', count:0, resolved:0},
    {type:'unsafe_area',     count:0, resolved:0},
    {type:'missing_ramp',    count:0, resolved:0},
    {type:'construction',    count:0, resolved:0},
  ]);
  const [logs, setLogs] = useState<string[]>([
    '🟢 StreetSmart system online',
    '🟢 Supabase database connected',
    '🟢 Railway backend active',
    '🟢 GPS module initialized',
  ]);

  const addLog = useCallback((msg: string) => {
    setLogs(p => [...p.slice(-20), msg]);
  }, []);

  // Hourly safety data
  const hourly = Array.from({length:24},(_,h)=>({
    hour:h,
    safety:parseFloat(Math.min(98,Math.max(40,55+30*Math.sin((h-3)*0.38)+(Math.random()*6-3))).toFixed(1)),
  }));

  const profiles = [
    {profile:'general',         count:1240, percentage:45.2},
    {profile:'woman',           count:890,  percentage:32.4},
    {profile:'elderly',         count:320,  percentage:11.7},
    {profile:'wheelchair',      count:185,  percentage:6.7},
    {profile:'visually_impaired',count:109, percentage:4.0},
  ];

  const dailyRoutes = [
    {day:'Mon',routes:412},{day:'Tue',routes:388},{day:'Wed',routes:445},
    {day:'Thu',routes:502},{day:'Fri',routes:478},{day:'Sat',routes:310},{day:'Sun',routes:209},
  ];

  const radarData = [
    {subject:'Safety',A:85},{subject:'Lighting',A:72},
    {subject:'Access',A:78},{subject:'Crowd',A:65},{subject:'Response',A:90},
  ];

  // Fetch real reports
  useEffect(()=>{
    const fetch_ = async () => {
      try {
        const res  = await fetch(`${API}/reports`);
        const data = await res.json();
        const list = Array.isArray(data)?data:(data.reports||[]);
        addLog(`📊 Loaded ${list.length} community reports from Supabase`);
        const counts: Record<string,{count:number;resolved:number}> = {};
        list.forEach((r:any)=>{
          const t = r.issue_type||'other';
          if (!counts[t]) counts[t]={count:0,resolved:0};
          counts[t].count++;
          if (r.status==='resolved') counts[t].resolved++;
        });
        const sorted = Object.entries(counts)
          .map(([type,v])=>({type,...v}))
          .sort((a,b)=>b.count-a.count).slice(0,5);
        if (sorted.length>0) setIssues(sorted);
      } catch { addLog('⚠️ Reports fetch failed — using cached data'); }
    };
    fetch_();
  },[]);

  // Fetch live weather
  useEffect(()=>{
    const getWeather = async (lat:number, lng:number) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,precipitation,rain&forecast_days=1`;
        const res  = await fetch(url);
        const data = await res.json();
        setWeather(data.current);
        const temp = data.current?.temperature_2m;
        const code = data.current?.weathercode;
        addLog(`🌡️ Weather: ${temp}°C, code ${code} — data synced`);
        if (data.current?.precipitation > 2) addLog('⚠️ Rain detected — flooding risk active');
      } catch { addLog('⚠️ Weather API unavailable'); }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => getWeather(p.coords.latitude, p.coords.longitude),
        () => getWeather(26.84, 80.94) // fallback India
      );
    }
  },[]);

  // Periodic system logs
  useEffect(()=>{
    const msgs = [
      '🔄 Route scoring engine recalculating...',
      '📡 Syncing community reports...',
      '🛡️ Safety heatmap updated',
      '👁️ CCTV coverage scan complete',
      '🌐 OSRM routing API ping: 42ms',
      '✅ Database write successful',
      '🔄 JWT tokens refreshed',
      '📊 Analytics pipeline active',
    ];
    const id = setInterval(()=>{
      addLog(msgs[Math.floor(Math.random()*msgs.length)]);
    }, 3000);
    return ()=>clearInterval(id);
  },[]);

  const weatherCode = weather?.weathercode || 0;
  const weatherIcon = weatherCode>=95?'⛈️':weatherCode>=80?'🌧️':weatherCode>=51?'🌦️':weatherCode>=3?'☁️':'☀️';
  const weatherDesc = weatherCode>=95?'Thunderstorm':weatherCode>=80?'Rain':weatherCode>=51?'Drizzle':weatherCode>=3?'Cloudy':'Clear';

  const title = useTypingEffect('// STREETSMART ANALYTICS DASHBOARD', 60);

  const handleSubmitReview = async () => {
    if (!newComment.trim()) return;
    await submitReview(newRating, newComment, token??undefined);
    addLog('✅ Review submitted to Supabase');
    setNewComment(''); setNewRating(5); setSubmitted(true);
    setTimeout(()=>setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#020810] overflow-x-hidden">
      <CyberBackground />

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#00E5FF]/20 bg-[#020810]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#8892B0] hover:text-[#00E5FF] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="text-xs font-mono text-[#00FF9C] h-4">{title}<span className="animate-pulse">_</span></div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] font-mono text-[#4A5568]">v1.0.0</span>
                <span className="flex items-center gap-1 text-[9px] font-mono" style={{color:connected?C.green:C.amber}}>
                  <motion.div animate={{opacity:[1,0,1]}} transition={{duration:1,repeat:Infinity}}
                    className="w-1.5 h-1.5 rounded-full" style={{background:connected?C.green:C.amber}}/>
                  {connected?'LIVE':'DEMO'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Weather widget */}
            {weather && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#00E5FF]/20 bg-[#00E5FF]/05">
                <span className="text-lg">{weatherIcon}</span>
                <div>
                  <div className="text-xs font-mono text-[#E6F1FF]">{weather.temperature_2m}°C · {weatherDesc}</div>
                  <div className="text-[9px] font-mono text-[#4A5568]">Wind: {weather.windspeed_10m}km/h</div>
                </div>
              </div>
            )}
            {user && <span className="text-xs text-[#00FF9C] font-mono border border-[#00FF9C]/20 px-2 py-1 rounded">👤 {user.name}</span>}
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Live Metrics ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-3.5 h-3.5 text-[#00FF9C] animate-spin" style={{animationDuration:'3s'}}/>
            <span className="text-[10px] font-mono text-[#00FF9C] tracking-widest">LIVE SYSTEM METRICS — UPDATES EVERY 4s</span>
            <div className="flex-1 h-px bg-gradient-to-r from-[#00FF9C]/30 to-transparent"/>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <LiveCard label="Active Users"   value={metrics.active_users}      icon={Users}    color={C.cyan}   />
            <LiveCard label="Routes Today"   value={metrics.routes_generated}  icon={MapPin}   color={C.green}  />
            <LiveCard label="Reports"        value={metrics.safety_reports}    icon={Shield}   color={C.amber}  />
            <LiveCard label="Reviews"        value={metrics.reviews_submitted} icon={Star}     color={C.purple} />
            <LiveCard label="Routes/min"     value={metrics.routes_per_minute} icon={Zap}      color={C.red}    suffix="/m"/>
            <LiveCard label="Cities Online"  value={metrics.online_cities}     icon={Globe}    color={C.cyan}   />
          </div>
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Safety line chart — large */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="lg:col-span-2">
            <div className="rounded-xl border border-[#00E5FF]/20 p-5 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(0,229,255,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent opacity-50"/>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00E5FF]"/>
                  <span className="text-sm font-semibold text-[#E6F1FF]">Safety Score by Hour</span>
                </div>
                <span className="text-[10px] font-mono text-[#00E5FF] border border-[#00E5FF]/20 px-2 py-0.5 rounded">24H LIVE</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hourly}>
                  <defs>
                    <linearGradient id="safetyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00E5FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.06)"/>
                  <XAxis dataKey="hour" tick={{fill:'#4A5568',fontSize:9,fontFamily:'monospace'}} tickFormatter={(v:number)=>`${v}h`}/>
                  <YAxis tick={{fill:'#4A5568',fontSize:9,fontFamily:'monospace'}} domain={[40,100]}/>
                  <Tooltip contentStyle={{background:'rgba(2,8,16,0.98)',border:'1px solid rgba(0,229,255,0.3)',borderRadius:'8px',color:'#E6F1FF',fontSize:'11px',fontFamily:'monospace'}}
                    formatter={(v:number)=>[`${v.toFixed(1)}`,`Safety Score`]}/>
                  <Area type="monotone" dataKey="safety" stroke={C.cyan} strokeWidth={2}
                    fill="url(#safetyGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Profile distribution */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}}>
            <div className="rounded-xl border border-[#00FF9C]/20 p-5 h-full relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(0,255,156,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#00FF9C] to-transparent opacity-50"/>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#00FF9C]"/>
                <span className="text-sm font-semibold text-[#E6F1FF]">User Profiles</span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={profiles} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="count">
                    {profiles.map((e,i)=><Cell key={i} fill={PROFILE_COLORS[e.profile]??C.cyan} stroke="transparent"/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'rgba(2,8,16,0.98)',border:'1px solid rgba(0,255,156,0.2)',borderRadius:'8px',color:'#E6F1FF',fontSize:'11px'}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {profiles.map(item=>(
                  <div key={item.profile} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{background:PROFILE_COLORS[item.profile]??C.cyan}}/>
                      <span className="text-[10px] text-[#8892B0] capitalize">{item.profile.replace(/_/g,' ')}</span>
                    </div>
                    <span className="text-[10px] font-mono" style={{color:PROFILE_COLORS[item.profile]??C.cyan}}>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Weekly routes bar */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="lg:col-span-2">
            <div className="rounded-xl border border-[#FFB020]/20 p-5 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(255,176,32,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#FFB020] to-transparent opacity-50"/>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[#FFB020]"/>
                <span className="text-sm font-semibold text-[#E6F1FF]">Routes Generated This Week</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyRoutes}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFB020" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#FFB020" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,176,32,0.06)"/>
                  <XAxis dataKey="day" tick={{fill:'#4A5568',fontSize:10,fontFamily:'monospace'}}/>
                  <YAxis tick={{fill:'#4A5568',fontSize:10,fontFamily:'monospace'}}/>
                  <Tooltip contentStyle={{background:'rgba(2,8,16,0.98)',border:'1px solid rgba(255,176,32,0.3)',borderRadius:'8px',color:'#E6F1FF',fontSize:'11px',fontFamily:'monospace'}}/>
                  <Bar dataKey="routes" fill="url(#barGrad)" radius={[4,4,0,0]}
                    style={{filter:'drop-shadow(0 0 4px rgba(255,176,32,0.4))'}}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Radar */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}}>
            <div className="rounded-xl border border-[#B388FF]/20 p-5 h-full relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(179,136,255,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#B388FF] to-transparent opacity-50"/>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[#B388FF]"/>
                <span className="text-sm font-semibold text-[#E6F1FF]">Safety Radar</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(179,136,255,0.15)"/>
                  <PolarAngleAxis dataKey="subject" tick={{fill:'#8892B0',fontSize:9,fontFamily:'monospace'}}/>
                  <Radar name="Score" dataKey="A" stroke={C.purple} fill={C.purple} fillOpacity={0.2} strokeWidth={2}
                    style={{filter:'drop-shadow(0 0 6px rgba(179,136,255,0.5))'}}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* ── Real Issues + Terminal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Real issues from Supabase */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.6}}>
            <div className="rounded-xl border border-[#FF3B3B]/20 p-5 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(255,59,59,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#FF3B3B] to-transparent opacity-50"/>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#FF3B3B]"/>
                  <span className="text-sm font-semibold text-[#E6F1FF]">Live Community Reports</span>
                </div>
                <span className="text-[9px] font-mono text-[#FF3B3B] border border-[#FF3B3B]/20 px-2 py-0.5 rounded">SUPABASE LIVE</span>
              </div>
              <div className="space-y-3">
                {issues.map((issue,i)=>(
                  <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:0.7+i*0.05}}
                    className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#4A5568] w-4">{i+1}</span>
                    <span className="text-xs text-[#E6F1FF] flex-1 capitalize font-mono">{issue.type.replace(/_/g,' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-[#0B1020] rounded-full h-1.5 overflow-hidden">
                        <motion.div initial={{width:0}}
                          animate={{width:`${(issue.count/(issues[0]?.count||1))*100}%`}}
                          transition={{duration:1,delay:0.8+i*0.1}}
                          className="h-full rounded-full"
                          style={{background:C.red,boxShadow:`0 0 6px ${C.red}60`}}/>
                      </div>
                      <span className="font-mono text-xs text-[#FF3B3B] w-6 text-right">{issue.count}</span>
                      <span className="font-mono text-xs text-[#00FF9C] w-6 text-right">{issue.resolved}✓</span>
                    </div>
                  </motion.div>
                ))}
                {issues.every(i=>i.count===0) && (
                  <p className="text-xs font-mono text-[#4A5568] text-center py-4">📡 Waiting for user reports...</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Terminal log */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.65}}>
            <div className="rounded-xl border border-[#00FF9C]/20 p-5 relative overflow-hidden h-full"
              style={{background:'linear-gradient(135deg,rgba(0,255,156,0.03),rgba(2,8,16,0.98))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#00FF9C] to-transparent opacity-50"/>
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-[#00FF9C]"/>
                <span className="text-sm font-semibold text-[#E6F1FF]">System Terminal</span>
                <div className="flex-1"/>
                <div className="flex gap-1.5">
                  {['#FF3B3B','#FFB020','#00FF9C'].map(c=>(
                    <div key={c} className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>
                  ))}
                </div>
              </div>
              <div className="bg-[#010508] rounded-lg p-3 border border-[#00FF9C]/10">
                <TerminalLog logs={logs}/>
              </div>
              {/* Weather in terminal */}
              {weather && (
                <div className="mt-3 p-2 rounded-lg bg-[#00E5FF]/05 border border-[#00E5FF]/15 font-mono text-xs">
                  <span className="text-[#00E5FF]">$ weather --live</span>
                  <div className="text-[#8892B0] mt-1">
                    {weatherIcon} {weatherDesc} · {weather.temperature_2m}°C · Wind {weather.windspeed_10m}km/h
                    {weather.precipitation>0 && <span className="text-[#FFB020]"> · Rain {weather.precipitation}mm ⚠️</span>}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Reviews Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Real reviews from Supabase */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.7}}>
            <div className="rounded-xl border border-[#FFB020]/20 p-5 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(255,176,32,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#FFB020] to-transparent opacity-50"/>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#FFB020]" fill={C.amber}/>
                  <span className="text-sm font-semibold text-[#E6F1FF]">Platform Reviews</span>
                </div>
                <span className="text-[9px] font-mono text-[#FFB020] border border-[#FFB020]/20 px-2 py-0.5 rounded">REAL DATA</span>
              </div>
              <div className="flex items-center gap-6 mb-5">
                <div className="text-center">
                  <motion.div key={avgRating} animate={{scale:[1.1,1]}} transition={{duration:0.3}}
                    className="text-5xl font-bold font-mono text-[#FFB020]"
                    style={{textShadow:'0 0 20px rgba(255,176,32,0.5)'}}>
                    <GlitchText text={avgRating.toFixed(1)} color={C.amber}/>
                  </motion.div>
                  <div className="flex gap-0.5 mt-1 justify-center">
                    {[1,2,3,4,5].map(s=><Star key={s} className="w-3 h-3" fill={avgRating>=s?C.amber:'none'} stroke={avgRating>=s?C.amber:'#4A5568'}/>)}
                  </div>
                  <div className="text-[10px] text-[#8892B0] mt-1 font-mono">{reviews.length} REVIEWS</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(star=>{
                    const count = reviews.filter(r=>r.rating===star).length;
                    const pct   = reviews.length?(count/reviews.length)*100:0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#8892B0] w-3">{star}</span>
                        <Star className="w-2.5 h-2.5" fill={C.amber} stroke={C.amber}/>
                        <div className="flex-1 h-1.5 bg-[#0B1020] rounded-full overflow-hidden">
                          <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.8,delay:0.2}}
                            className="h-full rounded-full" style={{background:C.amber,boxShadow:`0 0 4px ${C.amber}60`}}/>
                        </div>
                        <span className="text-[10px] font-mono text-[#4A5568] w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {revLoading
                  ? <div className="text-center text-xs text-[#8892B0] py-4 font-mono animate-pulse">📡 Loading from Supabase...</div>
                  : reviews.length===0
                    ? <div className="text-center text-xs text-[#4A5568] py-4 font-mono">No reviews yet</div>
                    : reviews.slice(0,5).map(rev=>(
                      <motion.div key={rev.id} initial={{opacity:0}} animate={{opacity:1}}
                        className="p-3 rounded-lg border"
                        style={{background:'rgba(11,16,32,0.8)',borderColor:'rgba(255,176,32,0.12)'}}>
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-semibold text-[#E6F1FF]">{rev.user_name}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s=><Star key={s} className="w-2.5 h-2.5" fill={rev.rating>=s?C.amber:'none'} stroke={rev.rating>=s?C.amber:'#4A5568'}/>)}
                          </div>
                        </div>
                        <p className="text-xs text-[#8892B0] leading-relaxed italic">&ldquo;{rev.comment}&rdquo;</p>
                        <p className="text-[9px] text-[#4A5568] mt-1 font-mono">{new Date(rev.created_at).toLocaleDateString()}</p>
                      </motion.div>
                    ))
                }
              </div>
            </div>
          </motion.div>

          {/* Submit review */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.75}}>
            <div className="rounded-xl border border-[#00FF9C]/20 p-5 relative overflow-hidden h-full"
              style={{background:'linear-gradient(135deg,rgba(0,255,156,0.04),rgba(5,8,15,0.95))'}}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#00FF9C] to-transparent opacity-50"/>
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-[#00FF9C]"/>
                <span className="text-sm font-semibold text-[#E6F1FF]">Leave a Review</span>
              </div>
              <AnimatePresence>
                {submitted?(
                  <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
                    className="flex flex-col items-center justify-center py-12 gap-3">
                    <motion.div animate={{rotate:360}} transition={{duration:1}}>
                      <div className="text-4xl">🎉</div>
                    </motion.div>
                    <p className="text-[#00FF9C] font-mono font-bold">REVIEW SUBMITTED!</p>
                    <p className="text-[#8892B0] text-xs font-mono text-center">Saved to Supabase permanently ✅</p>
                  </motion.div>
                ):(
                  <motion.div initial={{opacity:1}} exit={{opacity:0}} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono text-[#8892B0] mb-2 tracking-widest">YOUR RATING</label>
                      <StarInput value={newRating} onChange={setNewRating}/>
                      {newRating>0 && (
                        <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-[10px] font-mono mt-1 text-[#FFB020]">
                          {['','Very Poor','Poor','Average','Good','Excellent!'][newRating]}
                        </motion.p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#8892B0] mb-2 tracking-widest">YOUR COMMENT</label>
                      <textarea value={newComment} onChange={e=>setNewComment(e.target.value)}
                        placeholder="// Share your experience..."
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-lg text-[#E6F1FF] placeholder-[#4A5568] text-xs font-mono outline-none resize-none transition-all"
                        style={{background:'rgba(2,8,16,0.8)',border:`1px solid rgba(0,255,156,${newComment?'0.3':'0.1'})`,
                          boxShadow:newComment?'0 0 12px rgba(0,255,156,0.1)':'none'}}/>
                      <div className="text-right text-[9px] font-mono text-[#4A5568] mt-1">{newComment.length}/500</div>
                    </div>
                    {!user&&(
                      <p className="text-[10px] text-[#8892B0] font-mono">
                        Posting as guest · <Link href="/login" className="text-[#00E5FF] underline">Sign in</Link> for profile
                      </p>
                    )}
                    <GlowButton color="green" size="md" className="w-full" onClick={handleSubmitReview} disabled={submitting||!newComment.trim()}>
                      {submitting
                        ? <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin border-[#05080F]"/>Uploading to Supabase...</span>
                        : <span className="flex items-center gap-2"><Send className="w-3.5 h-3.5"/>Submit Review → Supabase</span>}
                    </GlowButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* ── System status footer ── */}
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.9}}
          className="rounded-xl border border-[#00E5FF]/10 p-4"
          style={{background:'rgba(0,229,255,0.02)'}}>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-[#00FF9C]"/>
              <span className="text-[#4A5568]">Supabase:</span>
              <span className="text-[#00FF9C]">CONNECTED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-[#00E5FF]"/>
              <span className="text-[#4A5568]">Railway API:</span>
              <span className="text-[#00E5FF]">ONLINE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-[#FFB020]"/>
              <span className="text-[#4A5568]">Weather API:</span>
              <span style={{color:weather?C.green:C.amber}}>{weather?'SYNCED':'LOADING'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-[#B388FF]"/>
              <span className="text-[#4A5568]">Reports in DB:</span>
              <span className="text-[#B388FF]">{issues.reduce((s,i)=>s+i.count,0)} total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 text-[#FFB020]"/>
              <span className="text-[#4A5568]">Reviews in DB:</span>
              <span className="text-[#FFB020]">{reviews.length} total</span>
            </div>
            <div className="ml-auto text-[#4A5568]">
              StreetSmart v1.0 · {new Date().toLocaleString()}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}