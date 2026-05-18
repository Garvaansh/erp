import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { InvoiceResponse } from "../types";

// Note: In production, load actual fonts. Using defaults for now.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  companyInfo: {
    flexDirection: "column",
  },
  logo: {
    width: 100,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    flexDirection: "column",
  },
  bold: {
    fontWeight: "bold",
    color: "#000",
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 20,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableColHeader: {
    width: "16%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#f9fafb",
    padding: 5,
  },
  tableColHeaderWide: {
    width: "36%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#f9fafb",
    padding: 5,
  },
  tableCol: {
    width: "16%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableColWide: {
    width: "36%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  totalsContainer: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingVertical: 3,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  signatureBlock: {
    marginTop: 60,
    alignItems: "flex-end",
  },
  signatureLine: {
    width: 150,
    borderBottomWidth: 1,
    borderColor: "#000",
    marginBottom: 5,
  }
});

interface InvoiceDocumentProps {
  invoice: InvoiceResponse;
}

export function InvoiceDocument({ invoice }: InvoiceDocumentProps) {
  const { snapshot } = invoice;
  const { company, customer, order_lines, taxes, totals, payment_terms } = snapshot;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {company.logo_url && company.logo_url !== "" ? (
              <Image style={styles.logo} src={company.logo_url} />
            ) : null}
            <Text style={styles.title}>{company.company_name}</Text>
            <Text>{company.address}</Text>
            <Text>Phone: {company.phone}</Text>
            <Text>Email: {company.email}</Text>
            <Text>GSTIN: {company.gstin}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 20, color: "#374151", marginBottom: 10 }}>INVOICE</Text>
            <Text><Text style={styles.bold}>Invoice No:</Text> {invoice.invoice_number}</Text>
            <Text><Text style={styles.bold}>Date:</Text> {new Date(invoice.generated_at).toLocaleDateString()}</Text>
            <Text><Text style={styles.bold}>Terms:</Text> {payment_terms.terms_days} Days</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={[styles.bold, { marginBottom: 5 }]}>Bill To:</Text>
          <Text style={styles.bold}>{customer.customer_name}</Text>
          <Text>{customer.address}</Text>
          <Text>Phone: {customer.phone}</Text>
          <Text>Email: {customer.email}</Text>
          <Text>GSTIN: {customer.gstin}</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableColHeaderWide}><Text style={styles.bold}>Item / Description</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.bold}>SKU</Text></View>
            <View style={styles.tableColHeader}><Text style={[styles.bold, { textAlign: "right" }]}>Quantity</Text></View>
            <View style={styles.tableColHeader}><Text style={[styles.bold, { textAlign: "right" }]}>Unit Price</Text></View>
            <View style={styles.tableColHeader}><Text style={[styles.bold, { textAlign: "right" }]}>Total</Text></View>
          </View>
          
          {order_lines.map((line, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={styles.tableColWide}><Text>{line.item_name}</Text></View>
              <View style={styles.tableCol}><Text>{line.sku}</Text></View>
              <View style={styles.tableCol}><Text style={{ textAlign: "right" }}>{line.quantity}</Text></View>
              <View style={styles.tableCol}><Text style={{ textAlign: "right" }}>${line.unit_price.toFixed(2)}</Text></View>
              <View style={styles.tableCol}><Text style={{ textAlign: "right" }}>${line.total_amount.toFixed(2)}</Text></View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>${totals.subtotal.toFixed(2)}</Text>
          </View>
          {taxes.cgst_amount > 0 && (
            <View style={styles.totalRow}>
              <Text>CGST ({taxes.cgst_percent}%):</Text>
              <Text>${taxes.cgst_amount.toFixed(2)}</Text>
            </View>
          )}
          {taxes.sgst_amount > 0 && (
            <View style={styles.totalRow}>
              <Text>SGST ({taxes.sgst_percent}%):</Text>
              <Text>${taxes.sgst_amount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderColor: "#000", marginTop: 5, paddingTop: 5 }]}>
            <Text style={styles.bold}>Grand Total:</Text>
            <Text style={styles.bold}>${totals.grand_total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Bank Details & Notes */}
        <View style={{ marginTop: 40, width: "60%" }}>
          <Text style={[styles.bold, { marginBottom: 5 }]}>Bank Details:</Text>
          <Text>{company.bank_details}</Text>
          
          {payment_terms.declaration_text && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.bold, { marginBottom: 5 }]}>Declaration:</Text>
              <Text style={{ fontSize: 9 }}>{payment_terms.declaration_text}</Text>
            </View>
          )}
        </View>

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={{ textAlign: "center", width: 150 }}>Authorized Signatory</Text>
          <Text style={{ textAlign: "center", width: 150, fontSize: 8, marginTop: 2 }}>{company.company_name}</Text>
        </View>

        {/* Footer */}
        {payment_terms.footer_note && (
          <View style={styles.footer}>
            <Text>{payment_terms.footer_note}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
