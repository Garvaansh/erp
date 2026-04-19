"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getVendors } from "@/features/vendors/api";
import { vendorsKeys } from "@/lib/react-query/keys";

type VendorDetailPageProps = {
  params: Promise<{
    vendorId: string;
  }>;
};

function showValue(value?: string): string {
  if (!value) {
    return "-";
  }

  const trimmed = value.trim();
  return trimmed || "-";
}

export default function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { vendorId } = use(params);

  const vendorsQuery = useQuery({
    queryKey: vendorsKeys.list(),
    queryFn: getVendors,
  });

  if (vendorsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Link
          href="/procurement/vendors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Vendors
        </Link>
        <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
          Loading vendor details...
        </div>
      </div>
    );
  }

  if (vendorsQuery.isError) {
    return (
      <div className="space-y-4">
        <Link
          href="/procurement/vendors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Vendors
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load vendor details.
        </div>
      </div>
    );
  }

  const vendor = (vendorsQuery.data ?? []).find((row) => row.id === vendorId);

  if (!vendor) {
    return (
      <div className="space-y-4">
        <Link
          href="/procurement/vendors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Vendors
        </Link>
        <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
          Vendor not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{vendor.name}</h1>
          <p className="text-sm text-muted-foreground">
            Vendor ID: {vendor.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={vendor.is_active ? "default" : "secondary"}>
            {vendor.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Link
            href="/procurement/vendors"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Vendors
          </Link>
          <Link
            href="/procurement"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Procurement
          </Link>
        </div>
      </header>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Contact & Billing
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Contact Person</dt>
            <dd className="font-medium">{showValue(vendor.contact_person)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-medium">{showValue(vendor.phone)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{showValue(vendor.email)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GSTIN</dt>
            <dd className="font-medium">{showValue(vendor.gstin)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment Terms</dt>
            <dd className="font-medium">{showValue(vendor.payment_terms)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="font-medium">{showValue(vendor.address)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
