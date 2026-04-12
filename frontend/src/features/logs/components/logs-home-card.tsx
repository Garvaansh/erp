"use client";

import Link from "next/link";
import { Thermometer, Droplets, Wind, Gauge, Plus, Radio } from "lucide-react";

// Mock data for the production logs display (matches Stitch design)
const MOCK_LOG_ENTRIES = [
  {
    id: "1",
    timestamp: "14:32:08.443",
    machine: "MILL-A1",
    event: "Quality Check",
    status: "OPTIMAL",
    metric: "0.98mm SEV",
    statusClass: "erp-badge--success",
  },
  {
    id: "2",
    timestamp: "14:31:56.109",
    machine: "PRESS-04",
    event: "Telemetry Sync",
    status: "WARNING",
    metric: "86.4 kN PEAK",
    statusClass: "erp-badge--warning",
  },
  {
    id: "3",
    timestamp: "14:31:30.321",
    machine: "LATHE-Z2",
    event: "Maintenance Alert",
    status: "CRITICAL",
    metric: "TEMP > 85°C",
    statusClass: "erp-badge--critical",
  },
  {
    id: "4",
    timestamp: "14:30:44.012",
    machine: "ROBOT-X9",
    event: "Shift Start",
    status: "ACTIVE",
    metric: "OPERATOR_ID:",
    statusClass: "erp-badge--accent",
  },
  {
    id: "5",
    timestamp: "14:10:32.884",
    machine: "MILL-A1",
    event: "Quality Check",
    status: "OPTIMAL",
    metric: "0.98mm SEV",
    statusClass: "erp-badge--success",
  },
  {
    id: "6",
    timestamp: "14:10:16.776",
    machine: "PRESS-04",
    event: "Cycle Complete",
    status: "ACTIVE",
    metric: "—",
    statusClass: "erp-badge--accent",
  },
];

const FLOOR_GRID = [
  {
    id: "MILL-A1",
    status: "OPTIMAL",
    load: "78%",
    color: "var(--erp-success)",
  },
  {
    id: "PRESS-04",
    status: "WARNING",
    load: "16%",
    color: "var(--erp-warning)",
  },
  {
    id: "LATHE-Z2",
    status: "CRITICAL",
    load: "—",
    color: "var(--erp-critical)",
  },
  { id: "ROBOT-X9", status: "ACTIVE", load: "92%", color: "var(--erp-accent)" },
];

export function LogsHomeCard() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">System Environment</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Production Logs
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="erp-kpi-label">Active Threads</span>
            <span className="text-lg font-bold text-[var(--erp-accent)] tabular-nums">
              1,248 p/s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="erp-kpi-label">System Health</span>
            <span className="text-lg font-bold text-[var(--erp-success)] tabular-nums">
              99.98%
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="erp-badge erp-badge--neutral">Filters</button>
        <button className="erp-badge erp-badge--neutral">
          All Machine IDs
        </button>
        <button className="erp-badge erp-badge--neutral">All Severities</button>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors">
          Export JSON
        </button>
        <Link
          href="/logs/add"
          className="flex items-center gap-2 rounded-lg bg-[var(--erp-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors"
        >
          <Plus className="size-3.5" />
          Execute Task
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Live Operational Stream */}
        <div className="lg:col-span-2 erp-card-static overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--erp-border-subtle)]">
            <div className="flex items-center gap-2">
              <Radio className="size-3.5 text-[var(--erp-success)] animate-pulse" />
              <span className="erp-kpi-label">Live Operational Stream</span>
            </div>
            <span className="text-[10px] text-[var(--erp-text-muted)] font-mono">
              REAL-TIME/60000MS
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Machine ID</th>
                  <th>Event Type</th>
                  <th>Status</th>
                  <th>Metric</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_LOG_ENTRIES.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className="erp-fade-in"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <td className="font-mono text-xs text-[var(--erp-text-muted)]">
                      {entry.timestamp}
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-[var(--erp-text-primary)]">
                        {entry.machine}
                      </span>
                    </td>
                    <td className="text-sm text-[var(--erp-text-secondary)]">
                      {entry.event}
                    </td>
                    <td>
                      <span className={`erp-badge ${entry.statusClass}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-[var(--erp-text-muted)]">
                      {entry.metric}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[var(--erp-border-subtle)]">
            <button className="text-xs font-semibold text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] uppercase tracking-wider transition-colors">
              Load Previous Trace Blocks
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-5">
          {/* Floor Grid Status */}
          <div className="erp-card-static p-5">
            <p className="erp-kpi-label mb-4">Floor Grid Status</p>
            <div className="space-y-2.5">
              {FLOOR_GRID.map((machine) => (
                <div key={machine.id} className="flex items-center gap-3">
                  <span
                    className="erp-status-dot"
                    style={{
                      background: machine.color,
                      boxShadow: `0 0 6px ${machine.color}`,
                    }}
                  />
                  <span className="flex-1 font-mono text-xs font-medium text-[var(--erp-text-primary)]">
                    {machine.id}
                  </span>
                  <span className="text-[10px] text-[var(--erp-text-muted)]">
                    {machine.load}
                  </span>
                  <div className="w-16 h-1.5 rounded-full bg-[var(--erp-bg-surface)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: machine.load === "—" ? "0%" : machine.load,
                        background: machine.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Velocity */}
          <div className="erp-card-static p-5">
            <p className="erp-kpi-label mb-2">Shift Velocity</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[var(--erp-text-primary)] tabular-nums">
                424
              </span>
              <span className="text-xs text-[var(--erp-success)] font-medium mb-1">
                +2% vs LY
              </span>
            </div>
            <p className="text-[10px] text-[var(--erp-text-muted)] mt-1">
              Units processed since 06:00 AM
            </p>
          </div>

          {/* Environmental Scan */}
          <div className="erp-card-static p-5">
            <p className="erp-kpi-label mb-4">Environmental Scan</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Droplets className="size-4 text-[var(--erp-info)]" />
                <div>
                  <p className="text-[10px] text-[var(--erp-text-muted)] uppercase">
                    Humidity
                  </p>
                  <p className="text-sm font-bold text-[var(--erp-text-primary)]">
                    42%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="size-4 text-[var(--erp-warning)]" />
                <div>
                  <p className="text-[10px] text-[var(--erp-text-muted)] uppercase">
                    Temp
                  </p>
                  <p className="text-sm font-bold text-[var(--erp-text-primary)]">
                    22.4°C
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="size-4 text-[var(--erp-success)]" />
                <div>
                  <p className="text-[10px] text-[var(--erp-text-muted)] uppercase">
                    Particles
                  </p>
                  <p className="text-sm font-bold text-[var(--erp-text-primary)]">
                    0.02 ppm
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-[var(--erp-accent)]" />
                <div>
                  <p className="text-[10px] text-[var(--erp-text-muted)] uppercase">
                    Vibration
                  </p>
                  <p className="text-sm font-bold text-[var(--erp-text-primary)]">
                    0.8 Hz
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Event Density + Bottleneck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-4">Event Density Chart</p>
          <div className="flex items-end gap-1 h-20">
            {[35, 50, 20, 65, 40, 55, 30, 70, 45, 60, 25, 80, 50, 35].map(
              (h, i) => (
                <div
                  key={i}
                  className="flex-1 erp-bar"
                  style={{ height: `${h}%` }}
                />
              ),
            )}
          </div>
        </div>
        <div className="erp-card-static p-5">
          <p className="erp-kpi-label mb-2">Primary Bottleneck Identified</p>
          <h3 className="text-lg font-bold text-[var(--erp-text-primary)] mb-2">
            Lathe Section Z2
          </h3>
          <p className="text-xs text-[var(--erp-text-muted)] mb-4">
            Thermal variance exceeding threshold since M/C5. Maintenance
            dispatch initiated.
          </p>
          <div className="flex gap-2">
            <button className="rounded-lg bg-[var(--erp-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:bg-[var(--erp-accent-bright)] transition-colors">
              Alert Supervisor
            </button>
            <button className="rounded-lg border border-[var(--erp-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] transition-colors">
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
