package utils

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// FormatSpecification converts a JSONB specs blob into a human-readable string.
// Handles both normalized keys (thickness_mm, width_mm) and legacy keys (thickness, width).
func FormatSpecification(specs []byte) string {
	if len(specs) == 0 {
		return ""
	}

	var parsed map[string]any
	if err := json.Unmarshal(specs, &parsed); err != nil {
		return ""
	}

	return FormatSpecificationMap(parsed)
}

// FormatSpecificationMap formats a parsed specs map into a human-readable string.
func FormatSpecificationMap(specs map[string]any) string {
	if len(specs) == 0 {
		return ""
	}

	parts := make([]string, 0, 4)

	thickness := specNumber(specs, "thickness_mm", "thickness")
	width := specNumber(specs, "width_mm", "width")
	diameter := specNumber(specs, "diameter_mm", "diameter")
	grade := specString(specs, "grade")

	if thickness > 0 && width > 0 {
		parts = append(parts, fmt.Sprintf("%s × %s", formatDim(thickness), formatDim(width)))
	} else if thickness > 0 {
		parts = append(parts, formatDim(thickness))
	} else if width > 0 {
		parts = append(parts, formatDim(width))
	}

	if diameter > 0 {
		parts = append(parts, fmt.Sprintf("Ø%s", formatDim(diameter)))
	}

	if grade != "" {
		parts = append(parts, "GR:"+strings.ToUpper(grade))
	}

	return strings.Join(parts, " ")
}

// formatDim formats a dimension value as "Xmm", trimming unnecessary trailing zeros.
func formatDim(value float64) string {
	if value == math.Trunc(value) {
		return fmt.Sprintf("%dmm", int64(value))
	}
	s := fmt.Sprintf("%.4f", value)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	return s + "mm"
}

func specNumber(specs map[string]any, keys ...string) float64 {
	for _, key := range keys {
		raw, ok := specs[key]
		if !ok {
			continue
		}
		switch v := raw.(type) {
		case float64:
			if v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0) {
				return v
			}
		case int:
			if v > 0 {
				return float64(v)
			}
		}
	}
	return 0
}

func specString(specs map[string]any, keys ...string) string {
	for _, key := range keys {
		raw, ok := specs[key]
		if !ok {
			continue
		}
		if s, ok := raw.(string); ok {
			trimmed := strings.TrimSpace(s)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}
