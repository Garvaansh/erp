package services

import (
	"testing"
)

func TestDeriveCategoryCode_TwoWords(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"Stainless Steel", "Stainless Steel", "SS"},
		{"Carbon Plate", "Carbon Plate", "CM"},
		{"Hot Rolled", "Hot Rolled", "HR"},
		{"Mild Steel Coil", "Mild Steel Coil", "MS"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := deriveCategoryCode(tc.input)
			if got != tc.expected {
				t.Errorf("deriveCategoryCode(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestDeriveCategoryCode_SkipsFillerWords(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"Single word coil", "Coil", "RM"},
		{"Single word sheet", "Sheet", "RM"},
		{"Steel Coil", "Steel Coil", "SM"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := deriveCategoryCode(tc.input)
			if got != tc.expected {
				t.Errorf("deriveCategoryCode(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestDeriveCategoryCode_EmptyFallback(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"empty string", "", "RM"},
		{"whitespace", "  ", "RM"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := deriveCategoryCode(tc.input)
			if got != tc.expected {
				t.Errorf("deriveCategoryCode(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestDeriveCategoryCode_SingleSignificantWord(t *testing.T) {
	got := deriveCategoryCode("Aluminium")
	if got != "AM" {
		t.Errorf("deriveCategoryCode(Aluminium) = %q, want AM", got)
	}
}
