package validators

import (
	"github.com/erp/backend/internal/settings/dto"
	"testing"
)

func TestGSTINValidation(t *testing.T) {
	tests := []struct {
		name    string
		gstin   string
		isValid bool
	}{
		{"Valid GSTIN", "29ABCDE1234F1Z5", true},
		{"Empty GSTIN", "", true}, // required tag handles empty, so gstin validation should return true
		{"Invalid Length", "29ABCDE1234F1Z", false},
		{"Invalid Format", "29ABCDE1234F123", false},
		{"Invalid Characters", "29ABCDE1234F1Z@", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := dto.BusinessSettings{
				CompanyName: "Test",
				GSTIN:       tt.gstin,
				Phone:       "1234567890",
				Email:       "test@example.com",
				Address:     "Test Address",
				BankDetails: "Test Bank",
			}
			err := Validate.Struct(s)
			if tt.isValid && err != nil {
				// Only fail if the error is specifically about GSTIN and not "required" for empty test
				if tt.gstin != "" || err.Error() != "Key: 'BusinessSettings.GSTIN' Error:Field validation for 'GSTIN' failed on the 'required' tag" {
					t.Errorf("Expected valid GSTIN but got error: %v", err)
				}
			} else if !tt.isValid && err == nil {
				t.Errorf("Expected invalid GSTIN but got no error")
			}
		})
	}
}
