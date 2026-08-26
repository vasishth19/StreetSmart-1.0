'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Navigation, User, Activity, Shield, FileText, Edit3, Save, Loader2 } from 'lucide-react';
import GlowButton from '@/components/ui/GlowButton';
import NeonCard from '@/components/ui/NeonCard';
import { useAuth } from '@/hooks/useAuth';
import { useEmergencyContacts } from '@/hooks/useEmergencyContacts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const PROFILE_TYPES = [
  { value:'woman',             label:'Women Safety',  icon:'👩', color:'#FF69B4', desc:'Safety 45% + Lighting 30% — avoids isolated paths' },
  { value:'general',           label:'General',       icon:'🧑', color:'#00E5FF', desc:'Balanced across all 4 safety factors' },
  { value:'elderly',           label:'Elderly',       icon:'🧓', color:'#FFB020', desc:'Accessibility 35% — shorter, rest-stop routes' },
  { value:'wheelchair',        label:'Wheelchair',    icon:'♿', color:'#00FF9C', desc:'Accessibility 50% — ramps and smooth surfaces only' },
  { value:'visually_impaired', label:'Vis. Impaired', icon:'👁️', color:'#B388FF', desc:'Audio navigation + high contrast display' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { contacts, addContact, removeContact, maxContacts } = useEmergencyContacts();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('woman');
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [city,  setCity]  = useState('');

  const [statsLoading, setStatsLoading] = useState(true);
  const [routesUsed,   setRoutesUsed]   = useState<number | null>(null);
  const [reportsFiled, setReportsFiled] = useState<number | null>(null);
  const [reviewsGiven, setReviewsGiven] = useState<number | null>(null);
  const [safetyScore,  setSafetyScore]  = useState<number | null>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    if (user?.name) setName(user.name);
    else if (user?.email) setName(user.email.split('@')[0]);
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.name)    setName(p.name);
        if (p.phone)   setPhone(p.phone);
        if (p.city)    setCity(p.city);
        if (p.profile) setSelectedProfile(p.profile);
      } catch {}
    }
  }, [user]);

  function timeAgo(d: string) {
    try {
      const diff = Date.now() - new Date(d).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days} days ago`;
      return `${Math.floor(days / 7)} weeks ago`;
    } catch { return 'recently'; }
  }

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const rRes   = await fetch(`${API}/reports`);
        const rData  = await rRes.json();
        const allReports = Array.isArray(rData) ? rData : (rData.reports || []);

        const rvRes  = await fetch(`${API}/reviews`);
        const rvData = await rvRes.json();
        const allReviews = Array.isArray(rvData) ? rvData : (rvData.reviews || rvData.data || []);

        const userReports = user
          ? allReports.filter((r: any) => r.user_id === user.id || r.username === user.email)
          : allReports;
        const userReviews = user
          ? allReviews.filter((r: any) => r.user_id === user.id || r.username === user.email)
          : allReviews;

        setReportsFiled(userReports.length);
        setReviewsGiven(userReviews.length);

        const savedRoutes = localStorage.getItem('routesCount');
        setRoutesUsed(savedRoutes ? parseInt(savedRoutes) : 0);

        const resolved = allReports.filter((r: any) => r.status === 'resolved').length;
        const total    = allReports.length || 1;
        setSafetyScore(Math.min(99, Math.round(70 + (resolved / total) * 28)));

        const acts: any[] = [];
        if (userReports.length > 0) {
          const latest = [...userReports].sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          acts.push({
            icon:'🚨',
            text:`Report submitted — ${latest.issue_type?.replace(/_/g,' ') || 'Safety Issue'}`,
            time: timeAgo(latest.created_at),
            color:'#FF3B3B',
          });
        }
        if (userReviews.length > 0) {
          const latest = [...userReviews].sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          acts.push({
            icon:'⭐',
            text:`Review submitted — ${latest.rating} star${latest.rating > 1 ? 's' : ''}`,
            time: timeAgo(latest.created_at),
            color:'#FFB020',
          });
        }
        acts.push({ icon:'👤', text:'Navigation profile active', time:'Current session', color:'#B388FF' });
        if (allReports.length > 0) {
          acts.push({ icon:'📊', text:`${allReports.length} total reports on platform`, time:'Live stat', color:'#00E5FF' });
        }
        setActivity(acts.length > 0 ? acts : [
          { icon:'🗺️', text:'Open Navigator to start your first route', time:'Get started',      color:'#00FF9C' },
          { icon:'🚨', text:'Report a safety issue in your area',        time:'Help community',   color:'#FF3B3B' },
          { icon:'⭐', text:'Leave a review after navigating',           time:'Share experience', color:'#FFB020' },
        ]);
      } catch {
        setRoutesUsed(0); setReportsFiled(0); setReviewsGiven(0); setSafetyScore(null);
        setActivity([
          { icon:'🗺️', text:'Open Navigator to start your first route', time:'Get started',      color:'#00FF9C' },
          { icon:'🚨', text:'Report a safety issue in your area',        time:'Help community',   color:'#FF3B3B' },
          { icon:'⭐', text:'Leave a review after navigating',           time:'Share experience', color:'#FFB020' },
        ]);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const handleSave = () => {
    localStorage.setItem('userProfile', JSON.stringify({ name, phone, city, profile: selectedProfile }));
    setEditing(false);
  };

  const current      = PROFILE_TYPES.find(p => p.value === selectedProfile) || PROFILE_TYPES[0];
  const displayEmail = user?.email || 'your@email.com';
  const displayName  = name || user?.name || 'Your Name';
  const userId       = user?.email
    ? 'SS-' + user.email.replace(/[@.]/g, '').substring(0, 8).toUpperCase()
    : 'SS-2026-NEW';

  const STATS = [
    { label:'Routes Used',   value: routesUsed   !== null ? String(routesUsed)          : '—', color:'#00FF9C' },
    { label:'Reports Filed', value: reportsFiled  !== null ? String(reportsFiled)         : '—', color:'#FF3B3B' },
    { label:'Reviews Given', value: reviewsGiven  !== null ? String(reviewsGiven)         : '—', color:'#FFB020' },
    { label:'Safety Score',  value: safetyScore   !== null ? `${safetyScore}/100`         : '—', color:'#00E5FF' },
  ];

  return (
    <div className="min-h-screen bg-[#05080F] pb-24">
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      <div className="z-10 border-b border-[#00E5FF]/10 bg-[#05080F]/95 backdrop-blur-lg px-6 py-4 flex items-center justify-between sticky top-0">
        <Link href="/" className="flex items-center gap-2 text-[#8892B0] hover:text-[#00E5FF] transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm font-mono">HOME</span>
        </Link>
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00FF9C]" />
          <span className="font-bold text-[#E6F1FF]">Street<span className="text-[#00FF9C]">Smart</span></span>
        </div>
        <button onClick={editing ? handleSave : () => setEditing(true)}
          className="flex items-center gap-1 text-sm font-mono transition-colors"
          style={{ color: editing ? '#00FF9C' : '#8892B0' }}>
          {editing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          {editing ? 'SAVE' : 'EDIT'}
        </button>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-8 space-y-6">

        {!user && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#FFB020]/10 border border-[#FFB020]/30">
            <span className="text-[#FFB020]">⚠️</span>
            <div>
              <p className="text-sm font-mono text-[#FFB020]">Not logged in</p>
              <p className="text-xs text-[#8892B0]">
                <Link href="/login" className="text-[#00E5FF] underline">Sign in</Link> to see your real stats and activity.
              </p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
          <div className="glass-panel rounded-2xl p-6 border border-[#00E5FF]/15"
            style={{ background:`linear-gradient(135deg, ${current.color}06, rgba(0,229,255,0.03))` }}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-[#E6F1FF]"
                  style={{ background:`linear-gradient(135deg, ${current.color}25, ${current.color}08)`, border:`2px solid ${current.color}50` }}>
                  {displayName && displayName !== 'Your Name' ? displayName[0].toUpperCase() : current.icon}
                </div>
                <motion.div className="absolute -inset-1.5 rounded-full border-2"
                  style={{ borderColor:`${current.color}40` }}
                  animate={{ rotate:360 }} transition={{ duration:8, repeat:Infinity, ease:'linear' }} />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background:current.color, color:'#05080F' }}>✓</div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                {editing ? (
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name"
                    className="text-2xl font-bold bg-transparent border-b-2 text-[#E6F1FF] outline-none mb-2 w-full placeholder-[#4A5568]"
                    style={{ borderColor:`${current.color}50` }} />
                ) : (
                  <h1 className="text-2xl font-bold text-[#E6F1FF] mb-1">
                    {displayName === 'Your Name'
                      ? <span className="text-[#4A5568] italic text-lg">Click EDIT to add your name</span>
                      : displayName}
                  </h1>
                )}
                <p className="text-[#8892B0] text-sm font-mono mb-3">{displayEmail}</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="px-3 py-1 rounded-full text-xs font-mono border"
                    style={{ borderColor:`${current.color}40`, color:current.color, background:`${current.color}12` }}>
                    {current.icon} {current.label}
                  </span>
                  {user && <span className="px-3 py-1 rounded-full text-xs font-mono border border-[#00FF9C]/30 text-[#00FF9C] bg-[#00FF9C]/08">✅ VERIFIED</span>}
                  <span className="px-3 py-1 rounded-full text-xs font-mono border border-[#B388FF]/30 text-[#B388FF] bg-[#B388FF]/08">⭐ ACTIVE</span>
                </div>
                <p className="text-xs font-mono mt-3" style={{ color:`${current.color}80` }}>{current.desc}</p>
              </div>

              <div className="text-center sm:text-right flex-shrink-0">
                <div className="font-mono text-xs text-[#8892B0] mb-1">USER ID</div>
                <div className="font-mono text-sm" style={{ color:current.color }}>{userId}</div>
                <div className="font-mono text-xs text-[#4A5568] mt-1">StreetSmart 2026</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
            <NeonCard color="#00E5FF">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-[#00E5FF]" />
                <span className="font-mono text-xs text-[#00E5FF] tracking-widest">// PERSONAL DETAILS</span>
              </div>
              {[
                { label:'Full Name', value:name,         setter:setName,  editable:true,  placeholder:'Enter your name' },
                { label:'Email',     value:displayEmail,  setter:null,    editable:false },
                { label:'Phone',     value:phone,         setter:setPhone, editable:true, placeholder:'+91 98765 43210' },
                { label:'City',      value:city,          setter:setCity,  editable:true, placeholder:'Your city' },
                { label:'Profile',   value:`${current.icon} ${current.label}`, setter:null, editable:false, color:current.color },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-[#00E5FF]/06 last:border-0">
                  <span className="text-sm text-[#8892B0]">{row.label}</span>
                  {editing && row.editable && row.setter ? (
                    <input value={row.value} onChange={e => (row.setter as any)(e.target.value)}
                      placeholder={(row as any).placeholder || ''}
                      className="text-sm bg-transparent border-b border-[#00E5FF]/30 text-[#E6F1FF] outline-none text-right max-w-40 placeholder-[#4A5568]" />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: row.color || (row.value ? '#E6F1FF' : '#4A5568') }}>
                      {row.value || <i className="text-[#4A5568] text-xs">Not set</i>}
                    </span>
                  )}
                </div>
              ))}
              {editing && (
                <GlowButton color="cyan" size="sm" className="w-full mt-3" onClick={handleSave}>
                  <Save className="w-3.5 h-3.5 mr-1" /> SAVE CHANGES
                </GlowButton>
              )}
            </NeonCard>
          </motion.div>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
            <NeonCard color="#00FF9C">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00FF9C]" />
                  <span className="font-mono text-xs text-[#00FF9C] tracking-widest">// YOUR STATS</span>
                </div>
                {statsLoading && <Loader2 className="w-3 h-3 animate-spin text-[#8892B0]" />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {STATS.map(stat => (
                  <motion.div key={stat.label} whileHover={{ scale:1.03 }}
                    className="rounded-xl p-4 text-center"
                    style={{ background:`${stat.color}08`, border:`1px solid ${stat.color}20` }}>
                    {statsLoading
                      ? <div className="flex justify-center mb-1"><Loader2 className="w-5 h-5 animate-spin" style={{ color:stat.color }} /></div>
                      : <div className="text-2xl font-bold font-mono" style={{ color:stat.color }}>{stat.value}</div>
                    }
                    <div className="text-xs text-[#8892B0] mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
              {!statsLoading && !user && (
                <p className="text-xs text-center text-[#4A5568] font-mono mt-3">
                  <Link href="/login" className="text-[#00E5FF] underline">Sign in</Link> to see your personal stats
                </p>
              )}
            </NeonCard>
          </motion.div>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
            <NeonCard color={current.color}>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4" style={{ color:current.color }} />
                <span className="font-mono text-xs tracking-widest" style={{ color:current.color }}>// NAVIGATION PROFILE</span>
              </div>
              <div className="space-y-2">
                {PROFILE_TYPES.map(profile => (
                  <motion.button key={profile.value} onClick={() => setSelectedProfile(profile.value)}
                    whileHover={{ x:4 }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left"
                    style={selectedProfile === profile.value
                      ? { background:`${profile.color}15`, border:`1px solid ${profile.color}45` }
                      : { background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-xl">{profile.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color:selectedProfile===profile.value ? profile.color : '#8892B0' }}>{profile.label}</div>
                      <div className="text-xs text-[#4A5568] mt-0.5">{profile.desc}</div>
                    </div>
                    {selectedProfile === profile.value && (
                      <span className="text-xs font-mono font-bold" style={{ color:profile.color }}>ACTIVE</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </NeonCard>
          </motion.div>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.22 }}>
            <NeonCard color="#FF3B3B">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">🆘</span>
                  <span className="font-mono text-xs text-[#FF3B3B] tracking-widest">// EMERGENCY CONTACTS</span>
                </div>
                <span className="text-xs font-mono text-[#4A5568]">{contacts.length}/{maxContacts}</span>
              </div>
              <p className="text-xs text-[#8892B0] mb-4">
                Hold the SOS button anywhere in the app to alert these contacts with your live location.
              </p>
              <div className="space-y-2 mb-4">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FF3B3B]/5 border border-[#FF3B3B]/15">
                    <div>
                      <div className="text-sm font-semibold text-[#E6F1FF]">{c.name}</div>
                      <div className="text-xs font-mono text-[#8892B0]">{c.phone}</div>
                    </div>
                    <button onClick={() => removeContact(c.id)}
                      className="text-xs font-mono text-[#FF3B3B]/70 hover:text-[#FF3B3B] px-2 py-1">
                      REMOVE
                    </button>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div className="text-xs text-[#4A5568] italic py-2">No emergency contacts added yet.</div>
                )}
              </div>
              {contacts.length < maxContacts && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    className="flex-1 bg-[#05080F]/80 border border-[#FF3B3B]/20 rounded-lg px-3 py-2 text-sm text-[#E6F1FF] placeholder-[#4A5568] focus:outline-none focus:border-[#FF3B3B]/60"
                  />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="flex-1 bg-[#05080F]/80 border border-[#FF3B3B]/20 rounded-lg px-3 py-2 text-sm text-[#E6F1FF] placeholder-[#4A5568] focus:outline-none focus:border-[#FF3B3B]/60"
                  />
                  <GlowButton
                    color="red"
                    size="md"
                    onClick={() => {
                      if (!contactName.trim() || !contactPhone.trim()) return;
                      addContact(contactName.trim(), contactPhone.trim());
                      setContactName('');
                      setContactPhone('');
                    }}
                    disabled={!contactName.trim() || !contactPhone.trim()}
                  >
                    Add
                  </GlowButton>
                </div>
              )}
            </NeonCard>
          </motion.div>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
            <NeonCard color="#00FF9C">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-[#00FF9C]" />
                <span className="font-mono text-xs text-[#00FF9C] tracking-widest">// DIGITAL ID CARD</span>
              </div>
              <motion.div whileHover={{ scale:1.01 }}
                className="rounded-xl p-5 relative overflow-hidden"
                style={{ background:'linear-gradient(135deg,#050d1a,#0a1628)', border:`1px solid ${current.color}35`, boxShadow:`0 0 30px ${current.color}10` }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                  style={{ background:current.color, filter:'blur(40px)' }} />
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-mono text-xs font-bold tracking-wider" style={{ color:current.color }}>STREETSMART</div>
                    <div className="font-mono text-xs text-[#8892B0]">VERIFIED USER</div>
                  </div>
                  <span className="text-2xl">{current.icon}</span>
                </div>
                <div className="text-lg font-bold text-[#E6F1FF] mb-1">{displayName.toUpperCase()}</div>
                <div className="font-mono text-xs mb-1" style={{ color:current.color }}>{userId}</div>
                <div className="font-mono text-xs text-[#8892B0] mb-4">PROFILE: {current.label.toUpperCase()}</div>
                <div className="h-6 rounded opacity-40"
                  style={{ background:`repeating-linear-gradient(90deg,${current.color} 0,${current.color} 2px,transparent 2px,transparent 4px,${current.color} 4px,${current.color} 5px,transparent 5px,transparent 8px,${current.color} 8px,${current.color} 11px,transparent 11px,transparent 14px)` }} />
              </motion.div>
            </NeonCard>
          </motion.div>

          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }} className="md:col-span-2">
            <NeonCard color="#FFB020">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#FFB020]" />
                  <span className="font-mono text-xs text-[#FFB020] tracking-widest">// RECENT ACTIVITY</span>
                </div>
                {statsLoading && <Loader2 className="w-3 h-3 animate-spin text-[#8892B0]" />}
              </div>
              <div className="space-y-0">
                {activity.map((item, i) => (
                  <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.35+i*0.06 }}
                    className="flex items-center gap-4 py-3 border-b border-[#FFB020]/08 last:border-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background:`${item.color}12` }}>{item.icon}</div>
                    <span className="flex-1 text-sm text-[#8892B0]">{item.text}</span>
                    <span className="text-xs font-mono text-[#4A5568] flex-shrink-0">{item.time}</span>
                  </motion.div>
                ))}
              </div>
            </NeonCard>
          </motion.div>

        </div>
      </div>
    </div>
  );
}