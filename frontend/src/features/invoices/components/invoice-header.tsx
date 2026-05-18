import { InvoiceCompany, InvoiceCustomer } from "@/features/invoices/types/invoice";
import { formatDate } from "@/features/invoices/utils/invoice-utils";

interface InvoiceHeaderProps {
  company: InvoiceCompany;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTermsDays: number;
}

export function InvoiceHeader({
  company,
  invoiceNumber,
  invoiceDate,
  dueDate,
  paymentTermsDays,
}: InvoiceHeaderProps) {
  return (
    <div className="border-b border-gray-300 pb-4 mb-0">
      {/* Top header bar */}
      <div className="flex justify-between items-start">
        {/* Left: Company identity */}
        <div className="flex-1 pr-8">
          {company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.company_name}
              className="h-10 mb-2 object-contain"
            />
          )}
          <div className="text-[15px] font-bold text-gray-900 leading-tight">
            {company.company_name || "Company Name"}
          </div>
          <div className="text-[11px] text-gray-600 mt-0.5 leading-snug whitespace-pre-line max-w-xs">
            {company.address}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {company.gstin && (
              <div className="text-[11px] text-gray-700">
                <span className="font-semibold">GSTIN:</span> {company.gstin}
              </div>
            )}
            {company.phone && (
              <div className="text-[11px] text-gray-600">
                <span className="font-semibold">Ph:</span> {company.phone}
              </div>
            )}
            {company.email && (
              <div className="text-[11px] text-gray-600">
                <span className="font-semibold">Email:</span> {company.email}
              </div>
            )}
          </div>
        </div>

        {/* Right: Invoice meta */}
        <div className="text-right flex-shrink-0">
          <div className="text-[18px] font-bold text-gray-900 tracking-wide uppercase border-b border-gray-300 pb-1 mb-2">
            Tax Invoice
          </div>
          <table className="text-[11px] text-gray-700 ml-auto">
            <tbody>
              <tr>
                <td className="font-semibold pr-3 py-0.5 text-left">Invoice No.</td>
                <td className="py-0.5">{invoiceNumber || "—"}</td>
              </tr>
              <tr>
                <td className="font-semibold pr-3 py-0.5 text-left">Invoice Date</td>
                <td className="py-0.5">{formatDate(invoiceDate)}</td>
              </tr>
              <tr>
                <td className="font-semibold pr-3 py-0.5 text-left">Due Date</td>
                <td className="py-0.5">{formatDate(dueDate)}</td>
              </tr>
              <tr>
                <td className="font-semibold pr-3 py-0.5 text-left">Payment Terms</td>
                <td className="py-0.5">Net {paymentTermsDays} Days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface InvoiceBillToProps {
  company: InvoiceCompany;
  customer: InvoiceCustomer;
}

export function InvoiceBillTo({ company, customer }: InvoiceBillToProps) {
  return (
    <div className="grid grid-cols-2 gap-6 py-3 border-b border-gray-300">
      {/* Billed From */}
      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          From
        </div>
        <div className="text-[12px] font-semibold text-gray-900">{company.company_name}</div>
        <div className="text-[11px] text-gray-600 whitespace-pre-line leading-snug">{company.address}</div>
        {company.gstin && (
          <div className="text-[11px] text-gray-700 mt-0.5">
            <span className="font-semibold">GSTIN:</span> {company.gstin}
          </div>
        )}
      </div>

      {/* Billed To */}
      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Bill To
        </div>
        <div className="text-[12px] font-semibold text-gray-900">{customer.customer_name}</div>
        <div className="text-[11px] text-gray-600 whitespace-pre-line leading-snug">{customer.address}</div>
        {customer.gstin && (
          <div className="text-[11px] text-gray-700 mt-0.5">
            <span className="font-semibold">GSTIN:</span> {customer.gstin}
          </div>
        )}
        {customer.phone && (
          <div className="text-[11px] text-gray-600">
            <span className="font-semibold">Ph:</span> {customer.phone}
          </div>
        )}
        {customer.place_of_supply && (
          <div className="text-[11px] text-gray-700 mt-0.5">
            <span className="font-semibold">Place of Supply:</span> {customer.place_of_supply}
          </div>
        )}
      </div>
    </div>
  );
}
