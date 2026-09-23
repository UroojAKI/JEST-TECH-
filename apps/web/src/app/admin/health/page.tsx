'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useSystemHealth } from '../../../hooks/useAdmin';

export default function InfrastructureHealthPage() {
  const { data: health, isLoading, isError } = useSystemHealth();

  const isHealthy = health?.status === 'ok';
  const dbStatus = health?.checks?.database?.status || 'unknown';
  const dbLatency = health?.checks?.database?.latencyMs;
  const redisStatus = health?.checks?.redis?.status || 'disabled';
  const redisLatency = health?.checks?.redis?.latencyMs;
  const memoryHeapUsed = health?.checks?.memory?.heapUsedMB;
  const memoryHeapLimit = health?.checks?.memory?.heapLimitMB || 512;
  const memoryStatus = health?.checks?.memory?.status || 'ok';
  const outboxPending = health?.checks?.outbox?.pendingEvents ?? 0;
  const outboxStatus = health?.checks?.outbox?.status || 'ok';
  const diskStatus = health?.checks?.disk?.status || 'ok';

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" /> Infrastructure Health & Queue Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Real-time authoritative health monitoring for NestJS API, PostgreSQL connection pool, Redis cache, and transactional outbox
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isLoading ? (
            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold text-xs flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Polling System Status...
            </span>
          ) : isHealthy ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-xs flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Systems Operational
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-xs flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Systems Degraded / Attention Required
            </span>
          )}
        </div>
      </div>

      {/* Infrastructure Components Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-2xl border bg-card shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-muted-foreground text-[10px] uppercase">NestJS REST API</span>
            <Server className={`h-4 w-4 ${isHealthy ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className={`text-lg font-black ${isHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isLoading ? 'Checking...' : isHealthy ? '200 OK' : 'Degraded'}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {health?.uptime ? `Uptime: ${Math.round(health.uptime)}s` : 'NestJS v10.x API'}
          </span>
        </div>

        <div className="p-4 rounded-2xl border bg-card shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-muted-foreground text-[10px] uppercase">PostgreSQL Database</span>
            <Database className={`h-4 w-4 ${dbStatus === 'ok' ? 'text-emerald-500' : 'text-destructive'}`} />
          </div>
          <div className={`text-lg font-black ${dbStatus === 'ok' ? 'text-emerald-600' : 'text-destructive'}`}>
            {isLoading ? 'Checking...' : dbStatus === 'ok' ? 'Connected' : 'Disconnected'}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {dbLatency !== undefined ? `Ping Latency: ${dbLatency}ms` : 'Prisma Connection Pool'}
          </span>
        </div>

        <div className="p-4 rounded-2xl border bg-card shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-muted-foreground text-[10px] uppercase">Redis Cache & Queues</span>
            <RefreshCw className={`h-4 w-4 ${redisStatus === 'ok' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </div>
          <div className={`text-lg font-black ${redisStatus === 'ok' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {isLoading ? 'Checking...' : redisStatus === 'ok' ? 'Connected' : redisStatus === 'disabled' ? 'Disabled (In-Memory)' : 'Offline'}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {redisLatency !== undefined && redisLatency > 0 ? `Latency: ${redisLatency}ms` : 'Cache Provider'}
          </span>
        </div>

        <div className="p-4 rounded-2xl border bg-card shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-muted-foreground text-[10px] uppercase">Process Heap Memory</span>
            <Cpu className={`h-4 w-4 ${memoryStatus === 'ok' ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className={`text-lg font-black ${memoryStatus === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {memoryHeapUsed ? `${memoryHeapUsed} MB / ${memoryHeapLimit} MB` : 'Monitoring...'}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {diskStatus === 'ok' ? 'Local / Vault Storage Ready' : 'Storage Degraded'}
          </span>
        </div>
      </div>

      {/* BullMQ / Transactional Outbox Dashboard */}
      <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-sm">Transactional Outbox & Event Stream</h3>
          <span className="text-[10px] font-mono text-muted-foreground">
            Status: {outboxStatus.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border bg-muted/10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Outbox Events</span>
            <div className={`text-lg font-black ${outboxPending > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {outboxPending} Pending
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-muted/10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Outbox Engine</span>
            <div className="text-lg font-black text-primary">
              {outboxStatus === 'ok' ? 'Active' : 'Attention'}
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-muted/10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Storage File System</span>
            <div className="text-lg font-black text-foreground">
              {diskStatus === 'ok' ? 'Ready' : 'Error'}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
