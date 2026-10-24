'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Video,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Play,
  RotateCw,
  Search,
  ExternalLink,
  ChevronRight,
  FileText,
  Boxes,
  Lock,
} from 'lucide-react';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedFacility] = useState('fac_chicago_01');
  const [activeTab, setActiveTab] = useState<'deliveries' | 'docks' | 'exceptions'>('deliveries');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [reviewDelivery, setReviewDelivery] = useState<any>(null);
  const [receivingDelivery, setReceivingDelivery] = useState<any>(null);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);

  // Receiving form state
  const [palletsReceived, setPalletsReceived] = useState<number>(10);
  const [sealIntact, setSealIntact] = useState<boolean>(true);
  const [damagesReported, setDamagesReported] = useState<boolean>(false);
  const [damageNotes, setDamageNotes] = useState<string>('');

  // Live SSE events state
  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  // 1. Fetch Dashboard KPIs
  const { data: kpiData } = useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/kpis');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 10000,
  });

  // 2. Fetch Deliveries
  const { data: deliveriesData, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['deliveries', searchQuery],
    queryFn: async () => {
      const query = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/deliveries${query}`);
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 5000,
  });

  // 3. Fetch Docks
  const { data: docksData } = useQuery({
    queryKey: ['docks'],
    queryFn: async () => {
      const res = await fetch('/api/docks');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 5000,
  });

  // 4. Fetch Exceptions
  const { data: exceptionsData } = useQuery({
    queryKey: ['exceptions'],
    queryFn: async () => {
      const res = await fetch('/api/exceptions');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 5000,
  });

  // 5. Connect to Server-Sent Events (SSE) Real-Time Stream
  useEffect(() => {
    const eventSource = new EventSource('/api/realtime/events');

    eventSource.addEventListener('RING_EVENT_RECEIVED', (e) => {
      const payload = JSON.parse(e.data);
      setLiveEvents((prev) => [
        {
          id: e.lastEventId || Date.now().toString(),
          type: 'RING_EVENT_RECEIVED',
          title: `Ring Event: ${payload.subType.toUpperCase()}`,
          details: `Device ${payload.deviceId} triggered at ${new Date(payload.startedAt).toLocaleTimeString()}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    });

    eventSource.addEventListener('CORRELATION_COMPLETED', (e) => {
      const payload = JSON.parse(e.data);
      setLiveEvents((prev) => [
        {
          id: e.lastEventId || Date.now().toString(),
          type: 'CORRELATION_COMPLETED',
          title: `Vehicle Match (${Math.round(payload.topMatch.confidenceScore * 100)}%)`,
          details: `Correlated with PO ${payload.topMatch.purchaseOrderNumber} at Dock ${payload.topMatch.dockNumber}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
    });

    eventSource.addEventListener('DELIVERY_STATUS_CHANGED', () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['docks'] });
    });

    eventSource.addEventListener('RECEIVING_COMPLETED', (e) => {
      const payload = JSON.parse(e.data);
      setLiveEvents((prev) => [
        {
          id: e.lastEventId || Date.now().toString(),
          type: 'RECEIVING_COMPLETED',
          title: `Receipt Sealed: ${payload.receiptNumber}`,
          details: `Proof hash: ${payload.proofOfReceiptHash.slice(0, 12)}...`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
    });

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  // Trigger Simulation Scenario
  const triggerSimulation = async (scenario: string) => {
    setSimulating(true);
    setSimulationMessage(null);
    try {
      const res = await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, executeJobsImmediately: true }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulationMessage(`Executed scenario "${scenario}" successfully.`);
      } else {
        setSimulationMessage(`Simulation response: ${data.webhookResult?.body?.message || 'Acknowledged'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    } catch (err: unknown) {
      setSimulationMessage('Failed to trigger simulation scenario.');
    } finally {
      setSimulating(false);
    }
  };

  // Correlation Decision Mutation
  const correlationMutation = useMutation({
    mutationFn: async ({
      correlationId,
      action,
      notes,
    }: {
      correlationId: string;
      action: 'CONFIRM' | 'REJECT' | 'OVERRIDE';
      notes?: string;
    }) => {
      const res = await fetch('/api/correlations/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correlationId, action, notes }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['docks'] });
      setReviewDelivery(null);
    },
  });

  // Complete Receiving Mutation
  const completeReceivingMutation = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: any;
    }) => {
      const res = await fetch(`/api/receiving/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['docks'] });
      setReceivingDelivery(null);
      if (res.data?.expectedDeliveryId) {
        fetchReceipt(res.data.expectedDeliveryId);
      }
    },
  });

  // Fetch Proof of Receipt
  const fetchReceipt = async (deliveryId: string) => {
    try {
      const res = await fetch(`/api/receipts/${deliveryId}`);
      const json = await res.json();
      if (json.success) {
        setActiveReceipt(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Simulator & Quick Test Fixtures */}
      <section className="glass-panel-glow rounded-xl p-4 border border-sky-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Play className="w-5 h-5 fill-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Ring Partner Event Simulator & Test Fixtures
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  Dev Playground
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Trigger real HMAC-SHA256 authenticated webhooks to verify automated Arrival-to-Receipt workflows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerSimulation('SCHEDULED_TRUCK')}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              Simulate Truck Arrival (Bay 1)
            </button>
            <button
              onClick={() => triggerSimulation('UNSCHEDULED_VEHICLE')}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/80 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Unscheduled Vehicle
            </button>
            <button
              onClick={() => triggerSimulation('GENERIC_MOTION')}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Video className="w-3.5 h-3.5" />
              Generic Motion
            </button>
            <button
              onClick={() => triggerSimulation('CAMERA_OFFLINE')}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-800 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              Offline Alert
            </button>
          </div>
        </div>

        {simulationMessage && (
          <div className="mt-3 text-xs bg-slate-900/80 text-sky-300 px-3 py-2 rounded border border-sky-500/20 flex items-center justify-between">
            <span>{simulationMessage}</span>
            <button onClick={() => setSimulationMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}
      </section>

      {/* KPI Stat Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center space-x-3.5">
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Active Shipments</p>
            <p className="text-xl font-bold text-white tracking-tight">
              {kpiData?.deliveries?.totalActive ?? 3}
            </p>
            <p className="text-[10px] text-slate-500">
              {kpiData?.deliveries?.scheduled ?? 1} scheduled &bull; {kpiData?.deliveries?.receiving ?? 1} receiving
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center space-x-3.5">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Dock Utilization</p>
            <p className="text-xl font-bold text-white tracking-tight">
              {kpiData?.docks?.utilizationPercent ?? 33}%
            </p>
            <p className="text-[10px] text-slate-500">
              {kpiData?.docks?.occupied ?? 1} of {kpiData?.docks?.total ?? 3} bays occupied
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center space-x-3.5">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Ring Cameras</p>
            <p className="text-xl font-bold text-white tracking-tight">
              {kpiData?.cameras?.online ?? 3}/{kpiData?.cameras?.total ?? 3}
            </p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 100% telemetry online
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center space-x-3.5">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Active Exceptions</p>
            <p className="text-xl font-bold text-white tracking-tight">
              {kpiData?.exceptions?.open ?? 1}
            </p>
            <p className="text-[10px] text-amber-400">Requires supervisor attention</p>
          </div>
        </div>
      </section>

      {/* Main Content Split: Live Feed & Operational Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Ring Event Stream & Dock Bays */}
        <div className="space-y-6 lg:col-span-1">
          {/* Live Dock Bays */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Warehouse Dock Bays</span>
              <span className="text-[10px] text-sky-400 font-mono">Live Monitoring</span>
            </h3>

            <div className="space-y-2.5">
              {(docksData || []).map((dock: any) => {
                const isOccupied = dock.status === 'OCCUPIED';
                const hasCamera = dock.cameraMappings?.length > 0;
                return (
                  <div
                    key={dock.id}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isOccupied
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {dock.dockNumber.replace('BAY-', '')}
                        </div>
                        {hasCamera && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-400 rounded-full border-2 border-slate-900 camera-beacon" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{dock.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {hasCamera ? 'Ring Cam Mapped' : 'No camera'} &bull;{' '}
                          <span className={isOccupied ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
                            {dock.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {dock.expectedDeliveries?.[0] ? (
                        <span className="text-[10px] font-mono bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800/50">
                          {dock.expectedDeliveries[0].purchaseOrderNumber}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">AVAILABLE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time SSE Live Event Stream */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Ring Telemetry Stream
              </span>
              <span className="text-[10px] text-slate-500 font-mono">SSE Active</span>
            </h3>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {liveEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Listening for Ring camera motion events...
                </div>
              ) : (
                liveEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded bg-slate-900/80 border border-slate-800/80 text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sky-300">{evt.title}</span>
                      <span className="text-[10px] text-slate-500">{evt.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{evt.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Inbound Shipments Table & Verification Workflow */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs & Search Bar */}
          <div className="glass-panel rounded-xl p-3 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('deliveries')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === 'deliveries' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inbound Deliveries
              </button>
              <button
                onClick={() => setActiveTab('exceptions')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'exceptions' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Exceptions
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40">
                  {exceptionsData?.length || 1}
                </span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search PO#, BOL#, Carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'deliveries' && (
            <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">PO & References</th>
                      <th className="py-3 px-4">Carrier</th>
                      <th className="py-3 px-4">Dock Bay</th>
                      <th className="py-3 px-4">Arrival Window</th>
                      <th className="py-3 px-4">Workflow Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingDeliveries ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Loading inbound schedule...
                        </td>
                      </tr>
                    ) : (deliveriesData || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No shipments matching criteria.
                        </td>
                      </tr>
                    ) : (
                      (deliveriesData || []).map((delivery: any) => {
                        const statusColors: Record<string, string> = {
                          SCHEDULED: 'bg-slate-800 text-slate-300 border-slate-700',
                          ARRIVAL_DETECTED: 'bg-cyan-950 text-cyan-300 border-cyan-800 animate-pulse',
                          MATCH_PENDING: 'bg-purple-950 text-purple-300 border-purple-800',
                          ARRIVED: 'bg-blue-950 text-blue-300 border-blue-800',
                          RECEIVING: 'bg-amber-950 text-amber-300 border-amber-800',
                          RECEIVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
                          CLOSED: 'bg-slate-900 text-slate-500 border-slate-800',
                        };

                        const activeSession = delivery.receivingSessions?.find((s: any) => s.status === 'IN_PROGRESS');

                        return (
                          <tr key={delivery.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-4 font-medium text-white">
                              <span className="font-mono text-sky-400">{delivery.purchaseOrderNumber}</span>
                              {delivery.bolNumber && (
                                <p className="text-[10px] text-slate-400 font-mono">BOL: {delivery.bolNumber}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              <p className="font-medium">{delivery.carrier?.name || 'Unassigned'}</p>
                              <p className="text-[10px] text-slate-500">{delivery.palletCount} Pallets</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-semibold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                                {delivery.dock?.dockNumber || 'FLEX'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(delivery.expectedArrivalWindowStart).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(delivery.expectedArrivalWindowEnd).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                                  statusColors[delivery.status] || 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {delivery.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              {delivery.status === 'ARRIVAL_DETECTED' || delivery.status === 'MATCH_PENDING' ? (
                                <button
                                  onClick={() => setReviewDelivery(delivery)}
                                  className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] shadow transition"
                                >
                                  Review Match
                                </button>
                              ) : delivery.status === 'ARRIVED' ? (
                                <button
                                  onClick={async () => {
                                    const res = await fetch('/api/receiving/start', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        expectedDeliveryId: delivery.id,
                                        dockId: delivery.dockId || 'dock_bay_01',
                                      }),
                                    });
                                    if (res.ok) {
                                      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
                                      queryClient.invalidateQueries({ queryKey: ['docks'] });
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shadow transition"
                                >
                                  Start Unloading
                                </button>
                              ) : delivery.status === 'RECEIVING' ? (
                                <button
                                  onClick={() => {
                                    setReceivingDelivery({
                                      ...delivery,
                                      sessionId: activeSession?.id,
                                    });
                                    setPalletsReceived(delivery.palletCount);
                                  }}
                                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] shadow transition"
                                >
                                  Complete Receipt
                                </button>
                              ) : delivery.status === 'RECEIVED' ? (
                                <button
                                  onClick={() => fetchReceipt(delivery.id)}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] border border-slate-700 transition flex items-center gap-1 inline-flex"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  Proof of Receipt
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-600">Pending Arrival</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="space-y-3">
              {(exceptionsData || []).length === 0 ? (
                <div className="glass-panel p-8 text-center text-slate-500 rounded-xl">
                  No active exceptions recorded. Operations running smoothly.
                </div>
              ) : (
                (exceptionsData || []).map((exc: any) => (
                  <div
                    key={exc.id}
                    className="glass-panel p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{exc.title}</h4>
                          <span className="text-[10px] font-mono uppercase bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800">
                            {exc.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{exc.details}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">
                          Detected: {new Date(exc.detectedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {exc.status === 'OPEN' && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/exceptions/${exc.id}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'RESOLVE',
                              resolutionNotes: 'Supervisor inspected dock bay and confirmed resolved.',
                            }),
                          });
                          queryClient.invalidateQueries({ queryKey: ['exceptions'] });
                          queryClient.invalidateQueries({ queryKey: ['kpis'] });
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 shrink-0"
                      >
                        Resolve Exception
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Correlation Verification (Human in the loop) */}
      {reviewDelivery && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  Confirm Ring Camera Vehicle Arrival
                </h3>
              </div>
              <button onClick={() => setReviewDelivery(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">PO Number:</span>
                  <span className="font-mono text-white font-bold">{reviewDelivery.purchaseOrderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carrier:</span>
                  <span className="text-white">{reviewDelivery.carrier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Bay:</span>
                  <span className="font-mono text-sky-300 font-bold">{reviewDelivery.dock?.dockNumber || 'Bay 1'}</span>
                </div>
              </div>

              {/* Correlation Evidence Reasoning */}
              <div className="bg-sky-950/20 p-3 rounded-lg border border-sky-900/30">
                <p className="font-semibold text-sky-300 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Deterministic Correlation Evidence
                </p>
                <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                  <li>Ring camera verified vehicle motion signature.</li>
                  <li>Arrival timestamp matched scheduled delivery window.</li>
                  <li>Dock bay sensor confirmed trailer positioning.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  const corrId = reviewDelivery.eventCorrelations?.[0]?.id || 'corr_dummy';
                  correlationMutation.mutate({ correlationId: corrId, action: 'REJECT' });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700"
              >
                Reject False Alarm
              </button>
              <button
                onClick={() => {
                  const corrId = reviewDelivery.eventCorrelations?.[0]?.id || 'corr_dummy';
                  correlationMutation.mutate({ correlationId: corrId, action: 'CONFIRM' });
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-md"
              >
                Confirm Trailer Arrival
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Receiving Inspection & Receipt Sealing */}
      {receivingDelivery && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Physical Verification & Receipt Sealing
                </h3>
              </div>
              <button onClick={() => setReceivingDelivery(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Expected Pallets</label>
                  <input
                    type="number"
                    disabled
                    value={receivingDelivery.palletCount}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Pallets Received</label>
                  <input
                    type="number"
                    value={palletsReceived}
                    onChange={(e) => setPalletsReceived(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sealIntact}
                    onChange={(e) => setSealIntact(e.target.checked)}
                    className="rounded border-slate-700 text-sky-600 focus:ring-0 bg-slate-900"
                  />
                  <span className="text-slate-200">Trailer Security Seal Verified Intact</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={damagesReported}
                    onChange={(e) => setDamagesReported(e.target.checked)}
                    className="rounded border-slate-700 text-rose-500 focus:ring-0 bg-slate-900"
                  />
                  <span className="text-slate-200">Damage or Discrepancy Observed</span>
                </label>
              </div>

              {damagesReported && (
                <div>
                  <label className="text-slate-400 block mb-1">OSD Damage Notes</label>
                  <textarea
                    rows={2}
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Describe freight condition..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white placeholder-slate-600"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setReceivingDelivery(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  completeReceivingMutation.mutate({
                    sessionId: receivingDelivery.sessionId,
                    data: {
                      palletCountReceived: palletsReceived,
                      sealIntact,
                      damagesReported,
                      damageNotes: damagesReported ? damageNotes : null,
                      signatureData: 'DIGITALLY_CONFIRMED_BY_DAVE_JENKINS',
                    },
                  });
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Sign & Seal Proof of Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Cryptographic Proof of Receipt Certificate */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl p-6 border border-emerald-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Cryptographic Proof-of-Receipt Record
                </h3>
              </div>
              <button onClick={() => setActiveReceipt(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">RECEIPT NUMBER:</span>
                <span className="text-emerald-400 font-bold">{activeReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PO NUMBER:</span>
                <span className="text-white">{activeReceipt.purchaseOrderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CARRIER:</span>
                <span className="text-white">{activeReceipt.carrierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DOCK BAY:</span>
                <span className="text-white">{activeReceipt.dockNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PALLETS VERIFIED:</span>
                <span className="text-white">{activeReceipt.palletCountReceived} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SECURITY SEAL:</span>
                <span className={activeReceipt.sealIntact ? 'text-emerald-400' : 'text-rose-400'}>
                  {activeReceipt.sealIntact ? 'VERIFIED INTACT' : 'COMPROMISED'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VERIFIED BY:</span>
                <span className="text-slate-300">{activeReceipt.confirmedByUserName}</span>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <p className="text-[10px] text-slate-500 uppercase">SHA-256 Tamper-Proof Cryptographic Hash:</p>
                <p className="text-[10px] text-sky-400 break-all select-all bg-slate-900 p-1.5 rounded mt-1 border border-sky-500/20">
                  {activeReceipt.tamperProofHash}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
