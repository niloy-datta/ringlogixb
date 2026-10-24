'use client';

import React from 'react';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  Shield,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

export interface IntelligenceEvidence {
  dockMatch?: {
    matched: boolean;
    dockNumber?: string;
    cameraId?: string;
    scoreWeight: number;
    contribution: number;
  };
  timeWindowMatch?: {
    matched: boolean;
    windowStart?: string;
    windowEnd?: string;
    deviationMinutes?: number;
    scoreWeight: number;
    contribution: number;
  };
  classificationMatch?: {
    subType?: string;
    isVehicle?: boolean;
    scoreWeight: number;
    contribution: number;
  };
  summaryReasoning?: string[];
}

export interface CandidateItem {
  deliveryId: string;
  purchaseOrderNumber: string;
  carrierName: string;
  dockNumber: string;
  confidenceScore: number;
}

export interface ShipmentIntelligenceProps {
  purchaseOrderNumber: string;
  carrierName: string;
  confidenceScore: number;
  evidence?: IntelligenceEvidence;
  alternativeMatches?: CandidateItem[];
  engineType?: 'AMAZON_BEDROCK' | 'RULE_BASED';
  engineLabel?: string;
  onConfirmMatch?: () => void;
  onRejectMatch?: () => void;
}

export function ShipmentIntelligencePanel({
  purchaseOrderNumber,
  carrierName,
  confidenceScore,
  evidence,
  alternativeMatches = [],
  engineType = 'RULE_BASED',
  engineLabel = 'Rule-Based Analysis (Bedrock Offline/Unconfigured)',
  onConfirmMatch,
  onRejectMatch,
}: ShipmentIntelligenceProps) {
  const percentScore = Math.round(confidenceScore * 100);

  // Compute breakdown points
  const dockScore = Math.round((evidence?.dockMatch?.contribution ?? 0.4) * 100);
  const timeScore = Math.round((evidence?.timeWindowMatch?.contribution ?? 0.35) * 100);
  const classScore = Math.round((evidence?.classificationMatch?.contribution ?? 0.25) * 100);

  // Determine uncertainty reason
  const uncertaintyReasons: string[] = [];
  if (percentScore < 85) {
    if (evidence?.timeWindowMatch && (evidence.timeWindowMatch.deviationMinutes ?? 0) > 15) {
      uncertaintyReasons.push(
        `Carrier arrived ${(evidence.timeWindowMatch.deviationMinutes ?? 0).toFixed(0)}m outside optimal appointment window.`
      );
    }
    if (evidence?.classificationMatch?.subType !== 'vehicle') {
      uncertaintyReasons.push('Motion event lacked high-confidence Ring Smart Alerts vehicle classification.');
    }
    if (!evidence?.dockMatch?.matched) {
      uncertaintyReasons.push('Arrived at unassigned bay rather than scheduled dock reservation.');
    }
    if (uncertaintyReasons.length === 0) {
      uncertaintyReasons.push('Overlapping appointments within facility grace window.');
    }
  }

  // Recommended human action
  let suggestedAction = 'Proceed with trailer check-in and dock assignment.';
  if (percentScore >= 90) {
    suggestedAction = 'High confidence match: One-click supervisor confirmation recommended.';
  } else if (percentScore >= 70) {
    suggestedAction = 'Medium confidence: Verify bill of lading (BOL) and driver credentials before docking.';
  } else {
    suggestedAction = 'Low confidence / Unscheduled: Require physical driver paperwork review.';
  }

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90">
      {/* Header with Engine Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              Explainable Shipment Intelligence
            </h3>
            <p className="text-xs text-slate-400">
              PO {purchaseOrderNumber} &bull; {carrierName}
            </p>
          </div>
        </div>

        {/* Engine Attribution Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border bg-slate-900 border-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              engineType === 'AMAZON_BEDROCK' ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className={engineType === 'AMAZON_BEDROCK' ? 'text-indigo-300 font-semibold' : 'text-amber-300'}>
            {engineLabel}
          </span>
        </div>
      </div>

      {/* Match Confidence Score Gauge & Visual Contribution Bar */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Autonomous Correlation Confidence
            </span>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span
                className={`text-3xl font-extrabold tracking-tight font-mono ${
                  percentScore >= 85 ? 'text-emerald-400' : percentScore >= 65 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {percentScore}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {percentScore >= 85 ? 'STRONG CORRELATION' : percentScore >= 65 ? 'REVIEW ADVISED' : 'MANUAL REVIEW REQUIRED'}
              </span>
            </div>
          </div>

          <div className="text-right text-xs font-mono text-slate-400">
            <span>Threshold: &ge; 75% Auto-Dock</span>
          </div>
        </div>

        {/* Multi-segment Weighted Contribution Bar */}
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${(dockScore / 100) * 100}%` }}
            className="bg-sky-500 transition-all duration-500 relative group"
            title={`Dock Assignment: +${dockScore}%`}
          />
          <div
            style={{ width: `${(timeScore / 100) * 100}%` }}
            className="bg-indigo-500 transition-all duration-500 relative group"
            title={`Time Window: +${timeScore}%`}
          />
          <div
            style={{ width: `${(classScore / 100) * 100}%` }}
            className="bg-emerald-500 transition-all duration-500 relative group"
            title={`Vehicle Classification: +${classScore}%`}
          />
        </div>

        {/* Legend Breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span className="text-[11px] font-semibold">Dock Geometry (40%)</span>
            </div>
            <p className="text-base font-bold text-white font-mono">+{dockScore}%</p>
            <p className="text-[10px] text-slate-500 truncate">
              {evidence?.dockMatch?.matched ? 'Assigned Bay Matched' : 'Unassigned / Alternate'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="text-[11px] font-semibold">Time Window (35%)</span>
            </div>
            <p className="text-base font-bold text-white font-mono">+{timeScore}%</p>
            <p className="text-[10px] text-slate-500 truncate">
              {evidence?.timeWindowMatch?.matched ? 'Inside Window' : 'Outside Target Window'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-semibold">Vehicle Class (25%)</span>
            </div>
            <p className="text-base font-bold text-white font-mono">+{classScore}%</p>
            <p className="text-[10px] text-slate-500 truncate">
              {evidence?.classificationMatch?.isVehicle ? 'Ring Smart Alert: Vehicle' : 'Generic Motion'}
            </p>
          </div>
        </div>
      </div>

      {/* Uncertainty & Margin of Error Reasons */}
      {uncertaintyReasons.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Uncertainty & Variance Analysis</span>
          </div>
          <ul className="list-disc list-inside text-amber-200/80 space-y-0.5 text-[11px] pl-1">
            {uncertaintyReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Next Human Operator Action */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-start gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div>
          <span className="text-slate-400 font-semibold block text-[11px] uppercase">
            Suggested Next Human Action
          </span>
          <p className="text-slate-200 font-medium mt-0.5">{suggestedAction}</p>
        </div>
      </div>

      {/* Alternative Candidate Matches */}
      {alternativeMatches.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Alternative Correlated Shipments
          </span>
          <div className="space-y-1.5">
            {alternativeMatches.map((cand) => (
              <div
                key={cand.deliveryId}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-slate-200">{cand.purchaseOrderNumber}</span>
                  <span className="text-slate-500 text-[11px] ml-2">{cand.carrierName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {Math.round(cand.confidenceScore * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-600">&bull; Dock {cand.dockNumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons if Callbacks Provided */}
      {(onConfirmMatch || onRejectMatch) && (
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          {onRejectMatch && (
            <button
              onClick={onRejectMatch}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 transition"
            >
              Reject Match
            </button>
          )}
          {onConfirmMatch && (
            <button
              onClick={onConfirmMatch}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
            >
              Confirm & Transition to Arrived
            </button>
          )}
        </div>
      )}
    </div>
  );
}
