interface InvoiceFooterProps {
  amountInWords: string;
  bankDetails: string;
  declarationText: string;
  footerNote: string;
}

export function InvoiceFooter({
  amountInWords,
  bankDetails,
  declarationText,
  footerNote,
}: InvoiceFooterProps) {
  return (
    <div className="mt-0">
      {/* Amount in words */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm px-3 py-1.5 mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-2">
          Amount in Words:
        </span>
        <span className="text-[11px] font-medium text-gray-800 italic">{amountInWords}</span>
      </div>

      <div className="grid grid-cols-2 gap-6 border-t border-gray-300 pt-3">
        {/* Bank details */}
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Bank Details
          </div>
          <div className="text-[11px] text-gray-700 whitespace-pre-line leading-snug">
            {bankDetails || "—"}
          </div>
        </div>

        {/* Signature block */}
        <div className="text-right">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-8">
            For — Authorised Signatory
          </div>
          <div className="border-t border-gray-400 pt-1 inline-block min-w-[140px]">
            <div className="text-[10px] text-gray-500">Signature</div>
          </div>
        </div>
      </div>

      {/* Declaration */}
      {declarationText && (
        <div className="border-t border-gray-200 mt-3 pt-2">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Declaration
          </div>
          <p className="text-[10px] text-gray-600 italic leading-snug">{declarationText}</p>
        </div>
      )}

      {/* Footer note */}
      <div className="border-t border-gray-200 mt-3 pt-2 text-center">
        <p className="text-[10px] text-gray-500">
          {footerNote || "This is a computer-generated invoice and does not require a physical signature."}
        </p>
      </div>
    </div>
  );
}
