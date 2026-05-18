/**
 * InvoicePreviewShell — renders an A4-sized document canvas inside a
 * gray workspace background, simulating a printable document.
 *
 * Used in:
 *  - Invoice Defaults settings tab (live preview)
 *  - Future invoice detail page preview
 */
import { InvoiceDocument as InvoiceDocumentType } from "@/features/invoices/types/invoice";
import { InvoiceDocument } from "./invoice-document";

interface InvoicePreviewShellProps {
  doc: InvoiceDocumentType;
}

export function InvoicePreviewShell({ doc }: InvoicePreviewShellProps) {
  return (
    <div
      className="bg-zinc-200 rounded-md flex justify-center items-start overflow-auto"
      style={{ padding: "24px 16px", minHeight: "600px" }}
    >
      {/* A4 paper */}
      <div
        className="bg-white shadow-[0_2px_16px_rgba(0,0,0,0.18)] rounded-[2px] overflow-hidden"
        style={{
          width: "794px",
          minHeight: "1123px",
          transformOrigin: "top center",
        }}
      >
        <InvoiceDocument doc={doc} mode="preview" />
      </div>
    </div>
  );
}
