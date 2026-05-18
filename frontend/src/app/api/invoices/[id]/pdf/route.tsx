/**
 * GET /api/invoices/[id]/pdf
 *
 * Server-side PDF generation using @react-pdf/renderer.
 * This is an API route (server-only), so we can import renderToBuffer directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionToken, getBackendBaseUrl } from "@/app/api/_shared/http";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { InvoicePDFDocument } from "@/features/invoices/components/invoice-pdf-document";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = getBackendBaseUrl() || "http://localhost:8080";

  const token = await getSessionToken();

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendUrl}/api/v1/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return new NextResponse("Invoice service unavailable", { status: 503 });
  }

  if (!backendResponse.ok) {
    return new NextResponse(
      backendResponse.status === 404 ? "Invoice not found" : "Failed to fetch invoice",
      { status: backendResponse.status }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice: any = await backendResponse.json();
  const invoiceNumber: string = invoice?.invoice_number ?? id;

  const pdfBuffer = await renderToBuffer(
    <InvoicePDFDocument invoice={invoice} />
  );

  return new NextResponse(pdfBuffer as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice_${invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
