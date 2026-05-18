import { InvoiceTaxBreakdown, InvoiceTotals } from "@/features/invoices/types/invoice";
import { formatINR } from "@/features/invoices/utils/invoice-utils";

interface InvoiceTaxSummaryProps {
  taxes: InvoiceTaxBreakdown;
  totals: InvoiceTotals;
}

export function InvoiceTaxSummary({ taxes, totals }: InvoiceTaxSummaryProps) {
  const hasIGST = taxes.igst_amount > 0;
  const hasCGST = taxes.cgst_amount > 0;
  const hasSGST = taxes.sgst_amount > 0;

  return (
    <div className="mt-0 flex">
      {/* Left: tax breakdown table */}
      <div className="flex-1 border-r border-gray-300 pr-4">
        <table className="w-full text-[10.5px]">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="text-left py-1 px-2 font-semibold text-gray-600">Tax Type</th>
              <th className="text-right py-1 px-2 font-semibold text-gray-600">Taxable Amt</th>
              <th className="text-right py-1 px-2 font-semibold text-gray-600">Rate</th>
              <th className="text-right py-1 px-2 font-semibold text-gray-600">Tax Amt</th>
            </tr>
          </thead>
          <tbody>
            {hasCGST && (
              <tr className="border-b border-gray-100">
                <td className="py-1 px-2 text-gray-700">CGST</td>
                <td className="py-1 px-2 text-right text-gray-700">{totals.taxable_amount.toFixed(2)}</td>
                <td className="py-1 px-2 text-right text-gray-700">{taxes.cgst_percent}%</td>
                <td className="py-1 px-2 text-right font-medium text-gray-800">{taxes.cgst_amount.toFixed(2)}</td>
              </tr>
            )}
            {hasSGST && (
              <tr className="border-b border-gray-100">
                <td className="py-1 px-2 text-gray-700">SGST</td>
                <td className="py-1 px-2 text-right text-gray-700">{totals.taxable_amount.toFixed(2)}</td>
                <td className="py-1 px-2 text-right text-gray-700">{taxes.sgst_percent}%</td>
                <td className="py-1 px-2 text-right font-medium text-gray-800">{taxes.sgst_amount.toFixed(2)}</td>
              </tr>
            )}
            {hasIGST && (
              <tr className="border-b border-gray-100">
                <td className="py-1 px-2 text-gray-700">IGST</td>
                <td className="py-1 px-2 text-right text-gray-700">{totals.taxable_amount.toFixed(2)}</td>
                <td className="py-1 px-2 text-right text-gray-700">{taxes.igst_percent}%</td>
                <td className="py-1 px-2 text-right font-medium text-gray-800">{taxes.igst_amount.toFixed(2)}</td>
              </tr>
            )}
            {!hasCGST && !hasSGST && !hasIGST && (
              <tr>
                <td colSpan={4} className="py-1 px-2 text-gray-400 text-center">No tax applicable</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Right: totals */}
      <div className="w-56 pl-4">
        <table className="w-full text-[11px]">
          <tbody>
            <tr>
              <td className="py-0.5 pr-3 text-gray-600">Subtotal</td>
              <td className="py-0.5 text-right text-gray-800">{formatINR(totals.subtotal)}</td>
            </tr>
            {hasCGST && (
              <tr>
                <td className="py-0.5 pr-3 text-gray-600">CGST ({taxes.cgst_percent}%)</td>
                <td className="py-0.5 text-right text-gray-800">{formatINR(taxes.cgst_amount)}</td>
              </tr>
            )}
            {hasSGST && (
              <tr>
                <td className="py-0.5 pr-3 text-gray-600">SGST ({taxes.sgst_percent}%)</td>
                <td className="py-0.5 text-right text-gray-800">{formatINR(taxes.sgst_amount)}</td>
              </tr>
            )}
            {hasIGST && (
              <tr>
                <td className="py-0.5 pr-3 text-gray-600">IGST ({taxes.igst_percent}%)</td>
                <td className="py-0.5 text-right text-gray-800">{formatINR(taxes.igst_amount)}</td>
              </tr>
            )}
            <tr className="border-t border-gray-300">
              <td className="pt-1.5 pr-3 font-bold text-gray-900 text-[12px]">Grand Total</td>
              <td className="pt-1.5 text-right font-bold text-gray-900 text-[12px]">
                {formatINR(totals.grand_total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
