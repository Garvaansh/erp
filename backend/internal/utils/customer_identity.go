package utils

import (
	"strings"
	"unicode"
)

func NormalizePhone(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var digits strings.Builder
	digits.Grow(len(trimmed))
	for _, char := range trimmed {
		if unicode.IsDigit(char) {
			digits.WriteRune(char)
		}
	}

	normalizedDigits := digits.String()
	switch {
	case len(normalizedDigits) == 10:
		return "+91" + normalizedDigits
	case len(normalizedDigits) == 11 && strings.HasPrefix(normalizedDigits, "0"):
		return "+91" + normalizedDigits[1:]
	case len(normalizedDigits) == 12 && strings.HasPrefix(normalizedDigits, "91"):
		return "+91" + normalizedDigits[2:]
	default:
		return ""
	}
}

func NormalizeGST(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, char := range trimmed {
		if unicode.IsLetter(char) || unicode.IsDigit(char) {
			builder.WriteRune(unicode.ToUpper(char))
		}
	}

	return builder.String()
}

func NormalizeName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	lastWasSpace := true

	for _, char := range strings.ToLower(trimmed) {
		switch {
		case unicode.IsLetter(char) || unicode.IsDigit(char):
			builder.WriteRune(char)
			lastWasSpace = false
		case unicode.IsSpace(char):
			if !lastWasSpace {
				builder.WriteByte(' ')
				lastWasSpace = true
			}
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			if !lastWasSpace {
				builder.WriteByte(' ')
				lastWasSpace = true
			}
		}
	}

	return strings.TrimSpace(builder.String())
}
