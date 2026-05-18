/**
 * InvoiceDocument — the single source of truth renderer.
 *
 * Used by:
 *  - Settings live preview (<InvoicePreviewShell />)
 *  - Invoice detail page
 *  - PDF generation (same markup, print stylesheet)
 *
 * NEVER render invoice layout outside this component.
 */
import { InvoiceDocument as InvoiceDocumentType } from "@/features/invoices/types/invoice";
import { InvoiceHeader, InvoiceBillTo } from "./invoice-header";
import { InvoiceItemsTable } from "./invoice-items-table";
import { InvoiceTaxSummary } from "./invoice-tax-summary";
import { InvoiceFooter } from "./invoice-footer";

interface InvoiceDocumentProps {
  doc: InvoiceDocumentType;
  /** When true wraps in A4 canvas with shadow (preview). When false, renders raw (PDF). */
  mode?: "preview" | "print";
}

export function InvoiceDocument({ doc, mode = "preview" }: InvoiceDocumentProps) {
  const content = (
    <div
      id="invoice-document"
      className="bg-white font-sans text-gray-900"
      style={{
        width: "794px",
        minHeight: "1123px",
        padding: "48px 52px",
        boxSizing: "border-box",
        fontFamily: "'Inter', 'Arial', sans-serif",
        fontSize: "12px",
        lineHeight: "1.4",
      }}
    >
      {/* 1. Header */}
      <InvoiceHeader
        company={doc.company}
        invoiceNumber={doc.invoice_number}
        invoiceDate={doc.invoice_date}
        dueDate={doc.due_date}
        paymentTermsDays={doc.payment_terms_days}
      />

      {/* 2. Bill From / Bill To */}
      <InvoiceBillTo company={doc.company} customer={doc.customer} />

      {/* 3. Line Items */}
      <div className="border-b border-gray-300">
        <InvoiceItemsTable items={doc.line_items} />
      </div>

      {/* 4. Tax Summary + Totals */}
      <div className="border-b border-gray-300 py-3">
        <InvoiceTaxSummary taxes={doc.taxes} totals={doc.totals} />
      </div>

      {/* 5. Footer */}
      <InvoiceFooter
        amountInWords={doc.totals.amount_in_words}
        bankDetails={doc.company.bank_details}
        declarationText={doc.declaration_text}
        footerNote={doc.footer_note}
      />
    </div>
  );

  if (mode === "print") {
    return content;
  }

  // Preview mode: A4 canvas inside a workspace
  return content;
}
