"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRawMaterialMaster } from "@/features/inventory/queries";

function formatKg(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

function statusVariant(status: "LOW" | "OK"): "secondary" | "default" {
  return status === "LOW" ? "secondary" : "default";
}

export function RawMaterialsOverviewPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const materialsQuery = useRawMaterialMaster();
  const rows = materialsQuery.data ?? [];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.sku,
        row.name,
        row.specification,
        row.status,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          Raw Materials
        </h1>
        <p className="text-sm text-muted-foreground">
          Operational inventory view for available stock, reservations, and procurement coverage.
        </p>
      </header>

      <section className="rounded-xl border bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, material, specification"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Specification</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Reserved Qty</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">Pending Deliveries</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.item_id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/inventory/raw-materials/${row.item_id}`)
                  }
                >
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.specification || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.available_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.reserved_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.threshold)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.pending_deliveries)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}

              {!materialsQuery.isLoading && filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No raw materials found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

