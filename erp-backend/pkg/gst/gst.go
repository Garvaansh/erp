package gst

import "math"

// Calculate returns CGST, SGST, and IGST for a given taxable value and rate.
// sellerState and buyerState are 2-digit India state codes (e.g. "23" for MP, "09" for UP).
// If same state -> intra-state: CGST and SGST each = half of tax; IGST = 0.
// If different state -> inter-state: IGST = full tax; CGST, SGST = 0.
// All amounts are rounded to 2 decimal places.
func Calculate(sellerState, buyerState string, taxableValue, ratePct float64) (cgst, sgst, igst float64) {
	if taxableValue <= 0 || ratePct < 0 {
		return 0, 0, 0
	}
	tax := taxableValue * (ratePct / 100)
	tax = round2(tax)
	seller := normalizeStateCode(sellerState)
	buyer := normalizeStateCode(buyerState)
	if seller == buyer && seller != "" {
		// Intra-state: CGST + SGST (50% each)
		half := round2(tax / 2)
		return half, half, 0
	}
	// Inter-state: IGST
	return 0, 0, tax
}

// round2 rounds to 2 decimal places (for currency).
func round2(x float64) float64 {
	return math.Round(x*100) / 100
}

// normalizeStateCode returns a 2-digit state code string for comparison (e.g. "23", "09").
// GSTIN prefix is 2-digit state code; state names can be normalized to codes if needed.
func normalizeStateCode(s string) string {
	const zero = '0'
	b := []byte(s)
	for i := 0; i < len(b); i++ {
		if b[i] >= '0' && b[i] <= '9' {
			start := i
			for i < len(b) && b[i] >= '0' && b[i] <= '9' {
				i++
			}
			// Take first 2 digits
			if i-start >= 2 {
				return string(b[start : start+2])
			}
			return string(b[start:i])
		}
	}
	return ""
}

// Totals aggregates line-level GST into invoice totals.
func Totals(lines []Line) (subtotal, cgstTotal, sgstTotal, igstTotal, totalTax, grandTotal float64) {
	for _, l := range lines {
		subtotal += l.TaxableValue
		cgstTotal += l.CGST
		sgstTotal += l.SGST
		igstTotal += l.IGST
	}
	totalTax = cgstTotal + sgstTotal + igstTotal
	grandTotal = round2(subtotal + totalTax)
	subtotal = round2(subtotal)
	cgstTotal = round2(cgstTotal)
	sgstTotal = round2(sgstTotal)
	igstTotal = round2(igstTotal)
	totalTax = round2(totalTax)
	return
}

// Line holds one line's taxable value and computed GST.
type Line struct {
	TaxableValue float64
	CGST         float64
	SGST         float64
	IGST         float64
}
