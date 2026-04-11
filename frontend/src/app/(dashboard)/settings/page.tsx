"use client";

import { Zap, Shield, Bell, Database, Globe, Palette, Users, Lock, Server } from "lucide-react";

const SETTING_SECTIONS = [
  {
    title: "System Configuration",
    items: [
      { icon: Database, label: "Database Connection", desc: "PostgreSQL connection pool settings", status: "Connected" },
      { icon: Server, label: "API Gateway", desc: "Backend service endpoint configuration", status: "Active" },
      { icon: Globe, label: "Timezone & Locale", desc: "Regional settings and date formats", status: "IST (UTC+5:30)" },
    ],
  },
  {
    title: "Security & Access",
    items: [
      { icon: Shield, label: "Authentication", desc: "JWT token configuration and session management", status: "AES-256" },
      { icon: Lock, label: "RBAC Policies", desc: "Role-based access control definitions", status: "3 roles" },
      { icon: Users, label: "Active Sessions", desc: "Currently authenticated user sessions", status: "14 active" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: Palette, label: "Appearance", desc: "Theme and display customization", status: "Dark Mode" },
      { icon: Bell, label: "Notifications", desc: "Alert thresholds and delivery channels", status: "Enabled" },
      { icon: Zap, label: "Performance", desc: "Cache settings and data refresh intervals", status: "Optimized" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="erp-section-title mb-1">Administration</p>
        <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--erp-text-muted)] mt-1">
          System configuration and operational parameters.
        </p>
      </div>

      {SETTING_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--erp-text-primary)] uppercase tracking-wider">
            {section.title}
          </h2>
          <div className="space-y-2">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className="w-full flex items-center gap-4 erp-card-static p-4 text-left hover:border-[var(--erp-border-accent)] transition-all group"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)] group-hover:bg-[var(--erp-accent-glow-strong)] transition-colors">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--erp-text-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--erp-text-muted)]">{item.desc}</p>
                  </div>
                  <span className="erp-badge erp-badge--accent shrink-0">{item.status}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
