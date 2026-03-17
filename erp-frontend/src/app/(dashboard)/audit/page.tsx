"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ScrollText, Search, ChevronLeft, ChevronRight, User, FileText } from "lucide-react";

interface AuditLog {
    id: number;
    tenant_id: string;
    user_id: string | null;
    entity_type: string;
    entity_id: string;
    operation: string;
    old_value?: unknown;
    new_value?: unknown;
    created_at: string;
}

const LIMIT = 30;

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const [totalFetched, setTotalFetched] = useState(0);

    useEffect(() => {
        fetchLogs();
    }, [offset]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get("/audit/logs", { params: { limit: LIMIT, offset } });
            setLogs(res.data || []);
            setTotalFetched((res.data || []).length);
        } catch (err) {
            console.error(err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const nextPage = () => setOffset((o) => o + LIMIT);
    const prevPage = () => setOffset((o) => Math.max(0, o - LIMIT));
    const hasMore = totalFetched === LIMIT;

    const opColor = (op: string) => {
        if (op === "CREATE") return "text-emerald-400 bg-emerald-500/10";
        if (op === "UPDATE") return "text-amber-400 bg-amber-500/10";
        if (op === "DELETE") return "text-red-400 bg-red-500/10";
        return "text-muted-foreground bg-muted/50";
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center bg-card/80 border border-border p-6 rounded-2xl shadow-xl">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                        <ScrollText className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                            Audit Logs
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            View who changed what and when across products, vendors, orders, and more.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-border flex gap-4 bg-card">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Filter by entity type or ID (use Audit by entity API)"
                            disabled
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-muted-foreground cursor-not-allowed"
                        />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                        Showing {offset + 1}–{offset + logs.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/30 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Operation</th>
                                <th className="px-6 py-4">Entity</th>
                                <th className="px-6 py-4">Entity ID</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4 max-w-[200px]">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-foreground">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                            Loading audit logs...
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                                <ScrollText className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground">
                                                No audit entries yet. Changes to products, vendors, and purchase orders will appear here.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {new Date(log.created_at).toLocaleString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${opColor(log.operation)}`}>
                                                {log.operation}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{log.entity_type}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground truncate max-w-[120px]" title={String(log.entity_id)}>
                                            {String(log.entity_id).slice(0, 8)}…
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {log.user_id != null ? (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5" />
                                                    {String(log.user_id).slice(0, 8)}…
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px]">
                                            {log.operation === "CREATE" && (log.new_value != null) && (
                                                <span className="text-emerald-400/90 text-xs truncate block" title={typeof log.new_value === "string" ? log.new_value : JSON.stringify(log.new_value)}>
                                                    New record
                                                </span>
                                            )}
                                            {log.operation === "UPDATE" && (
                                                <span className="text-amber-400/90 text-xs">Old → New</span>
                                            )}
                                            {log.operation === "DELETE" && (
                                                <span className="text-red-400/90 text-xs">Removed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {logs.length > 0 && (
                    <div className="p-4 border-t border-border flex items-center justify-between bg-card">
                        <button
                            type="button"
                            onClick={prevPage}
                            disabled={offset === 0}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <button
                            type="button"
                            onClick={nextPage}
                            disabled={!hasMore}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
