'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Video,
  Truck,
  ShieldCheck,
  FileCheck,
  Layers,
  Award,
  Zap,
} from 'lucide-react';

export interface DemoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessScenario?: () => void;
}

const SCENARIO_DEFS = [
  {
    id: 'A',
    title: 'Scenario A: Normal Truck Arrival & Clean Receipt',
    subtitle: 'Full 90s Autonomous Workflow',
    description:
      'Genuine Ring vehicle motion event at Bay 1 correlates with PO-98211 at 100%. Operator confirms arrival, receiving completes with 10/10 pallets and intact seal. Canonical SHA-256 receipt sealed.',
    tag: 'SUCCESS PATH',
    tagColor: 'emerald',
    icon: Truck,
  },
  {
    id: 'B',
    title: 'Scenario B: Unscheduled Vehicle Exception',
    subtitle: 'Security & Manifest Anomaly',
    description:
      'Tractor-trailer detected at Bay 3 with zero scheduled appointments on file. Matching engine rejects correlation and automatically generates a HIGH-severity UNSCHEDULED_VEHICLE alert.',
    tag: 'EXCEPTION',
    tagColor: 'rose',
    icon: AlertTriangle,
  },
  {
    id: 'C',
    title: 'Scenario C: Overlapping Appointments Review',
    subtitle: 'Disambiguation & Operator In-The-Loop',
    description:
      'Two carriers arrive within the same 15-minute grace window. Score delta is < 5%, prompting state machine to transition into MATCH_PENDING to require manual operator confirmation.',
    tag: 'HUMAN-IN-THE-LOOP',
    tagColor: 'amber',
    icon: Layers,
  },
  {
    id: 'D',
    title: 'Scenario D: Missing Pallets & Broken Seal Alert',
    subtitle: 'Cargo Shrinkage & Tamper Detection',
    description:
      'Cold Chain trailer at Bay 2 arrives with broken seal and 2 pallets short. Discrepancy Risk Engine calculates risk score = 75, filing an automated DISCREPANCY_FOUND exception.',
    tag: 'RISK DETECTION',
    tagColor: 'rose',
    icon: ShieldCheck,
  },
  {
    id: 'E',
    title: 'Scenario E: Offline Camera Degraded Operation',
    subtitle: 'Hardware Resilience & Fail-Safe',
    description:
      'Bay 4 camera drops connection. Real Ring device_offline event updates status to offline and triggers CAMERA_OFFLINE exception, enabling manual operator intake fallback.',
    tag: 'TELEMETRY LOSS',
    tagColor: 'rose',
    icon: Video,
  },
  {
    id: 'F',
    title: 'Scenario F: Duplicate & Out-of-Order Webhooks',
    subtitle: 'Idempotency & State Machine Safety',
    description:
      'Re-transmits identical webhook payload. System returns duplicate_ignored within SLA. Then attempts illegal state machine transition, which is strictly blocked.',
    tag: 'IDEMPOTENCY & SAFETY',
    tagColor: 'sky',
    icon: Zap,
  },
];

export function DemoStudioModal({
  isOpen,
  onClose,
  onSuccessScenario,
}: DemoStudioModalProps) {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setLastResult(null);
    try {
      const res = await fetch('/api/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const json = await res.json();
      if (json.success) {
        setLastResult(json.data);
        if (onSuccessScenario) onSuccessScenario();
      } else {
        alert(`Error executing scenario: ${json.error}`);
      }
    } catch (err: unknown) {
      alert('Failed to execute demo scenario');
    } finally {
      setRunningScenario(null);
    }
  };

  const handleResetBaseline = async () => {
    setResetting(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('Warehouse facility baseline successfully restored.');
        if (onSuccessScenario) onSuccessScenario();
      }
    } catch {
      alert('Failed to reset facility baseline');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] glass-panel-glow rounded-2xl border border-sky-500/30 overflow-hidden shadow-2xl flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  DockFlow AI Demo Studio & Judging Lab
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-bold uppercase">
                  Development Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deterministic one-click execution of 6 operational scenarios with real database persistence.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetBaseline}
              disabled={resetting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              Reset Facility Baseline
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Active Outcome Card if Scenario Executed */}
          {lastResult && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    Executed {lastResult.title}
                  </span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                  STATUS: {lastResult.status}
                </span>
              </div>

              <div className="space-y-1 pl-7 text-xs font-mono text-slate-300">
                {lastResult.stepsExecuted.map((step: string, idx: number) => (
                  <p key={idx} className="text-emerald-300/90">{step}</p>
                ))}
              </div>

              {lastResult.evidence?.proofOfReceiptHash && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-slate-400">
                    Proof-of-Receipt SHA-256: {lastResult.evidence.proofOfReceiptHash}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 6 Scenario Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCENARIO_DEFS.map((sc) => {
              const Icon = sc.icon;
              const isRunning = runningScenario === sc.id;

              return (
                <div
                  key={sc.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {sc.tag}
                      </span>
                      <Icon className="w-4 h-4 text-sky-400" />
                    </div>

                    <h4 className="text-sm font-bold text-white tracking-tight">{sc.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{sc.description}</p>
                  </div>

                  <button
                    onClick={() => handleRunScenario(sc.id)}
                    disabled={runningScenario !== null}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    <Play className={`w-3.5 h-3.5 fill-white ${isRunning ? 'animate-spin' : ''}`} />
                    {isRunning ? 'Executing Real Workflow...' : 'Execute Scenario'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
