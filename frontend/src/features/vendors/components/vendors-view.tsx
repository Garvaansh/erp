"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Search,
  X,
  Check,
  Ban,
  Pencil,
  ChevronDown,
  Loader2,
  FileText,
} from "lucide-react";
import { getVendors, createVendor, updateVendor } from "@/features/vendors/api";
import type {
  Vendor,
  CreateVendorPayload,
  UpdateVendorPayload,
} from "@/features/vendors/types";
import { vendorsKeys } from "@/lib/react-query/keys";

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
      <Check className="size-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/30">
      <Ban className="size-3" /> Inactive
    </span>
  );
}

function CreateVendorSlideout({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (p: CreateVendorPayload) => createVendor(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorsKeys.list() });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      setError("Vendor name is required");
      return;
    }
    mutation.mutate({
      name,
      contact_person: String(fd.get("contact_person") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      address: String(fd.get("address") ?? "").trim(),
      gstin: String(fd.get("gstin") ?? "").trim(),
      payment_terms: String(fd.get("payment_terms") ?? "").trim(),
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[var(--sidebar)] border-l border-[var(--erp-border-subtle)] shadow-2xl erp-slide-in overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--erp-accent-glow)] text-[var(--erp-accent)]">
              <Building2 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--erp-text-primary)]">
                New Vendor
              </h2>
              <p className="text-[10px] text-[var(--erp-text-muted)]">
                Register a supplier
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            {
              name: "name",
              label: "Company Name",
              required: true,
              placeholder: "e.g. Tata Steel Ltd",
              icon: Building2,
            },
            {
              name: "contact_person",
              label: "Contact Person",
              placeholder: "Full name",
              icon: UserPlus,
            },
            {
              name: "phone",
              label: "Phone",
              placeholder: "+91 ...",
              icon: Phone,
            },
            {
              name: "email",
              label: "Email",
              placeholder: "vendor@company.com",
              icon: Mail,
            },
            {
              name: "gstin",
              label: "GSTIN",
              placeholder: "22AAAAA0000A1Z5",
              icon: FileText,
            },
            {
              name: "payment_terms",
              label: "Payment Terms",
              placeholder: "Net 30",
              icon: CreditCard,
            },
          ].map(({ name, label, required, placeholder, icon: Icon }) => (
            <div key={name}>
              <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
                {label}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 focus-within:border-[var(--erp-accent)] transition-colors">
                <Icon className="size-4 text-[var(--erp-text-muted)] shrink-0" />
                <input
                  name={name}
                  type="text"
                  required={required}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
                />
              </div>
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-[var(--erp-text-secondary)] mb-1.5">
              Address
            </label>
            <textarea
              name="address"
              rows={2}
              placeholder="Full address"
              className="w-full rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none focus:border-[var(--erp-accent)] transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:from-[var(--erp-accent-bright)] hover:to-cyan-400 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Building2 className="size-4" />
                Register Vendor
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditVendorRow({
  vendor,
  onDone,
}: {
  vendor: Vendor;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const toggle = useMutation({
    mutationFn: (p: UpdateVendorPayload) => updateVendor(vendor.id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorsKeys.list() });
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ is_active: !vendor.is_active })}
        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${vendor.is_active ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"}`}
      >
        {vendor.is_active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-[var(--erp-bg-surface)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text-primary)] transition-colors"
      >
        Cancel
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}

export function VendorsView() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    data: vendors = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: vendorsKeys.list(),
    queryFn: getVendors,
    refetchOnWindowFocus: false,
  });

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.gstin.toLowerCase().includes(search.toLowerCase()) ||
      v.contact_person.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="erp-section-title mb-1">Supplier Network</p>
          <h1 className="text-2xl font-bold text-[var(--erp-text-primary)]">
            Vendor Management
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:from-[var(--erp-accent-bright)] hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Building2 className="size-3.5" /> Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card-static p-4 flex items-center gap-4">
          <Building2 className="size-5 text-[var(--erp-accent)]" />
          <div>
            <p className="erp-kpi-label">Total Vendors</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {vendors.length}
            </p>
          </div>
        </div>
        <div className="erp-card-static p-4 flex items-center gap-4">
          <Check className="size-5 text-[var(--erp-success)]" />
          <div>
            <p className="erp-kpi-label">Active</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {vendors.filter((v) => v.is_active).length}
            </p>
          </div>
        </div>
        <div className="erp-card-static p-4 flex items-center gap-4">
          <CreditCard className="size-5 text-purple-400" />
          <div>
            <p className="erp-kpi-label">With GSTIN</p>
            <p className="text-xl font-bold text-[var(--erp-text-primary)] tabular-nums">
              {vendors.filter((v) => v.gstin).length}
            </p>
          </div>
        </div>
      </div>

      <div className="erp-card-static overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--erp-border-subtle)] p-4">
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-1.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Search className="size-4 text-[var(--erp-text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors..."
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
            </div>
          </div>
          <span className="text-xs text-[var(--erp-text-muted)]">
            {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 text-[var(--erp-accent)] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-red-400">
            Failed to load vendors.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Building2 className="size-10 text-[var(--erp-text-muted)]" />
            <p className="text-sm text-[var(--erp-text-muted)]">
              {search ? "No vendors match" : "No vendors registered"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table w-full">
              <thead>
                <tr>
                  <th className="erp-table-th text-left">Vendor</th>
                  <th className="erp-table-th text-left">Contact</th>
                  <th className="erp-table-th text-left">GSTIN</th>
                  <th className="erp-table-th text-left">Terms</th>
                  <th className="erp-table-th text-left">Status</th>
                  <th className="erp-table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => (
                  <tr
                    key={v.id}
                    className="erp-table-row erp-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="erp-table-td">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--erp-accent)] to-teal-600 text-xs font-bold text-white shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--erp-text-primary)] truncate">
                            {v.name}
                          </p>
                          {v.email && (
                            <p className="text-[10px] text-[var(--erp-text-muted)] truncate">
                              {v.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="erp-table-td">
                      <div>
                        {v.contact_person && (
                          <p className="text-xs text-[var(--erp-text-primary)]">
                            {v.contact_person}
                          </p>
                        )}
                        {v.phone && (
                          <p className="text-[10px] text-[var(--erp-text-muted)]">
                            {v.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="erp-table-td">
                      <span className="text-xs text-[var(--erp-text-secondary)] font-mono">
                        {v.gstin || "—"}
                      </span>
                    </td>
                    <td className="erp-table-td">
                      <span className="text-xs text-[var(--erp-text-secondary)]">
                        {v.payment_terms || "—"}
                      </span>
                    </td>
                    <td className="erp-table-td">{statusBadge(v.is_active)}</td>
                    <td className="erp-table-td text-right">
                      {editingId === v.id ? (
                        <EditVendorRow
                          vendor={v}
                          onDone={() => setEditingId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(v.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--erp-bg-surface)] border border-[var(--erp-border-default)] px-2.5 py-1 text-[10px] font-semibold text-[var(--erp-text-secondary)] hover:border-[var(--erp-accent)] hover:text-[var(--erp-accent)] transition-colors"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateVendorSlideout
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
