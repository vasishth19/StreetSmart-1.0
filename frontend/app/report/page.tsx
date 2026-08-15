'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle, ThumbsUp, Camera, Upload, X, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import GlowButton from '@/components/ui/GlowButton';
import NeonCard from '@/components/ui/NeonCard';
import { apiService } from '@/services/api';
import { ISSUE_TYPES, SEVERITIES } from '@/lib/reportMeta';

interface ExistingReport {
  id: string;
  issue_type: string;
  severity: string;
  description: string;
  status: string;
  votes: number;
  address?: string;
  created_at: string;
  lat: number;
  lng: number;
}


export default function ReportPage() {
  const [issueType, setIssueType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ExistingReport[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [reporterContact, setReporterContact] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files].slice(0, 5));
  };
  const removeFile = (idx: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles(prev => [...prev, ...files].slice(0, 5));
  };
  
  useEffect(() => {
  apiService.getReports().then(data => {
    if (Array.isArray(data)) setReports(data);
  }).catch(() => {});
}, []);

  const handleSubmit = async () => {
    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }
    if (description.length < 10) {
      toast.error('Please provide a description (min 10 characters)');
      return;
    }

    setLoading(true);
    try {
      await apiService.submitReport({
        lat: 26.8467,
        lng: 80.9462,
        issue_type: issueType as any,
        severity: severity as any,
        description,
        address,
        anonymous,
        reporter_contact: anonymous ? undefined : (reporterContact || undefined),
      });

      const newReport: ExistingReport = {
        id: Date.now().toString(),
        issue_type: issueType,
        severity,
        description,
        status: 'reported',
        votes: 0,
        address,
        created_at: new Date().toISOString().split('T')[0],
        lat: 26.8467,
        lng: 80.9462,
      };
      setReports(prev => [newReport, ...prev]);
      setSubmitted(true);
      toast.success('Report submitted! Thank you for making the city safer.');
    } catch (error: any) {
      // Do NOT fake success — a report that fails to save must be surfaced,
      // otherwise it silently vanishes on refresh with no way to know why.
      const message = error instanceof TypeError
        ? 'Cannot reach the server. Check that the backend is running and reachable.'
        : (error?.response?.data?.detail || error?.message || 'Could not submit report — please try again.');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (id: string) => {
    if (votedIds.has(id)) return;
    setVotedIds(prev => new Set([...prev, id]));
    setReports(prev => prev.map(r => r.id === id ? { ...r, votes: r.votes + 1 } : r));
    toast.success('Vote recorded!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#00FF9C';
      case 'investigating': return '#FFB020';
      default: return '#8892B0';
    }
  };

  const getIssueLabel = (type: string) =>
    ISSUE_TYPES.find(i => i.value === type)?.label || type.replace(/_/g, ' ');
  const getIssueIcon = (type: string) =>
    ISSUE_TYPES.find(i => i.value === type)?.icon || '📍';

  return (
    <div className="min-h-screen bg-[#05080F] grid-overlay">
      <div className="scanlines pointer-events-none fixed inset-0 z-0" />

      {/* Header */}
      <div className="z-10 border-b border-[#FF3B3B]/10 bg-[#05080F]/90 backdrop-blur-lg sticky top-0">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#8892B0] hover:text-[#00E5FF] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-bold text-[#E6F1FF]">
                Community <span className="text-[#FF3B3B]">Reports</span>
              </h1>
              <p className="text-xs text-[#8892B0] font-mono">Report safety & accessibility issues</p>
            </div>
          </div>
          <div className="font-mono text-xs text-[#8892B0]">
            {reports.length} active reports
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ═══ SUBMIT FORM ═══ */}
          <div>
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <NeonCard color="#FF3B3B" className="space-y-6">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#FF3B3B]" />
                      <h2 className="font-semibold text-[#E6F1FF]">Submit New Report</h2>
                    </div>

                    {/* Issue Type */}
                    <div>
                      <label className="block text-xs text-[#8892B0] font-mono mb-3">
                        ISSUE TYPE *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {ISSUE_TYPES.map(type => (
                          <button
                            key={type.value}
                            onClick={() => setIssueType(type.value)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg text-xs text-left transition-all ${
                              issueType === type.value
                                ? 'border text-[#E6F1FF]'
                                : 'border border-[#8892B0]/20 text-[#8892B0] hover:border-[#8892B0]/40'
                            }`}
                            style={issueType === type.value ? {
                              borderColor: `${type.color}50`,
                              background: `${type.color}10`,
                              color: type.color
                            } : {}}
                          >
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Severity */}
                    <div>
                      <label className="block text-xs text-[#8892B0] font-mono mb-3">
                        SEVERITY *
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {SEVERITIES.map(sev => (
                          <button
                            key={sev.value}
                            onClick={() => setSeverity(sev.value)}
                            className={`p-2 rounded-lg text-xs text-center transition-all border ${
                              severity === sev.value
                                ? 'text-[#E6F1FF]'
                                : 'border-[#8892B0]/20 text-[#8892B0] hover:border-[#8892B0]/40'
                            }`}
                            style={severity === sev.value ? {
                              borderColor: `${sev.color}50`,
                              background: `${sev.color}10`,
                              color: sev.color
                            } : {}}
                          >
                            {sev.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-xs text-[#8892B0] font-mono mb-2">
                        ADDRESS (optional)
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8892B0]" />
                        <input
                          type="text"
                          placeholder="Street address or intersection"
                          value={address}
                          onChange={e => setAddress(e.target.value)}
                          className="w-full bg-[#05080F]/80 border border-[#00E5FF]/20 rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#E6F1FF] placeholder-[#4A5568] focus:outline-none focus:border-[#00E5FF]/60 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-[#8892B0] font-mono mb-2">
                        DESCRIPTION * (min 10 characters)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Describe the issue in detail..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-[#05080F]/80 border border-[#00E5FF]/20 rounded-lg px-4 py-2.5 text-sm text-[#E6F1FF] placeholder-[#4A5568] focus:outline-none focus:border-[#00E5FF]/60 transition-colors resize-none"
                      />
                      <div className="text-xs text-[#4A5568] font-mono mt-1 text-right">
                        {description.length}/500
                      </div>
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="block text-xs text-[#8892B0] font-mono mb-2">
                        📸 ATTACH PHOTO / VIDEO EVIDENCE (optional, max 5 files)
                      </label>
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-6 text-center relative transition-all cursor-pointer ${dragOver ? 'border-[#00E5FF]/60 bg-[#00E5FF]/05' : 'border-[#00E5FF]/20 hover:border-[#00E5FF]/40'}`}
                      >
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="text-3xl mb-2">📸</div>
                        <div className="text-sm text-[#E6F1FF] font-medium mb-1">Click to upload or drag &amp; drop</div>
                        <div className="text-xs text-[#4A5568] mb-2">Take a photo, record a video or select from gallery</div>
                        <div className="flex gap-2 justify-center flex-wrap">
                          {['JPG','PNG','MP4','MOV','HEIC'].map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-xs font-mono bg-[#00E5FF]/08 border border-[#00E5FF]/15 text-[#00E5FF]">{t}</span>
                          ))}
                        </div>
                      </div>
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {attachedFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#00FF9C]/08 border border-[#00FF9C]/20 text-[#00FF9C]">
                              <span>{f.type.startsWith('video') ? '🎥' : '📸'}</span>
                              <span className="max-w-24 truncate">{f.name}</span>
                              <button onClick={() => removeFile(i)} className="text-[#FF3B3B] hover:text-[#FF6B6B] ml-1 font-bold">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Anonymous Reporting Toggle */}
                    <div className="rounded-lg border border-[#8892B0]/20 bg-[#05080F]/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono text-[#E6F1FF] flex items-center gap-1.5">
                            🕵️ REPORT ANONYMOUSLY
                          </div>
                          <p className="text-xs text-[#8892B0] mt-0.5">
                            {anonymous
                              ? 'Your identity will not be collected or stored with this report.'
                              : 'Add optional contact info so authorities can follow up with you.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={anonymous}
                          onClick={() => setAnonymous(prev => !prev)}
                          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                            anonymous ? 'bg-[#00FF9C]/70' : 'bg-[#8892B0]/30'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#05080F] transition-transform ${
                              anonymous ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      {!anonymous && (
                        <input
                          type="text"
                          placeholder="Email or phone (optional)"
                          value={reporterContact}
                          onChange={e => setReporterContact(e.target.value)}
                          className="w-full mt-3 bg-[#05080F]/80 border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-sm text-[#E6F1FF] placeholder-[#4A5568] focus:outline-none focus:border-[#00E5FF]/60 transition-colors"
                        />
                      )}
                    </div>

                    <GlowButton
                      color="red"
                      className="w-full"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                          Submit Report
                        </>
                      )}
                    </GlowButton>
                  </NeonCard>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 rounded-full bg-[#00FF9C]/10 border border-[#00FF9C]/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[#00FF9C]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#00FF9C] mb-2">Report Submitted!</h3>
                  <p className="text-[#8892B0] text-sm mb-6">
                    Thank you for helping make the city safer.
                    Your report has been shared with city authorities.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setIssueType('');
                      setDescription('');
                      setAddress('');
                      setAnonymous(true);
                      setReporterContact('');
                    }}
                    className="text-sm text-[#00E5FF] hover:underline"
                  >
                    Submit another report
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══ EXISTING REPORTS ═══ */}
          <div>
            <h2 className="font-semibold text-[#E6F1FF] mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#00E5FF]" />
              Community Reports
            </h2>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              {reports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <NeonCard color={getStatusColor(report.status)}>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 text-xl mt-0.5">
                        {getIssueIcon(report.issue_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-[#E6F1FF] capitalize">
                            {getIssueLabel(report.issue_type)}
                          </span>
                          <span
                            className="text-xs font-mono px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                            style={{
                              color: getStatusColor(report.status),
                              background: `${getStatusColor(report.status)}15`,
                              border: `1px solid ${getStatusColor(report.status)}30`
                            }}
                          >
                            {report.status}
                          </span>
                        </div>
                        {report.address && (
                          <div className="text-xs text-[#8892B0] flex items-center gap-1 mb-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {report.address}
                          </div>
                        )}
                        <p className="text-xs text-[#8892B0] mb-2 line-clamp-2">
                          {report.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#4A5568] font-mono">{report.created_at}</span>
                          <button
                            onClick={() => handleVote(report.id)}
                            disabled={votedIds.has(report.id)}
                            className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded transition-all ${
                              votedIds.has(report.id)
                                ? 'text-[#00FF9C] bg-[#00FF9C]/10'
                                : 'text-[#8892B0] hover:text-[#00FF9C] hover:bg-[#00FF9C]/5'
                            }`}
                          >
                            <ThumbsUp className="w-2.5 h-2.5" />
                            {report.votes}
                          </button>
                        </div>
                      </div>
                    </div>
                  </NeonCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}