package utils_test

import (
	"testing"

	"github.com/erp/backend/internal/utils"
)

func TestFormatSpecification(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  string
	}{
		{
			name:  "legacy thickness and width",
			input: []byte(`{"thickness": 1, "width": 3.5}`),
			want:  "1mm × 3.5mm",
		},
		{
			name:  "normalized keys",
			input: []byte(`{"thickness_mm": 2, "width_mm": 4}`),
			want:  "2mm × 4mm",
		},
		{
			name:  "diameter only",
			input: []byte(`{"diameter": 8}`),
			want:  "Ø8mm",
		},
		{
			name:  "grade suffix",
			input: []byte(`{"thickness": 2, "width": 4, "grade": "is2062"}`),
			want:  "2mm × 4mm GR:IS2062",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.FormatSpecification(tt.input); got != tt.want {
				t.Fatalf("FormatSpecification(%q) = %q, want %q", string(tt.input), got, tt.want)
			}
		})
	}
}

func TestFormatSpecification_EmptyAndInvalidValues(t *testing.T) {
	cases := [][]byte{
		nil,
		[]byte(""),
		[]byte("{}"),
		[]byte("not json"),
	}

	for _, input := range cases {
		if got := utils.FormatSpecification(input); got != "" {
			t.Fatalf("FormatSpecification(%q) = %q, want empty string", string(input), got)
		}
	}
}
