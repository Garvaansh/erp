package utils

import "testing"

func TestFormatFinishedGoodSKU(t *testing.T) {
	tests := []struct {
		name string
		seq  int32
		want string
	}{
		{name: "first sequence", seq: 1, want: "FGP-001"},
		{name: "double digits", seq: 12, want: "FGP-012"},
		{name: "triple digits", seq: 123, want: "FGP-123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := formatFinishedGoodSKU(tt.seq); got != tt.want {
				t.Fatalf("formatFinishedGoodSKU(%d) = %q, want %q", tt.seq, got, tt.want)
			}
		})
	}
}
