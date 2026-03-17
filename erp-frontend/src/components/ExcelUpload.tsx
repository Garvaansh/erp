"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { FileSpreadsheet, Download, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";

const CHUNK_SIZE = 50;

export type ColumnHelp = { header: string; required: boolean; sample: string | number };

export type ExcelUploadProps<T> = {
    endpoint: string;
    method?: "POST";
    templateFilename: string;
    templateHeaders: string[];
    /** One sample row (same order as templateHeaders). Included in downloaded template. */
    sampleRow?: (string | number)[];
    /** Column names, required flag, and sample value for on-page help table. */
    columnsHelp?: ColumnHelp[];
    mapRow: (row: Record<string, unknown>, index: number) => T | null;
    onSuccess: (result: { created: number; total: number; error?: string }) => void;
    onClose?: () => void;
    accept?: string;
    buttonLabel?: string;
    title?: string;
};

export function ExcelUpload<T extends Record<string, unknown>>({
    endpoint,
    templateFilename,
    templateHeaders,
    sampleRow,
    columnsHelp,
    mapRow,
    onSuccess,
    onClose,
    accept = ".xlsx,.xls",
    buttonLabel = "Import from Excel",
    title = "Import from Excel",
}: ExcelUploadProps<T>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{ created: number; total: number; error?: string } | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const rows: (string | number)[][] = [templateHeaders];
        if (sampleRow && sampleRow.length === templateHeaders.length) {
            rows.push(sampleRow);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, templateFilename);
    };

    const parseFile = (f: File): Promise<T[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    if (!data || typeof data !== "string" && !(data instanceof ArrayBuffer)) {
                        reject(new Error("Could not read file"));
                        return;
                    }
                    const wb = XLSX.read(data, { type: "array" });
                    const firstSheet = wb.SheetNames[0];
                    const ws = wb.Sheets[firstSheet];
                    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
                    const out: T[] = [];
                    for (let i = 0; i < rows.length; i++) {
                        const mapped = mapRow(rows[i], i);
                        if (mapped != null) out.push(mapped);
                    }
                    resolve(out);
                } catch (err) {
                    reject(err instanceof Error ? err : new Error("Parse failed"));
                }
            };
            reader.onerror = () => reject(new Error("File read failed"));
            reader.readAsArrayBuffer(f);
        });
    };

    const uploadChunked = async (rows: T[]) => {
        let created = 0;
        let firstError: string | undefined;
        const total = rows.length;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            setProgress(Math.round(((i + chunk.length) / total) * 100));
            try {
                const { data } = await api.post<{ created: number; total: number; error?: string }>(endpoint, { rows: chunk });
                created += data?.created ?? 0;
                if (data?.error && !firstError) firstError = data.error;
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Upload failed";
                if (!firstError) firstError = msg;
            }
        }
        setProgress(100);
        setResult({ created, total, error: firstError });
        onSuccess({ created, total, error: firstError });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setResult(null);
        setParseError(null);
        try {
            const rows = await parseFile(f);
            if (rows.length === 0) {
                setParseError("No valid rows found. Check headers match the template.");
                return;
            }
            setUploading(true);
            await uploadChunked(rows);
        } catch (err) {
            setParseError(err instanceof Error ? err.message : "Failed to parse Excel");
        } finally {
            setUploading(false);
            setProgress(0);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setParseError(null);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="rounded-xl border border-border bg-card/90 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    {title}
                </h3>
                {onClose && (
                    <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            {columnsHelp && columnsHelp.length > 0 && (
                <div className="rounded-lg bg-muted/50 border border-border overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">All columns and sample. Keep header row; delete the sample row from the file before importing your data.</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-muted-foreground border-b border-border">
                                    <th className="text-left px-3 py-2 font-medium">Column</th>
                                    <th className="text-left px-3 py-2 font-medium w-20">Required</th>
                                    <th className="text-left px-3 py-2 font-medium">Sample</th>
                                </tr>
                            </thead>
                            <tbody className="text-foreground">
                                {columnsHelp.map((col, i) => (
                                    <tr key={i} className="border-b border-border last:border-0">
                                        <td className="px-3 py-2 font-mono">{col.header}</td>
                                        <td className="px-3 py-2">{col.required ? "Yes" : "Optional"}</td>
                                        <td className="px-3 py-2">{String(col.sample)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                    id="excel-upload-input"
                />
                <label
                    htmlFor="excel-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted text-sm text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-border"
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {uploading ? "Importing…" : buttonLabel}
                </label>
                <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground border border-border"
                >
                    <Download className="w-4 h-4" />
                    Download template
                </button>
            </div>
            {uploading && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            {parseError && (
                <p className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {parseError}
                </p>
            )}
            {result && !uploading && (
                <p className="text-sm text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Imported {result.created} of {result.total} rows.
                    {result.error && <span className="text-amber-400">({result.error})</span>}
                </p>
            )}
        </div>
    );
}
