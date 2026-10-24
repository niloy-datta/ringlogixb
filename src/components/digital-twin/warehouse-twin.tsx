'use client';

import React, { useState, useMemo } from 'react';
import {
  Video,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  Maximize2,
  Eye,
  RefreshCw,
  Zap,
  Radio,
  FileCheck,
} from 'lucide-react';

export interface DockMappingItem {
  id: string;
  dockNumber: string;
  name: string;
  status: 'IDLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  cameraMappings?: Array<{
    camera: {
      id: string;
      deviceId: string;
      deviceName: string;
      isOnline: boolean;
      batteryStatus?: string;
      lastSeenAt?: string;
    };
  }>;
  expectedDeliveries?: Array<{
    id: string;
    purchaseOrderNumber: string;
    status: string;
    palletsExpected: number;
    sealNumberExpected?: string;
    carrier?: {
      name: string;
      scacCode: string;
    };
  }>;
}

interface WarehouseDigitalTwinProps {
  docks: DockMappingItem[];
  activeEvent?: any;
  onSelectDock?: (dock: DockMappingItem) => void;
  onSimulateArrival?: (deviceId: string) => void;
  onReviewDelivery?: (delivery: any) => void;
}

// 5 Specialized Dock Architectural Layouts
const DOCK_SPECS = [
  {
    dockNumber: 'BAY-01',
    label: 'Bay 1 - Heavy Pallets',
    specialty: 'High-Capacity Freight (50,000 lbs)',
    color: '#0284c7', // Sky / Cyan
    deviceId: 'ava1.ring.device.dock1',
  },
  {
    dockNumber: 'BAY-02',
    label: 'Bay 2 - Cold Chain',
    specialty: 'Refrigerated Temperature Controlled (-20°C to 4°C)',
    color: '#06b6d4', // Cyan
    deviceId: 'ava1.ring.device.dock2',
  },
  {
    dockNumber: 'BAY-03',
    label: 'Bay 3 - Fast-Turn Parcel',
    specialty: 'Automated Conveyor Sortation Intake',
    color: '#3b82f6', // Royal Blue
    deviceId: 'ava1.ring.device.dock3',
  },
  {
    dockNumber: 'BAY-04',
    label: 'Bay 4 - Secure High-Value',
    specialty: 'Cage-Enclosed Biometric Monitored High-Security',
    color: '#8b5cf6', // Violet
    deviceId: 'ava1.ring.device.dock4',
  },
  {
    dockNumber: 'BAY-05',
    label: 'Bay 5 - Bulk Inbound',
    specialty: 'Cross-Dock Transit Staging Area',
    color: '#10b981', // Emerald
    deviceId: 'ava1.ring.device.dock5',
  },
];

export function WarehouseDigitalTwin({
  docks,
  activeEvent,
  onSelectDock,
  onSimulateArrival,
  onReviewDelivery,
}: WarehouseDigitalTwinProps) {
  const [selectedBay, setSelectedBay] = useState<string>('BAY-01');
  const [showRadarCones, setShowRadarCones] = useState<boolean>(true);
  const [activeCameraFeed, setActiveCameraFeed] = useState<string | null>(null);

  // Merge database docks with static architectural specs
  const enrichedDocks = useMemo(() => {
    return DOCK_SPECS.map((spec) => {
      const dbDock = docks.find((d) => d.dockNumber === spec.dockNumber);
      const camera = dbDock?.cameraMappings?.[0]?.camera;
      const delivery = dbDock?.expectedDeliveries?.[0];

      return {
        ...spec,
        id: dbDock?.id || `dock_${spec.dockNumber.toLowerCase().replace('-', '_')}`,
        status: dbDock?.status || 'IDLE',
        camera: camera || {
          id: `cam_${spec.dockNumber}`,
          deviceId: spec.deviceId,
          deviceName: `Ring Spotlight Cam Pro - ${spec.label}`,
          isOnline: spec.dockNumber !== 'BAY-04', // default online unless simulated offline
          batteryStatus: '100% (Hardwired AC)',
          lastSeenAt: new Date().toISOString(),
        },
        delivery: delivery || null,
        dbDock,
      };
    });
  }, [docks]);

  const activeDock = enrichedDocks.find((d) => d.dockNumber === selectedBay) || enrichedDocks[0];

  return (
    <div className="relative glass-panel rounded-2xl border border-slate-800/90 overflow-hidden shadow-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Top Mission Control Header */}
      <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Layers className="w-4 h-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Warehouse Digital Twin 2.5D
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 font-semibold">
                APRON LIVE MONITOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Facility: Chicago Gateway Inbound (ORD-1)</span>
              <span>&bull;</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                5 Bays Telemetry Online
              </span>
            </p>
          </div>
        </div>

        {/* Quick View Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRadarCones(!showRadarCones)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
              showRadarCones
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {showRadarCones ? 'Radar Cones: ON' : 'Radar Cones: OFF'}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>IDLE: 3</span>
            <span className="text-slate-600">|</span>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>RECEIVING: 1</span>
            <span className="text-slate-600">|</span>
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>RESERVED: 1</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Visualizer & Detail Panel Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 relative">
        {/* 2.5D Isometric SVG Canvas (Left 8 Cols on XL) */}
        <div className="xl:col-span-8 p-4 sm:p-6 flex flex-col justify-between relative min-h-[460px]">
          {/* Subtle Ambient Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.4) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* SVG Digital Twin Floor Layout */}
          <div className="w-full h-full flex items-center justify-center">
            <svg
              viewBox="0 0 1000 520"
              className="w-full h-auto max-h-[500px] select-none filter drop-shadow-2xl"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Radar Cone Gradient */}
                <linearGradient id="cameraRadarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#0284c7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>

                {/* Camera Pulse Gradient */}
                <radialGradient id="motionPulseGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </radialGradient>

                {/* Warehouse Wall Texture */}
                <linearGradient id="wallGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                {/* Concrete Apron Ground */}
                <linearGradient id="apronGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#090d16" />
                </linearGradient>
              </defs>

              {/* Concrete Apron Floor Base */}
              <polygon
                points="40,110 960,110 990,490 10,490"
                fill="url(#apronGradient)"
                stroke="#1e293b"
                strokeWidth="2"
              />

              {/* Warehouse Building Wall Section (Top) */}
              <polygon
                points="40,25 960,25 960,110 40,110"
                fill="url(#wallGradient)"
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Roof Trim Accent Line */}
              <line x1="40" y1="25" x2="960" y2="25" stroke="#38bdf8" strokeWidth="3" opacity="0.7" />

              {/* Inbound Truck Approach Staging Lane Markings */}
              <line x1="60" y1="460" x2="940" y2="460" stroke="#334155" strokeWidth="2" strokeDasharray="12 8" />
              <line x1="80" y1="360" x2="920" y2="360" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="8 6" />
              <text x="500" y="480" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="monospace" letterSpacing="4">
                ◀ INBOUND STAGING APRON &bull; SPEED LIMIT 5 MPH ▶
              </text>

              {/* Render the 5 Loading Docks */}
              {enrichedDocks.map((dock, index) => {
                // Horizontal spacing across 5 bays: X positions centered at 140, 320, 500, 680, 860
                const bayX = 140 + index * 180;
                const isSelected = selectedBay === dock.dockNumber;
                const isOccupied = dock.status === 'OCCUPIED';
                const isReserved = dock.status === 'RESERVED';
                const isCameraOnline = dock.camera.isOnline;
                const hasDelivery = Boolean(dock.delivery);

                // Bay accent color
                const statusColor = isOccupied ? '#f59e0b' : isReserved ? '#38bdf8' : '#10b981';

                return (
                  <g
                    key={dock.dockNumber}
                    className="cursor-pointer transition-transform duration-200"
                    onClick={() => {
                      setSelectedBay(dock.dockNumber);
                      if (onSelectDock && dock.dbDock) onSelectDock(dock.dbDock);
                    }}
                  >
                    {/* Radar Coverage Cone projecting from camera lens */}
                    {showRadarCones && isCameraOnline && (
                      <polygon
                        points={`${bayX},70 ${bayX - 65},310 ${bayX + 65},310`}
                        fill="url(#cameraRadarGrad)"
                        className="radar-cone pointer-events-none"
                      />
                    )}

                    {/* Active Event Motion Pulse when detected */}
                    {showRadarCones && isCameraOnline && isOccupied && (
                      <circle
                        cx={bayX}
                        cy="95"
                        r="30"
                        fill="url(#motionPulseGrad)"
                        className="motion-radar-pulse pointer-events-none"
                      />
                    )}

                    {/* Dock Bay Door Frame (Recessed in wall) */}
                    <rect
                      x={bayX - 52}
                      y="40"
                      width="104"
                      height="70"
                      rx="4"
                      fill="#020617"
                      stroke={isSelected ? '#38bdf8' : '#334155'}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                    />

                    {/* Overhead Industrial Roll-Up Door Slats */}
                    <rect x={bayX - 48} y="44" width="96" height="10" fill="#1e293b" opacity="0.9" />
                    <rect x={bayX - 48} y="56" width="96" height="8" fill="#1e293b" opacity="0.8" />
                    <rect x={bayX - 48} y="66" width="96" height="8" fill="#1e293b" opacity="0.7" />

                    {/* Rubber Dock Bumpers (Left & Right) */}
                    <rect x={bayX - 54} y="92" width="6" height="24" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                    <rect x={bayX + 48} y="92" width="6" height="24" fill="#0f172a" stroke="#475569" strokeWidth="1" />

                    {/* Dock Hazard Striping on Apron Floor */}
                    <rect
                      x={bayX - 50}
                      y="110"
                      width="100"
                      height="12"
                      fill={isOccupied ? '#f59e0b' : '#334155'}
                      opacity={isOccupied ? 0.7 : 0.3}
                    />

                    {/* Bay Label Banner above Door */}
                    <g transform={`translate(${bayX}, 34)`}>
                      <rect
                        x="-38"
                        y="-12"
                        width="76"
                        height="18"
                        rx="3"
                        fill="#090d16"
                        stroke={statusColor}
                        strokeWidth="1.2"
                      />
                      <text
                        x="0"
                        y="1"
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {dock.dockNumber}
                      </text>
                    </g>

                    {/* Ring Spotlight Cam Pro Mount above the Bay */}
                    <g transform={`translate(${bayX}, 68)`}>
                      {/* Mounting Arm */}
                      <line x1="0" y1="-8" x2="0" y2="0" stroke="#94a3b8" strokeWidth="2.5" />
                      {/* Camera Body */}
                      <rect
                        x="-8"
                        y="0"
                        width="16"
                        height="12"
                        rx="3"
                        fill="#0f172a"
                        stroke={isCameraOnline ? '#38bdf8' : '#ef4444'}
                        strokeWidth="1.5"
                      />
                      {/* Camera Lens */}
                      <circle cx="0" cy="6" r="3" fill={isCameraOnline ? '#38bdf8' : '#ef4444'} />

                      {/* Online Status Beacon */}
                      <circle
                        cx="5"
                        cy="2"
                        r="2"
                        fill={isCameraOnline ? '#10b981' : '#ef4444'}
                        className={isCameraOnline ? 'camera-beacon' : ''}
                      />
                    </g>

                    {/* Selection Indicator Ring */}
                    {isSelected && (
                      <ellipse
                        cx={bayX}
                        cy="140"
                        rx="56"
                        ry="16"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Truck / Trailer Rendering on the Apron */}
                    {isOccupied && (
                      <g transform={`translate(${bayX}, 114)`}>
                        {/* Semi-Trailer Body (Docked Flush) */}
                        <rect
                          x="-42"
                          y="0"
                          width="84"
                          height="160"
                          rx="4"
                          fill="#0f172a"
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />

                        {/* Trailer Roof Aerodynamic Ribs */}
                        <line x1="-36" y1="20" x2="36" y2="20" stroke="#1e293b" strokeWidth="2" />
                        <line x1="-36" y1="50" x2="36" y2="50" stroke="#1e293b" strokeWidth="2" />
                        <line x1="-36" y1="80" x2="36" y2="80" stroke="#1e293b" strokeWidth="2" />
                        <line x1="-36" y1="110" x2="36" y2="110" stroke="#1e293b" strokeWidth="2" />
                        <line x1="-36" y1="140" x2="36" y2="140" stroke="#1e293b" strokeWidth="2" />

                        {/* Trailer Carrier Logo / Badge */}
                        <rect x="-30" y="45" width="60" height="24" rx="2" fill="#0284c7" opacity="0.3" />
                        <text
                          x="0"
                          y="61"
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {dock.delivery?.carrier?.name?.split(' ')[0] || 'SWIFT'}
                        </text>

                        {/* Trailer Rear Door / Safety Latch */}
                        <line x1="-42" y1="4" x2="42" y2="4" stroke="#f59e0b" strokeWidth="2.5" />

                        {/* Truck Cab (Facing away, outbound) */}
                        <path
                          d="M -36 160 L 36 160 L 32 210 L -32 210 Z"
                          fill="#1e293b"
                          stroke="#334155"
                          strokeWidth="1.5"
                        />
                        {/* Cab Windshield */}
                        <polygon points="-24,195 24,195 20,205 -20,205" fill="#38bdf8" opacity="0.3" />
                        {/* Exhaust Stacks */}
                        <circle cx="-34" cy="168" r="3" fill="#64748b" />
                        <circle cx="34" cy="168" r="3" fill="#64748b" />

                        {/* Live Receiving Correlation Beam from Camera to Trailer */}
                        <line
                          x1="0"
                          y1="-44"
                          x2="0"
                          y2="50"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          className="beam-line"
                        />

                        {/* Status Label on Trailer */}
                        <g transform="translate(0, 105)">
                          <rect
                            x="-32"
                            y="-10"
                            width="64"
                            height="18"
                            rx="3"
                            fill="#020617"
                            stroke="#f59e0b"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="2"
                            textAnchor="middle"
                            fill="#fbbf24"
                            fontSize="8"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            RECEIVING
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Approaching Truck for RESERVED / SCHEDULED Bays */}
                    {isReserved && hasDelivery && (
                      <g transform={`translate(${bayX}, 250)`}>
                        {/* Truck in Staging Lane */}
                        <rect
                          x="-38"
                          y="0"
                          width="76"
                          height="120"
                          rx="4"
                          fill="#0f172a"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                        />
                        <text
                          x="0"
                          y="50"
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {dock.delivery?.carrier?.name?.split(' ')[0] || 'INBOUND'}
                        </text>
                        <text
                          x="0"
                          y="70"
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="8"
                          fontFamily="monospace"
                        >
                          APPROACHING
                        </text>
                      </g>
                    )}

                    {/* Idle Bay Guide Lines & Wheel Chocks */}
                    {!isOccupied && !isReserved && (
                      <g transform={`translate(${bayX}, 130)`}>
                        <line x1="-36" y1="0" x2="-36" y2="120" stroke="#334155" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="36" y1="0" x2="36" y2="120" stroke="#334155" strokeWidth="2" strokeDasharray="6 4" />
                        <rect x="-30" y="25" width="60" height="12" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                        <text
                          x="0"
                          y="34"
                          textAnchor="middle"
                          fill="#10b981"
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          BAY IDLE
                        </text>
                      </g>
                    )}

                    {/* HUD Badge Floating Below Bay */}
                    <g transform={`translate(${bayX}, 420)`}>
                      <rect
                        x="-48"
                        y="-16"
                        width="96"
                        height="32"
                        rx="6"
                        fill="#090d16"
                        stroke={isSelected ? '#38bdf8' : '#1e293b'}
                        strokeWidth={isSelected ? '1.5' : '1'}
                      />
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                        fontSize="9"
                        fontWeight="bold"
                      >
                        {dock.label.split(' - ')[1] || 'Standard Bay'}
                      </text>
                      <text
                        x="0"
                        y="10"
                        textAnchor="middle"
                        fill={statusColor}
                        fontSize="8"
                        fontWeight="semibold"
                        fontFamily="monospace"
                      >
                        {dock.status}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Quick Bay Navigation Bar (Bottom of 2.5D visualizer) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[11px] font-mono">
              Click any bay to inspect Ring telemetry, active trailer, or trigger arrival.
            </span>
            <div className="flex items-center gap-1.5">
              {enrichedDocks.map((d) => (
                <button
                  key={d.dockNumber}
                  onClick={() => setSelectedBay(d.dockNumber)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition ${
                    selectedBay === d.dockNumber
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {d.dockNumber}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Bay Detail Drawer (Right 4 Cols on XL) */}
        <div className="xl:col-span-4 p-5 bg-slate-950/80 border-t xl:border-t-0 xl:border-l border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            {/* Bay Title & Badge */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                  {activeDock.dockNumber} TELEMETRY
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">{activeDock.label}</h3>
                <p className="text-xs text-slate-400">{activeDock.specialty}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                  activeDock.status === 'OCCUPIED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : activeDock.status === 'RESERVED'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {activeDock.status}
              </span>
            </div>

            {/* Ring Camera Status Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 mb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-sky-400" />
                  Ring Partner Camera
                </span>
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                    activeDock.camera.isOnline
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeDock.camera.isOnline ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                    }`}
                  />
                  {activeDock.camera.isOnline ? '1080p HDR ONLINE' : 'TELEMETRY LOST'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-500 block text-[9px] uppercase">Device ID</span>
                  <span className="text-slate-300 font-semibold">{activeDock.camera.deviceId}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <span className="text-slate-500 block text-[9px] uppercase">Power / Battery</span>
                  <span className="text-emerald-400 font-semibold">{activeDock.camera.batteryStatus || 'AC Hardwired'}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>Smart Alerts: Vehicle &bull; Human</span>
                <span>Night Vision: Color HDR</span>
              </div>
            </div>

            {/* Active Inbound Shipment Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-sky-400" />
                  Assigned Shipment
                </span>
                {activeDock.delivery ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                    {activeDock.delivery.status}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">NO ACTIVE SHIPMENT</span>
                )}
              </div>

              {activeDock.delivery ? (
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Carrier:</span>
                    <span className="text-white font-semibold">{activeDock.delivery.carrier?.name || 'Swift Transport'}</span>
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-400">Purchase Order:</span>
                    <span className="text-sky-300 font-bold">{activeDock.delivery.purchaseOrderNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Expected Cargo:</span>
                    <span className="text-slate-200">{activeDock.delivery.palletsExpected} Pallets &bull; Intact Seal</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-1 italic">
                  Dock is idle and ready for incoming vehicle approach or assignment.
                </p>
              )}
            </div>
          </div>

          {/* Interactive Trigger & Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => onSimulateArrival && onSimulateArrival(activeDock.camera.deviceId)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-sky-950/40"
            >
              <Zap className="w-4 h-4 fill-white" />
              Simulate Ring Arrival at {activeDock.dockNumber}
            </button>

            {activeDock.delivery && onReviewDelivery && (
              <button
                onClick={() => onReviewDelivery(activeDock.delivery)}
                className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                Inspect Delivery Details & PO
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
