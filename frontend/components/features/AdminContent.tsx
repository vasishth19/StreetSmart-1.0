'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Shield, Users, FileText, Star, CheckCircle, XCircle, Flag, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import NeonCard from '@/components/ui/NeonCard';
import GlowButton from '@/components/ui/GlowButton';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WEEK = [
  {day:'Mon',reports:12},{day:'Tue',reports:19},{day:'Wed',reports:14},
  {day:'Thu',reports:28},{day:'Fri',reports:22},{day:'Sat',reports:31},{day:'Sun',reports:25},
];
type Tab = 'dashboard'|'reports'|'reviews'|'users';
const SEV:Record<string,string> = {CRITICAL:'#FF3B3B',HIGH:'#FF3B3B',MEDIUM:'#FFB020',LOW:'#00FF9C',critical:'#FF3B3B',high:'#FF3B3B',medium:'#FFB020',low:'#00FF9C'};
const ICONS:Record<string,string> = {poor_lighting:'💡',unsafe_area:'⚠️',broken_sidewalk:'🚧',missing_ramp:'♿',construction:'🏗️',harassment:'🚨',flooding:'💧',obstruction:'🚫'};

function timeAgo(d:string){
  try{
    const diff=Date.now()-new Date(d).getTime();
    const m=Math.floor(diff/60000);
    if(m<60)return `${m}m ago`;
    const h=Math.floor(m/60);
    if(h<24)return `${h}h ago`;
    const days=Math.floor(h/24);
    if(days<7)return `${days} days ago`;
    if(days<30)return `${Math.floor(days/7)} weeks ago`;
    return `${Math.floor(days/30)} months ago`;
  }catch{return 'recently';}
}

function Stars({r}:{r:number}){
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(s=><Star key={s} className="w-3.5 h-3.5" fill={r>=s?'#FFB020':'none'} stroke={r>=s?'#FFB020':'#4A5568'}/>)}</div>;
}

export default function AdminPage() {
  const [authed,setAuthed]=useState(false);
  const [email,setEmail]=useState('');
  const [pass,setPass]=useState('');
  const [err,setErr]=useState('');
  const [tab,setTab]=useState<Tab>('dashboard');
  const [reports,setReports]=useState<any[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [loadR,setLoadR]=useState(false);
  const [loadRv,setLoadRv]=useState(false);

  const login=()=>{
    if(!email.trim()||!pass.trim()){setErr('Please enter credentials');return;}
    if((email==='admin@streetsmart.app'||email==='admin')&&(pass==='admin2026'||pass==='admin')){setAuthed(true);setErr('');}
    else setErr('Invalid credentials');
  };

  const [fetchError,setFetchError]=useState('');

  const fetchReports=async()=>{
    setLoadR(true);
    try{
      const r=await fetch(`${API}/reports`);
      if(!r.ok) throw new Error(`Server returned ${r.status}`);
      const d=await r.json();
      setReports(Array.isArray(d)?d:(d.reports||[]));
      setFetchError('');
    }catch(e:any){
      const msg = e instanceof TypeError
        ? `Cannot reach the server at ${API} — reports were not deleted, they just couldn't be loaded.`
        : `Failed to load reports: ${e.message}`;
      setFetchError(msg);
      toast.error(msg);
    }finally{setLoadR(false);}
  };

  const fetchReviews=async()=>{
    setLoadRv(true);
    try{
      const r=await fetch(`${API}/reviews`);
      if(!r.ok) throw new Error(`Server returned ${r.status}`);
      const d=await r.json();
      setReviews(Array.isArray(d)?d:(d.reviews||d.data||[]));
      setFetchError('');
    }catch(e:any){
      const msg = e instanceof TypeError
        ? `Cannot reach the server at ${API} — reviews were not deleted, they just couldn't be loaded.`
        : `Failed to load reviews: ${e.message}`;
      setFetchError(msg);
      toast.error(msg);
    }finally{setLoadRv(false);}
  };

  useEffect(()=>{if(authed){fetchReports();fetchReviews();}}, [authed]);

  const pendingR   = reports.filter(r=>r.status==='reported'||r.status==='pending'||!r.status);
  const approvedR  = reports.filter(r=>r.status==='approved'||r.status==='investigating'||r.status==='resolved');
  const pendingRv  = reviews.filter(r=>!r.approved&&r.status!=='approved');
  const publishedRv= reviews.filter(r=>r.approved||r.status==='approved');

  if(!authed) return (
    <div className="min-h-screen bg-[#05080F] flex items-center justify-center px-4">
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none"/>
      <div className="fixed inset-0 scanlines pointer-events-none"/>
      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div animate={{rotate:[0,5,-5,0]}} transition={{duration:2,repeat:Infinity,repeatDelay:3}}
            className="w-16 h-16 rounded-2xl bg-[#9B5DE5]/10 border border-[#9B5DE5]/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-[#9B5DE5]"/>
          </motion.div>
          <h1 className="text-3xl font-bold text-[#E6F1FF] mb-2">Admin Access</h1>
          <p className="text-[#8892B0] text-sm font-mono">Owner-verified control panel · StreetSmart</p>
        </div>
        <div className="glass-panel p-8 rounded-2xl border border-[#9B5DE5]/20">
          {err&&<motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 text-[#FF3B3B] text-sm mb-4">
            <AlertTriangle className="w-4 h-4"/>{err}</motion.div>}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">ADMIN EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter admin email"
                onKeyDown={e=>e.key==='Enter'&&login()}
                className="w-full px-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#9B5DE5]/50 transition-colors"/>
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">PASSWORD</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
                onKeyDown={e=>e.key==='Enter'&&login()}
                className="w-full px-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#9B5DE5]/50 transition-colors"/>
            </div>
            <GlowButton color="purple" size="md" className="w-full" onClick={login}>
              <Shield className="w-4 h-4 mr-2"/>ACCESS ADMIN PANEL
            </GlowButton>
          </div>
          {/* ✅ NO password shown — only admin knows */}
          <p className="text-xs text-center text-[#4A5568] font-mono mt-4">Restricted access — owner only</p>
        </div>
        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-[#8892B0] hover:text-[#00E5FF] transition-colors font-mono">← Back to Home</Link>
        </div>
      </motion.div>
    </div>
  );

  const TABS:[Tab,string,number][]=[
    ['dashboard','📊 Dashboard',0],
    ['reports','🚨 Reports',pendingR.length],
    ['reviews','⭐ Reviews',pendingRv.length],
    ['users','👥 Users',0],
  ];

  return (
    <div className="min-h-screen bg-[#05080F] pb-16">
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none"/>
      <div className="fixed inset-0 scanlines pointer-events-none"/>

      <div className="z-10 border-b border-[#9B5DE5]/20 bg-[#05080F]/95 backdrop-blur-lg px-6 py-4 sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-[#8892B0] hover:text-[#00E5FF] transition-colors">
              <ArrowLeft className="w-4 h-4"/><span className="text-sm font-mono">HOME</span>
            </Link>
            <div className="h-4 w-px bg-[#9B5DE5]/30"/>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#9B5DE5]"/>
              <span className="font-bold text-[#E6F1FF]">Admin <span className="text-[#9B5DE5]">Control Panel</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>{fetchReports();fetchReviews();}}
              className="p-2 rounded-lg border border-[#9B5DE5]/30 text-[#9B5DE5] hover:bg-[#9B5DE5]/10 transition-all" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5"/>
            </button>
            <span className="font-mono text-xs text-[#9B5DE5] border border-[#9B5DE5]/30 px-3 py-1 rounded-full">🔐 OWNER VERIFIED</span>
            <button onClick={()=>setAuthed(false)} className="text-xs font-mono text-[#8892B0] hover:text-[#FF3B3B] transition-colors">LOGOUT</button>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {label:'Total Reports',value:String(reports.length||'0'),color:'#00FF9C',icon:FileText},
            {label:'Pending',value:String(pendingR.length+pendingRv.length),color:'#FFB020',icon:AlertTriangle},
            {label:'Total Reviews',value:String(reviews.length||'0'),color:'#00E5FF',icon:Star},
            {label:'Published',value:String(publishedRv.length),color:'#B388FF',icon:CheckCircle},
          ].map(s=>(
            <motion.div key={s.label} whileHover={{y:-2}}>
              <NeonCard color={s.color}>
                <s.icon className="w-4 h-4 mb-2" style={{color:s.color}}/>
                <div className="text-2xl font-bold font-mono" style={{color:s.color}}>{s.value}</div>
                <div className="text-xs text-[#8892B0] mt-1">{s.label}</div>
              </NeonCard>
            </motion.div>
          ))}
        </motion.div>

        <div className="flex border-b border-[#00E5FF]/10 mb-6 overflow-x-auto">
          {TABS.map(([t,label,count])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-5 py-3 font-mono text-xs tracking-wider whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${tab===t?'border-[#9B5DE5] text-[#9B5DE5]':'border-transparent text-[#8892B0] hover:text-[#E6F1FF]'}`}>
              {label}
              {count>0&&<span className="bg-[#FFB020] text-[#05080F] text-xs font-bold px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {tab==='dashboard'&&(
            <motion.div key="dash" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NeonCard color="#00E5FF">
                  <div className="font-mono text-xs text-[#00E5FF] mb-4 tracking-widest">// REPORTS THIS WEEK</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={WEEK}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2a4a"/>
                      <XAxis dataKey="day" tick={{fill:'#8892B0',fontSize:11}}/>
                      <YAxis tick={{fill:'#8892B0',fontSize:11}}/>
                      <Tooltip contentStyle={{background:'#0B1020',border:'1px solid #1a2a4a',color:'#E6F1FF',fontFamily:'monospace',fontSize:11}}/>
                      <Bar dataKey="reports" fill="#00E5FF" opacity={0.7} radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </NeonCard>
                <NeonCard color="#9B5DE5">
                  <div className="font-mono text-xs text-[#9B5DE5] mb-4 tracking-widest">// LIVE PLATFORM STATS</div>
                  <div className="space-y-3">
                    {[
                      {label:'Total Reports from Users', value:reports.length, color:'#00FF9C'},
                      {label:'Pending Moderation',       value:pendingR.length+pendingRv.length, color:'#FFB020'},
                      {label:'Total Reviews',            value:reviews.length, color:'#00E5FF'},
                      {label:'Published Reviews',        value:publishedRv.length, color:'#B388FF'},
                      {label:'Approved Reports',         value:approvedR.length, color:'#00FF9C'},
                    ].map(item=>(
                      <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-[#9B5DE5]/08 last:border-0">
                        <span className="text-sm text-[#8892B0]">{item.label}</span>
                        <span className="font-mono font-bold text-sm" style={{color:item.color}}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              </div>
            </motion.div>
          )}

          {tab==='reports'&&(
            <motion.div key="reports" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs text-[#FFB020] tracking-widest">// PENDING REPORTS</span>
                  <span className="bg-[#FFB020]/15 text-[#FFB020] text-xs font-mono px-2 py-0.5 rounded-full">{pendingR.length}</span>
                  {loadR&&<Loader2 className="w-3 h-3 animate-spin text-[#8892B0]"/>}
                </div>
                <div className="space-y-3">
                  {pendingR.length===0&&!loadR&&(
                    <div className="text-center py-12 text-[#4A5568] font-mono text-sm">
                      {reports.length===0?'📡 Waiting for user reports...':'✓ All reports reviewed'}
                    </div>
                  )}
                  {pendingR.map(r=>{
                    const sc=SEV[r.severity]||'#8892B0';
                    return (
                      <motion.div key={r.id} layout exit={{opacity:0,scale:0.95}}>
                        <NeonCard color={sc}>
                          <div className="flex gap-3">
                            <span className="text-2xl flex-shrink-0">{ICONS[r.issue_type]||'📍'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-[#E6F1FF] mb-1">
                                {r.issue_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}
                              </div>
                              <div className="text-xs text-[#8892B0] font-mono mb-1">{r.address||`${r.lat?.toFixed(3)}, ${r.lng?.toFixed(3)}`}</div>
                              <div className="text-xs text-[#8892B0] font-mono mb-2">{timeAgo(r.created_at)} · 👍 {r.votes||0}</div>
                              {r.description&&(
                                <div className="text-xs text-[#8892B0] mb-2 italic border-l-2 pl-2" style={{borderColor:`${sc}40`}}>
                                  &ldquo;{r.description.substring(0,80)}{r.description.length>80?'...':''}&rdquo;
                                </div>
                              )}
                              <div className="mb-2">
                                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold" style={{background:`${sc}15`,color:sc}}>
                                  {r.severity?.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={()=>setReports(p=>p.map(x=>x.id===r.id?{...x,status:'approved'}:x))}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/25 hover:bg-[#00FF9C]/20 transition-all">
                                  <CheckCircle className="w-3 h-3"/>APPROVE
                                </button>
                                <button onClick={()=>setReports(p=>p.map(x=>x.id===r.id?{...x,status:'rejected'}:x))}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#FF3B3B]/10 text-[#FF3B3B] border border-[#FF3B3B]/25 hover:bg-[#FF3B3B]/20 transition-all">
                                  <XCircle className="w-3 h-3"/>REJECT
                                </button>
                                <button className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#FFB020]/10 text-[#FFB020] border border-[#FFB020]/25 hover:bg-[#FFB020]/20 transition-all">
                                  <Flag className="w-3 h-3"/>FLAG
                                </button>
                              </div>
                            </div>
                          </div>
                        </NeonCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs text-[#00FF9C] tracking-widest">// APPROVED REPORTS</span>
                  <span className="bg-[#00FF9C]/15 text-[#00FF9C] text-xs font-mono px-2 py-0.5 rounded-full">{approvedR.length}</span>
                </div>
                <div className="space-y-3">
                  {approvedR.length===0&&<div className="text-center py-12 text-[#4A5568] font-mono text-sm">No approved reports yet</div>}
                  {approvedR.map(r=>(
                    <NeonCard key={r.id} color="#00FF9C">
                      <div className="flex gap-3">
                        <span className="text-xl flex-shrink-0">{ICONS[r.issue_type]||'📍'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-[#E6F1FF] mb-1">
                            {r.issue_type?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}
                          </div>
                          <div className="text-xs text-[#8892B0] font-mono mb-1">{r.address||`${r.lat?.toFixed(3)}, ${r.lng?.toFixed(3)}`}</div>
                          <div className="text-xs text-[#8892B0] font-mono">{timeAgo(r.created_at)}</div>
                          <div className="text-xs font-mono text-[#00FF9C] mt-1">✅ {r.status?.toUpperCase()||'APPROVED'}</div>
                        </div>
                      </div>
                    </NeonCard>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {tab==='reviews'&&(
            <motion.div key="reviews" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs text-[#FFB020] tracking-widest">// PENDING REVIEWS</span>
                  <span className="bg-[#FFB020]/15 text-[#FFB020] text-xs font-mono px-2 py-0.5 rounded-full">{pendingRv.length}</span>
                  {loadRv&&<Loader2 className="w-3 h-3 animate-spin text-[#8892B0]"/>}
                </div>
                <div className="space-y-3">
                  {pendingRv.length===0&&!loadRv&&(
                    <div className="text-center py-12 text-[#4A5568] font-mono text-sm">
                      {reviews.length===0?'📡 Waiting for user reviews...':'✓ All reviews moderated'}
                    </div>
                  )}
                  {pendingRv.map(r=>(
                    <motion.div key={r.id} layout exit={{opacity:0,scale:0.95}}>
                      <NeonCard color="#FFB020">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold text-[#E6F1FF]">{r.user_name||`User #${r.user_id}`}</div>
                            <div className="text-xs text-[#8892B0] font-mono">{timeAgo(r.created_at)}</div>
                          </div>
                          <Stars r={r.rating}/>
                        </div>
                        <div className="border-l-2 border-[#FFB020]/50 pl-3 py-1.5 mb-3 bg-[#FFB020]/05 rounded-r">
                          <p className="text-sm text-[#8892B0] italic">&ldquo;{r.comment}&rdquo;</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>setReviews(p=>p.map(x=>x.id===r.id?{...x,approved:true}:x))}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/25 hover:bg-[#00FF9C]/20 transition-all">
                            <CheckCircle className="w-3 h-3"/>APPROVE & PUBLISH
                          </button>
                          <button onClick={()=>setReviews(p=>p.filter(x=>x.id!==r.id))}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#FF3B3B]/10 text-[#FF3B3B] border border-[#FF3B3B]/25 hover:bg-[#FF3B3B]/20 transition-all">
                            <XCircle className="w-3 h-3"/>REJECT
                          </button>
                        </div>
                      </NeonCard>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs text-[#00FF9C] tracking-widest">// PUBLISHED REVIEWS</span>
                  <span className="bg-[#00FF9C]/15 text-[#00FF9C] text-xs font-mono px-2 py-0.5 rounded-full">{publishedRv.length}</span>
                </div>
                <div className="space-y-3">
                  {publishedRv.length===0&&<div className="text-center py-12 text-[#4A5568] font-mono text-sm">No published reviews yet</div>}
                  {publishedRv.map(r=>(
                    <NeonCard key={r.id} color="#00E5FF">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-[#E6F1FF]">{r.user_name||`User #${r.user_id}`}</div>
                          <div className="text-xs text-[#8892B0] font-mono">{timeAgo(r.created_at)}</div>
                        </div>
                        <Stars r={r.rating}/>
                      </div>
                      <div className="border-l-2 border-[#00FF9C]/30 pl-3 py-1 bg-[#00FF9C]/03 rounded-r">
                        <p className="text-xs text-[#8892B0] italic">&ldquo;{r.comment}&rdquo;</p>
                      </div>
                      <div className="text-xs font-mono text-[#00FF9C] mt-2">✅ PUBLISHED</div>
                    </NeonCard>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {tab==='users'&&(
            <motion.div key="users" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}}>
              <NeonCard color="#00E5FF">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-mono text-xs text-[#00E5FF] tracking-widest">// REVIEW SUBMITTERS — REAL USERS</div>
                  <span className="text-xs text-[#4A5568] font-mono">{reviews.length} total</span>
                </div>
                {reviews.length===0?(
                  <div className="text-center py-12 text-[#4A5568] font-mono text-sm">📡 No user submissions yet</div>
                ):(
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#00E5FF]/10">
                          {['USER','RATING','REVIEW PREVIEW','SUBMITTED','STATUS'].map(h=>(
                            <th key={h} className="text-left py-3 px-3 font-mono text-xs text-[#8892B0] tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reviews.map((r,i)=>(
                          <motion.tr key={r.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                            className="border-b border-[#00E5FF]/05 hover:bg-[#00E5FF]/03 transition-colors">
                            <td className="py-3 px-3 text-[#E6F1FF] font-medium text-sm">{r.user_name||`User #${r.user_id}`}</td>
                            <td className="py-3 px-3"><Stars r={r.rating}/></td>
                            <td className="py-3 px-3 text-xs text-[#8892B0] max-w-xs">
                              {r.comment?.substring(0,55)}...
                            </td>
                            <td className="py-3 px-3 text-xs text-[#8892B0] font-mono">{timeAgo(r.created_at)}</td>
                            <td className="py-3 px-3">
                              <span className="text-xs font-mono px-2 py-1 rounded"
                                style={r.approved?{background:'#00FF9C15',color:'#00FF9C'}:{background:'#FFB02015',color:'#FFB020'}}>
                                {r.approved?'PUBLISHED':'PENDING'}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </NeonCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
