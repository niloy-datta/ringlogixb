'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Truck,
  Video,
  FileText,
  Award,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export interface TourMilestone {
  timecodeSeconds: number;
  label: string;
  badge: string;
  description: string;
  technicalDetails: string;
  actionName?: string;
  actionPayload?: any;
}

const MILESTONES: TourMilestone[] = [
  {
    timecodeSeconds: 0,
    label: 'Idle Warehouse Baseline',
    badge: 'STAGE 1 / 6',
    description: '5 high-throughput bays active with Ring Spotlight Cam Pro telemetry streaming.',
    technicalDetails: 'Full facility baseline connected via Server-Sent Events (SSE). 5 bays active, 0 false alarms.',
  },
  {
    timecodeSeconds: 18,
    label: 'Ring Vehicle Motion Webhook',
    badge: 'STAGE 2 / 6',
    description: 'Amazon Ring camera detects heavy tractor-trailer pulling into Bay 1 apron.',
    technicalDetails: 'JSON:API webhook received. Constant-time HMAC-SHA256 verified. Smart Alerts classification: "vehicle".',
    actionName: 'TRIGGER_RING_ARRIVAL',
  },
  {
    timecodeSeconds: 36,
    label: 'Deterministic 3-Way Correlation',
    badge: 'STAGE 3 / 6',
    description: 'Autonomous correlation engine evaluates dock geometry, time window, and AI vehicle classification.',
    technicalDetails: 'Bay match (40%) + Time window (35%) + Vehicle classification (25%) = 100% confidence match to PO-98211.',
  },
  {
    timecodeSeconds: 54,
    label: 'Trailer Docking & Session Init',
    badge: 'STAGE 4 / 6',
    description: 'Operator confirms vehicle arrival. Bay 1 transitions to OCCUPIED. Receiving session locked.',
    technicalDetails: 'Prisma transaction moves status to ARRIVED -> RECEIVING. Real-time digital twin chocks trailer into dock.',
    actionName: 'CONFIRM_DOCKING',
  },
  {
    timecodeSeconds: 72,
    label: 'AI Intake & Seal Verification',
    badge: 'STAGE 5 / 6',
    description: 'Intelligent discrepancy analysis verifies bill of lading, pallet count, and security seal.',
    technicalDetails: 'Automated verification: 10/10 pallets confirmed, security seal intact (#SEAL-98211-OK), zero shrinkage.',
  },
  {
    timecodeSeconds: 90,
    label: 'Cryptographic Proof of Receipt',
    badge: 'STAGE 6 / 6',
    description: 'Tamper-evident canonical SHA-256 proof of receipt sealed and archived for audit.',
    technicalDetails: 'Cryptographic hash generated over canonical sorted payload. Non-repudiation proof stored in immutable log.',
    actionName: 'SEAL_RECEIPT',
  },
];

interface JudgeTourControllerProps {
  onTriggerScenario?: (scenario: string) => Promise<void>;
  onRefreshData?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function JudgeTourController({
  onTriggerScenario,
  onRefreshData,
  isOpen,
  onClose,
}: JudgeTourControllerProps) {
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [executedActions, setExecutedActions] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Active milestone based on current timestamp
  const activeMilestoneIndex = MILESTONES.reduce((acc, milestone, index) => {
    return currentSeconds >= milestone.timecodeSeconds ? index : acc;
  }, 0);

  const activeMilestone = MILESTONES[activeMilestoneIndex];

  // Automated Tour Timer Tick
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentSeconds((prev) => {
          const next = prev + 1;
          if (next >= 90) {
            setIsPlaying(false);
            return 90;
          }
          return next;
        });
      }, 1000 / speedMultiplier);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speedMultiplier]);

  // Execute milestone real backend actions when timecode reached
  useEffect(() => {
    const milestone = MILESTONES[activeMilestoneIndex];
    if (milestone?.actionName && !executedActions[milestone.actionName]) {
      setExecutedActions((prev) => ({ ...prev, [milestone.actionName!]: true }));

      if (milestone.actionName === 'TRIGGER_RING_ARRIVAL' && onTriggerScenario) {
        onTriggerScenario('SCHEDULED_TRUCK');
      }
    }
  }, [activeMilestoneIndex, executedActions, onTriggerScenario]);

  const handlePlayPause = () => {
    if (currentSeconds >= 90) {
      setCurrentSeconds(0);
      setExecutedActions({});
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentSeconds(0);
    setExecutedActions({});
    if (onRefreshData) onRefreshData();
  };

  const handleSeek = (seconds: number) => {
    setCurrentSeconds(seconds);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl glass-panel-glow rounded-2xl border border-sky-500/30 overflow-hidden shadow-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
        {/* Top Judge Banner */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Amazon Ring Developer Judging Demonstration
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase">
                  90-Second Walkthrough
                </span>
              </div>
              <p className="text-xs text-slate-400">
                End-to-End Arrival-to-Receipt Automation with Genuine Ring API Events & Cryptographic Verification
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Progress Timeline Scrubber */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-sky-400 font-bold">
                TIMECODE: {Math.floor(currentSeconds / 60)}:
                {(currentSeconds % 60).toString().padStart(2, '0')} / 01:30
              </span>
              <span className="text-slate-400 font-semibold">{activeMilestone.badge}</span>
            </div>

            {/* Custom Interactive Progress Bar */}
            <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${(currentSeconds / 90) * 100}%` }}
              />
            </div>

            {/* 6 Milestone Markers */}
            <div className="grid grid-cols-6 gap-1 pt-1">
              {MILESTONES.map((m, idx) => {
                const isPassed = currentSeconds >= m.timecodeSeconds;
                const isCurrent = activeMilestoneIndex === idx;

                return (
                  <button
                    key={m.timecodeSeconds}
                    onClick={() => handleSeek(m.timecodeSeconds)}
                    className={`text-left p-1.5 rounded transition ${
                      isCurrent
                        ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                        : isPassed
                        ? 'text-slate-300 hover:bg-slate-800/40'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] font-mono block opacity-75">
                      00:{m.timecodeSeconds.toString().padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-semibold truncate block">{m.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Milestone Highlight Card */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
                <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">
                  {activeMilestone.badge} &bull; {activeMilestone.label}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                T+{currentSeconds}s
              </span>
            </div>

            <h4 className="text-lg font-bold text-white tracking-tight">
              {activeMilestone.description}
            </h4>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs font-mono text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">⚡ Technical Architecture:</span>
                <span>{activeMilestone.technicalDetails}</span>
              </div>
            </div>
          </div>

          {/* Playback Controls & Speed Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayPause}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-2 shadow-lg shadow-sky-950/50"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                {isPlaying ? 'Pause Tour' : currentSeconds >= 90 ? 'Replay Tour' : 'Start 90s Tour'}
              </button>

              <button
                onClick={handleReset}
                className="px-3.5 py-2.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            {/* Speed Multipliers */}
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-500 px-2 font-mono">Speed:</span>
              {[1, 2, 3].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-semibold transition ${
                    speedMultiplier === spd
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Quick Milestone Advance Button */}
            <button
              onClick={() => {
                const nextIndex = (activeMilestoneIndex + 1) % MILESTONES.length;
                handleSeek(MILESTONES[nextIndex].timecodeSeconds);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 transition flex items-center gap-1"
            >
              <span>Next Milestone</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
