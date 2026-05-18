"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, FileText, Download, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateInvoice, getInvoiceByOrder } from "../api";

export function InvoiceActions({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", "order", orderId],
    queryFn: () => getInvoiceByOrder(orderId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => generateInvoice(orderId),
    onSuccess: (data) => {
      queryClient.setQueryData(["invoice", "order", orderId], data);
      toast.success("Invoice generated successfully");
    },
    onError: (err) => {
      toast.error("Failed to generate invoice");
    },
  });

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  const handleDownload = () => {
    if (!invoice) return;
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  };

  if (!invoice) {
    return (
      <Button
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Generate Invoice
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={handleDownload}>
        <Eye className="mr-2 h-4 w-4" />
        Preview Invoice
      </Button>
      <Button variant="outline" onClick={handleDownload}>
        <Download className="mr-2 h-4 w-4" />
        Download PDF
      </Button>
    </>
  );
}
