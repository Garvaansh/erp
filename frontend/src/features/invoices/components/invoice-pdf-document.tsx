/**
 * InvoicePDFDocument — @react-pdf/renderer version of the invoice.
 *
 * Uses react-pdf primitives (View, Text, Page, Document) which cannot
 * be mixed with DOM elements. This is intentionally separate from the
 * HTML preview renderer (invoice-document.tsx).
 *
 * The DATA contract (InvoiceDocument type) is identical — same type,
 * different rendering surface.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register a clean monospace/sans font if needed in production.
// For now, rely on react-pdf's built-in Helvetica.

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    color: "#111",
  },
  /* Header */
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  companyDetail: { fontSize: 8, color: "#555", lineHeight: 1.5 },
  invoiceTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end" },
  metaLabel: { fontFamily: "Helvetica-Bold", width: 90, textAlign: "right", paddingRight: 6, color: "#444" },
  metaValue: { width: 100, textAlign: "right" },
  /* Divider */
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 6 },
  /* Bill From/To */
  billRow: { flexDirection: "row", marginBottom: 8 },
  billBlock: { flex: 1 },
  sectionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  billName: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 1 },
  billDetail: { fontSize: 8, color: "#555", lineHeight: 1.5 },
  /* Table */
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#d1d5db", paddingVertical: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 3 },
  colDesc: { flex: 3, paddingHorizontal: 4 },
  colHSN: { width: 55, paddingHorizontal: 4 },
  colQty: { width: 30, textAlign: "right", paddingHorizontal: 4 },
  colUnit: { width: 28, textAlign: "right", paddingHorizontal: 4 },
  colRate: { width: 48, textAlign: "right", paddingHorizontal: 4 },
  colTax: { width: 32, textAlign: "right", paddingHorizontal: 4 },
  colAmt: { width: 55, textAlign: "right", paddingHorizontal: 4 },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#374151" },
  /* Totals */
  totalsSection: { flexDirection: "row", marginTop: 8 },
  taxTable: { flex: 1, marginRight: 12 },
  totalsTable: { width: 180 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { color: "#555" },
  totalValue: { textAlign: "right" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#aaa", paddingTop: 3, marginTop: 2 },
  grandTotalText: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  /* Amount in words */
  amtWords: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", padding: 6, marginTop: 10, marginBottom: 8 },
  amtWordsLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#999", textTransform: "uppercase" },
  amtWordsText: { fontFamily: "Helvetica-Oblique", fontSize: 9, marginTop: 2 },
  /* Footer */
  footerRow: { flexDirection: "row", marginTop: 16 },
  footerBank: { flex: 1 },
  footerSign: { width: 150, alignItems: "flex-end" },
  signLine: { borderTopWidth: 1, borderTopColor: "#888", marginTop: 32, width: 120 },
  footerNote: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6, textAlign: "center", color: "#777", fontSize: 8 },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InvoicePDFDocument({ invoice }: { invoice: any }) {
  const snap = invoice?.snapshot ?? invoice;
  const company = snap?.company ?? {};
  const customer = snap?.customer ?? {};
  const lines: any[] = snap?.order_lines ?? [];
  const taxes = snap?.taxes ?? {};
  const totals = snap?.totals ?? {};
  const payment = snap?.payment_terms ?? {};

  const subtotal: number = totals.subtotal ?? 0;
  const cgstAmt: number = taxes.cgst_amount ?? 0;
  const sgstAmt: number = taxes.sgst_amount ?? 0;
  const grandTotal: number = totals.grand_total ?? 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{company.company_name ?? "Company"}</Text>
            <Text style={styles.companyDetail}>{company.address ?? ""}</Text>
            {company.gstin && <Text style={styles.companyDetail}>GSTIN: {company.gstin}</Text>}
            {company.phone && <Text style={styles.companyDetail}>Ph: {company.phone}</Text>}
            {company.email && <Text style={styles.companyDetail}>{company.email}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <View style={{ marginTop: 6 }}>
              {[
                ["Invoice No.", invoice?.invoice_number ?? "—"],
                ["Invoice Date", invoice?.generated_at ? new Date(invoice.generated_at).toLocaleDateString("en-IN") : "—"],
                ["Payment Terms", `Net ${payment.terms_days ?? 30} Days`],
              ].map(([label, value]) => (
                <View key={label} style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{label}</Text>
                  <Text style={styles.metaValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* BILL FROM / TO */}
        <View style={styles.billRow}>
          <View style={styles.billBlock}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.billName}>{company.company_name}</Text>
            <Text style={styles.billDetail}>{company.address}</Text>
            {company.gstin && <Text style={styles.billDetail}>GSTIN: {company.gstin}</Text>}
          </View>
          <View style={[styles.billBlock, { paddingLeft: 16 }]}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.billName}>{customer.customer_name}</Text>
            <Text style={styles.billDetail}>{customer.address}</Text>
            {customer.gstin && <Text style={styles.billDetail}>GSTIN: {customer.gstin}</Text>}
            {customer.phone && <Text style={styles.billDetail}>Ph: {customer.phone}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {/* LINE ITEMS TABLE */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.thText]}>#  Description</Text>
          <Text style={[styles.colHSN, styles.thText]}>HSN/SAC</Text>
          <Text style={[styles.colQty, styles.thText]}>Qty</Text>
          <Text style={[styles.colUnit, styles.thText]}>Unit</Text>
          <Text style={[styles.colRate, styles.thText]}>Rate</Text>
          <Text style={[styles.colTax, styles.thText]}>Tax%</Text>
          <Text style={[styles.colAmt, styles.thText]}>Amount</Text>
        </View>
        {lines.map((line, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDesc}>{i + 1}. {line.item_name ?? line.description}</Text>
            <Text style={styles.colHSN}>{line.hsn_sac ?? "—"}</Text>
            <Text style={styles.colQty}>{line.quantity ?? line.qty}</Text>
            <Text style={styles.colUnit}>{line.unit ?? "Nos"}</Text>
            <Text style={styles.colRate}>{(line.unit_price ?? line.rate ?? 0).toFixed(2)}</Text>
            <Text style={styles.colTax}>{line.tax_percent ?? "—"}</Text>
            <Text style={styles.colAmt}>{(line.total_amount ?? line.amount ?? 0).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        {/* TOTALS SECTION */}
        <View style={styles.totalsSection}>
          <View style={styles.taxTable}>
            {/* Tax breakdown */}
            {cgstAmt > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST ({taxes.cgst_percent}%)</Text>
                <Text style={styles.totalValue}>₹{cgstAmt.toFixed(2)}</Text>
              </View>
            )}
            {sgstAmt > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST ({taxes.sgst_percent}%)</Text>
                <Text style={styles.totalValue}>₹{sgstAmt.toFixed(2)}</Text>
              </View>
            )}
          </View>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
            </View>
            {cgstAmt > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST</Text>
                <Text style={styles.totalValue}>₹{cgstAmt.toFixed(2)}</Text>
              </View>
            )}
            {sgstAmt > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST</Text>
                <Text style={styles.totalValue}>₹{sgstAmt.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalText}>Grand Total</Text>
              <Text style={styles.grandTotalText}>₹{grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* AMOUNT IN WORDS */}
        <View style={styles.amtWords}>
          <Text style={styles.amtWordsLabel}>Amount in Words</Text>
          <Text style={styles.amtWordsText}>{totals.amount_in_words ?? ""}</Text>
        </View>

        <View style={styles.divider} />

        {/* FOOTER */}
        <View style={styles.footerRow}>
          <View style={styles.footerBank}>
            <Text style={styles.sectionLabel}>Bank Details</Text>
            <Text style={styles.billDetail}>{company.bank_details ?? "—"}</Text>
          </View>
          <View style={styles.footerSign}>
            <Text style={styles.billDetail}>For {company.company_name}</Text>
            <View style={styles.signLine} />
            <Text style={[styles.billDetail, { marginTop: 4 }]}>Authorised Signatory</Text>
          </View>
        </View>

        {payment.declaration_text && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionLabel}>Declaration</Text>
            <Text style={[styles.billDetail, { fontStyle: "italic" }]}>{payment.declaration_text}</Text>
          </View>
        )}

        <View style={styles.footerNote}>
          <Text>{payment.footer_note || "This is a computer-generated invoice."}</Text>
        </View>
      </Page>
    </Document>
  );
}
