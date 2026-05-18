import { InvoiceLineItem } from "@/features/invoices/types/invoice";
import { formatINR } from "@/features/invoices/utils/invoice-utils";

interface InvoiceItemsTableProps {
  items: InvoiceLineItem[];
}

export function InvoiceItemsTable({ items }: InvoiceItemsTableProps) {
  return (
    <div className="mt-0">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300">
            <th className="text-left py-1.5 px-2 font-semibold text-gray-700 w-6">#</th>
            <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Description</th>
            <th className="text-left py-1.5 px-2 font-semibold text-gray-700 w-20">HSN/SAC</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-700 w-14">Qty</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-700 w-12">Unit</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-700 w-24">Rate (₹)</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-700 w-16">Tax %</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-700 w-24">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-6 text-gray-400 text-[11px]">
                No line items
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                <td className="py-1.5 px-2 text-gray-900 font-medium">{item.description}</td>
                <td className="py-1.5 px-2 text-gray-600">{item.hsn_sac || "—"}</td>
                <td className="py-1.5 px-2 text-right text-gray-800">{item.qty}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{item.unit || "Nos"}</td>
                <td className="py-1.5 px-2 text-right text-gray-800">{item.rate.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{item.tax_percent}%</td>
                <td className="py-1.5 px-2 text-right font-medium text-gray-900">
                  {item.amount.toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
