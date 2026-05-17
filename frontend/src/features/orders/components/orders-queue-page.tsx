"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrdersList } from "@/features/orders/hooks/use-orders";
import { getOrderErrorMessage } from "@/features/orders/utils/errors";
import { OrderListTable } from "@/features/orders/components/order-list-table";
import type { OrderListRow, OrderStatus } from "@/features/orders/types";

type StatusFilter = "ALL" | OrderStatus;

function matchesSearch(row: OrderListRow, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return [
    row.order_number,
    row.customer_display_name,
    row.customer_company_name,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function withinDateRange(row: OrderListRow, from: string, to: string) {
  const value = row.order_date ? new Date(row.order_date) : null;
  if (!value || Number.isNaN(value.getTime())) {
    return true;
  }

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (value < fromDate) {
      return false;
    }
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    if (value > toDate) {
      return false;
    }
  }

  return true;
}

export function OrdersQueuePage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ordersQuery = useOrdersList({
    page,
    page_size: pageSize,
    status: status === "ALL" ? "" : status,
    search,
    date_from: dateFrom,
    date_to: dateTo,
  });

  const filteredRows = useMemo(() => {
    const rows = ordersQuery.data?.items ?? [];
    return rows.filter(
      (row) => matchesSearch(row, search) && withinDateRange(row, dateFrom, dateTo),
    );
  }, [dateFrom, dateTo, ordersQuery.data?.items, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[24px] border bg-background px-6 py-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Orders Queue
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Operational sales orders
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review reservation-ready orders, dispatch progress, and document status
            from one quiet workspace.
          </p>
        </div>

        <Link
          href="/orders/new"
          className={buttonVariants({ className: "rounded-full px-6" })}
        >
          <Plus className="mr-2 size-4" />
          Create Order
        </Link>
      </header>

      <Card className="rounded-[24px]">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filter queue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Search order or customer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="RESERVED">Reserved</SelectItem>
              <SelectItem value="PARTIALLY_DISPATCHED">
                Partially Dispatched
              </SelectItem>
              <SelectItem value="DISPATCHED">Dispatched</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </CardContent>
      </Card>

      {ordersQuery.isLoading ? (
        <div className="rounded-xl border bg-background px-4 py-10 text-sm text-muted-foreground">
          Loading orders...
        </div>
      ) : ordersQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-sm text-destructive">
          {getOrderErrorMessage(
            ordersQuery.error,
            "Unable to load orders right now.",
          )}
        </div>
      ) : (
        <>
          <OrderListTable rows={filteredRows} />

          <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Page {page} · showing {filteredRows.length} order
              {filteredRows.length === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ArrowLeft className="mr-2 size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(ordersQuery.data?.items?.length ?? 0) < pageSize}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
