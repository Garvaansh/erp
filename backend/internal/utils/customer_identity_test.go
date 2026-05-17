package utils

import "testing"

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "plain ten digit", input: "9876543210", expected: "+919876543210"},
		{name: "leading zero", input: "09876543210", expected: "+919876543210"},
		{name: "country code no plus", input: "919876543210", expected: "+919876543210"},
		{name: "mixed punctuation", input: "+91-98765-43210", expected: "+919876543210"},
		{name: "spaces and parentheses", input: "(98765) 43210", expected: "+919876543210"},
		{name: "invalid short", input: "98765", expected: ""},
		{name: "invalid foreign length", input: "+1 9876543210", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizePhone(tt.input); got != tt.expected {
				t.Fatalf("NormalizePhone(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestNormalizeGST(t *testing.T) {
	got := NormalizeGST(" 29 abcde1234f2z5 ")
	want := "29ABCDE1234F2Z5"
	if got != want {
		t.Fatalf("NormalizeGST() = %q, want %q", got, want)
	}
}

func TestNormalizeName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "trim and lowercase", input: "  ACME Traders  ", expected: "acme traders"},
		{name: "collapse whitespace", input: "Acme   Traders\tIndia", expected: "acme traders india"},
		{name: "remove punctuation", input: "A.C.M.E. Traders & Co.", expected: "a c m e traders co"},
		{name: "retain digits", input: "Pipe 32MM - Grade A", expected: "pipe 32mm grade a"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeName(tt.input); got != tt.expected {
				t.Fatalf("NormalizeName(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
