"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useVendors, type VendorFilter } from "@/features/vendors/queries";
import { VendorCreateDialog } from "./vendor-create-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FILTERS: VendorFilter[] = ["active", "archived", "all"];

export function VendorsView() {
  const [filter, setFilter] = useState<VendorFilter>("active");
  const [searchInput, setSearchInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);
  const { data: vendors = [], isLoading, isFetching, isError } = useVendors(
    filter,
    debouncedSearch,
  );

  const activeCount = useMemo(
    () => vendors.filter((vendor) => vendor.is_active).length,
    [vendors],
  );

  return (
    <div className="space-y-6">
      {/* Header with inline stats */}
      <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-headline text-foreground">Vendors</h1>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full tabular-nums">
              {vendors.length} total
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-100 dark:bg-emerald-500/15 rounded-full tabular-nums">
              {activeCount} active
            </span>
          </div>
          {isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full shadow-md px-6">
          <Plus className="size-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      <VendorCreateDialog open={showCreate} onOpenChange={setShowCreate} />

      {/* Table card */}
      <div className="rounded-[16px] border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or code…"
              className="pl-10 rounded-full bg-card/50 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`px-3 py-1.5 text-xs rounded-full capitalize transition-colors ${
                  filter === option
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="size-4 animate-spin" />
            Loading vendors…
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive py-12 text-center">Failed to load vendors.</p>
        ) : vendors.length === 0 ? (
          <p className="py-12 text-sm text-muted-foreground text-center">No vendors found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Link
                      href={`/vendors/${vendor.id}`}
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground hover:text-primary transition-colors"
                    >
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {vendor.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{vendor.code}</TableCell>
                  <TableCell>
                    <Badge variant={vendor.is_active ? "default" : "secondary"}>
                      {vendor.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {vendor.phone || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
