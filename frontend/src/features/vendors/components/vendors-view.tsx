"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Loader2, Plus, Search, Archive } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useVendors, type VendorFilter } from "@/features/vendors/queries";
import { VendorCreateDialog } from "./vendor-create-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const countLabel = useMemo(
    () => `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`,
    [vendors.length],
  );
  const activeCount = useMemo(
    () => vendors.filter((vendor) => vendor.is_active).length,
    [vendors],
  );
  const archivedCount = Math.max(vendors.length - activeCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <p className="text-sm text-muted-foreground">
            CQRS-backed vendor directory
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" />
          Add Vendor
        </Button>
      </div>

      <VendorCreateDialog open={showCreate} onOpenChange={setShowCreate} />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Visible Vendors</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <p className="text-2xl font-semibold">{vendors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <p className="text-2xl font-semibold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archived</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Archive className="size-4 text-amber-500" />
            <p className="text-2xl font-semibold">{archivedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor Directory</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option}
              variant={filter === option ? "default" : "outline"}
              type="button"
              onClick={() => setFilter(option)}
              className="capitalize"
            >
              {option}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or code"
              className="w-64"
            />
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{countLabel}</span>
          {isFetching ? <span>Refreshing...</span> : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-cyan-600" />
          </div>
        ) : isError ? (
          <p className="py-6 text-sm text-red-400">Failed to load vendors.</p>
        ) : vendors.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No vendors found.</p>
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
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="inline-flex items-center gap-2 hover:text-cyan-400"
                      >
                        <Building2 className="size-4" />
                        {vendor.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">{vendor.code}</TableCell>
                    <TableCell>
                      <Badge variant={vendor.is_active ? "default" : "secondary"}>
                        {vendor.is_active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.phone || "-"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
