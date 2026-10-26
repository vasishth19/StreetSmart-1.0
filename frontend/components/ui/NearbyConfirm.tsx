'use client';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getIssueIcon, getIssueLabel } from '@/lib/reportMeta';
import type { NearbyReport } from '@/hooks/useNearbyReports';

export default function NearbyConfirm({
  prompt, onAnswer, onSkip,
}: {
  prompt: NearbyReport | null;
  onAnswer: (stillPresent: boolean) => Promise<{ ok: boolean; message: string }>;
  onSkip: () => void;
}) {
  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="glass-panel rounded-2xl p-4 w-[300px] border border-[#FFB020]/40"
        >
          <div className="text-[10px] font-mono text-[#FFB020] tracking-wider mb-1">REPORTED NEAR YOU</div>
          <div className="text-sm text-[#E6F1FF] font-semibold mb-1">
            {getIssueIcon(prompt.issue_type)} {getIssueLabel(prompt.issue_type)}
          </div>
          {prompt.description && <div className="text-[11px] text-[#8892B0] mb-3 line-clamp-2">{prompt.description}</div>}
          <div className="text-[11px] text-[#E6F1FF] mb-2">Is this still a problem here?</div>
          <div className="flex gap-2">
            <button onClick={async () => { const r = await onAnswer(true); r.ok ? toast.success(r.message) : toast.error(r.message); }}
              className="flex-1 py-2 rounded-lg text-xs font-mono font-bold bg-[#FF3B3B]/15 text-[#FF3B3B] border border-[#FF3B3B]/30">Still there</button>
            <button onClick={async () => { const r = await onAnswer(false); r.ok ? toast.success(r.message) : toast.error(r.message); }}
              className="flex-1 py-2 rounded-lg text-xs font-mono font-bold bg-[#00FF9C]/15 text-[#00FF9C] border border-[#00FF9C]/30">Fixed</button>
            <button onClick={onSkip} className="px-3 py-2 rounded-lg text-xs font-mono text-[#8892B0] border border-[#1a2a4a]">Skip</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
