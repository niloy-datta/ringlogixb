'use client';

import React, { useState } from 'react';
import {
  Video,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Boxes,
  Lock,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

export interface TimelineEntry {
  id: string;
  type:
    | 'RING_EVENT'
    | 'CORRELATION_COMPLETED'
    | 'DELIVERY_STATUS_CHANGED'
    | 'RECEIVING_COMPLETED'
    | 'EXCEPTION_RAISED';
  timestamp: string;
  title: string;
  details: string;
  badge?: string;
  badgeColor?: 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';
  metadata?: Record<string, any>;
}

interface ActivityTimelineProps {
  entries: TimelineEntry[];
  onViewReceipt?: (deliveryId: string) => void;
  onViewException?: (exceptionId: string) => void;
  onViewEvent?: (eventId: string) => void;
}

export function ActivityTimeline({
  entries,
  onViewReceipt,
  onViewException,
  onViewEvent,
}: ActivityTimelineProps) {
  const [filter, setFilter] = useState<'ALL' | 'RING' | 'EXCEPTIONS' | 'RECEIPTS'>('ALL');

  const filteredEntries = entries.filter((e) => {
    if (filter === 'RING') return e.type === 'RING_EVENT';
    if (filter === 'EXCEPTIONS') return e.type === 'EXCEPTION_RAISED';
    if (filter === 'RECEIPTS') return e.type === 'RECEIVING_COMPLETED';
    return true;
  });

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      case 'amber':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'rose':
        return 'bg-rose-950 text-rose-400 border-rose-800';
      case 'indigo':
        return 'bg-indigo-950 text-indigo-400 border-indigo-800';
      default:
        return 'bg-sky-950 text-sky-400 border-sky-800';
    }
  };

  const getIcon = (type: TimelineEntry['type']) => {
    switch (type) {
      case 'RING_EVENT':
        return <Video className="w-4 h-4 text-sky-400" />;
      case 'CORRELATION_COMPLETED':
        return <Truck className="w-4 h-4 text-indigo-400" />;
      case 'DELIVERY_STATUS_CHANGED':
        return <Boxes className="w-4 h-4 text-amber-400" />;
      case 'RECEIVING_COMPLETED':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'EXCEPTION_RAISED':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
      {/* Timeline Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            Synchronized Operations Timeline
          </h3>
          <p className="text-[11px] text-slate-500">
            Real-time audit log of Ring camera events, state machine steps, and cryptographic receipts.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          {(['ALL', 'RING', 'EXCEPTIONS', 'RECEIPTS'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                filter === f
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL'
                ? 'All'
                : f === 'RING'
                ? 'Ring Camera'
                : f === 'EXCEPTIONS'
                ? 'Exceptions'
                : 'Receipts'}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="relative pl-6 space-y-4 max-h-[460px] overflow-y-auto pr-2 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No events logged for this filter. Waiting for operational events...
          </div>
        ) : (
          filteredEntries.map((item) => (
            <div key={item.id} className="relative group">
              {/* Timeline Dot Icon */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                {getIcon(item.type)}
              </div>

              {/* Event Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white tracking-tight">{item.title}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border ${getBadgeStyle(
                          item.badgeColor
                        )}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                </div>

                <p className="text-xs text-slate-300">{item.details}</p>

                {/* Optional Metadata / Action Link */}
                {item.metadata?.proofOfReceiptHash && (
                  <div className="pt-2 flex items-center justify-between text-[11px] font-mono border-t border-slate-800/80">
                    <span className="text-slate-500 truncate max-w-[280px]">
                      Hash: {item.metadata.proofOfReceiptHash.slice(0, 24)}...
                    </span>
                    {onViewReceipt && item.metadata.deliveryId && (
                      <button
                        onClick={() => onViewReceipt(item.metadata?.deliveryId)}
                        className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                      >
                        <span>Verify Certificate</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
