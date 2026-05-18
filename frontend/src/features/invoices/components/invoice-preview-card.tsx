import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface InvoicePreviewProps {
  companyName: string;
  gstin: string;
  address: string;
  prefix: string;
  paymentTerms: number;
  cgst: number;
  sgst: number;
  footerNote: string;
  declaration: string;
}

export function InvoicePreviewCard({
  companyName,
  gstin,
  address,
  prefix,
  paymentTerms,
  cgst,
  sgst,
  footerNote,
  declaration,
}: InvoicePreviewProps) {
  const invoiceNumber = `${prefix}2026-00014`;

  return (
    <Card className="overflow-hidden bg-white shadow-sm border text-sm font-sans">
      {/* Header */}
      <div className="p-6 bg-slate-50 border-b flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{companyName || "Your Company Name"}</h2>
          <p className="text-slate-500 whitespace-pre-wrap max-w-xs mt-1 text-xs">
            {address || "123 Business Road, City, Country"}
          </p>
          <div className="mt-2 text-xs font-medium text-slate-600">
            GSTIN: {gstin || "N/A"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-800 tracking-tight">INVOICE</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex justify-end gap-3">
              <span className="font-semibold">Invoice No:</span>
              <span>{invoiceNumber}</span>
            </div>
            <div className="flex justify-end gap-3">
              <span className="font-semibold">Date:</span>
              <span>May 18, 2026</span>
            </div>
            <div className="flex justify-end gap-3">
              <span className="font-semibold">Terms:</span>
              <span>Net {paymentTerms || 30}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="p-6 pb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Bill To
        </h3>
        <p className="font-medium text-slate-900">Acme Manufacturing Ltd</p>
        <p className="text-slate-500 text-xs">456 Industrial Park, Phase 2</p>
        <p className="text-slate-500 text-xs">GSTIN: 27ABCDE9876F1Z5</p>
      </div>

      {/* Line Items */}
      <div className="px-6">
        <div className="grid grid-cols-12 gap-2 pb-2 border-b text-xs font-semibold text-slate-500">
          <div className="col-span-6">Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Rate</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        <div className="grid grid-cols-12 gap-2 py-3 border-b text-sm text-slate-700">
          <div className="col-span-6">Premium Molding Material</div>
          <div className="col-span-2 text-right">100</div>
          <div className="col-span-2 text-right">₹45.00</div>
          <div className="col-span-2 text-right">₹4,500.00</div>
        </div>
        <div className="grid grid-cols-12 gap-2 py-3 border-b text-sm text-slate-700">
          <div className="col-span-6">Polishing Service</div>
          <div className="col-span-2 text-right">1</div>
          <div className="col-span-2 text-right">₹500.00</div>
          <div className="col-span-2 text-right">₹500.00</div>
        </div>
      </div>

      {/* Totals */}
      <div className="p-6 flex justify-end">
        <div className="w-1/2 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₹5,000.00</span>
          </div>
          {(cgst > 0) && (
            <div className="flex justify-between text-slate-600">
              <span>CGST ({cgst}%)</span>
              <span>₹{(5000 * (cgst / 100)).toFixed(2)}</span>
            </div>
          )}
          {(sgst > 0) && (
            <div className="flex justify-between text-slate-600">
              <span>SGST ({sgst}%)</span>
              <span>₹{(5000 * (sgst / 100)).toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-slate-900 text-base">
            <span>Total</span>
            <span>₹{(5000 + (5000 * (cgst / 100)) + (5000 * (sgst / 100))).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="px-6 pb-6 mt-4">
        {declaration && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-900 mb-1">Declaration</h4>
            <p className="text-xs text-slate-500 italic">{declaration}</p>
          </div>
        )}
        {footerNote && (
          <div className="border-t pt-4">
            <p className="text-xs text-slate-500 text-center">{footerNote}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
