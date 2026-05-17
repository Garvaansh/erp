package models_test

import (
	"encoding/json"
	"testing"

	"github.com/erp/backend/internal/models"
)

func TestSteelSpecs_NormalizedThickness_PrefersMMKey(t *testing.T) {
	s := models.SteelSpecs{Thickness: 1, ThicknessMM: 2}
	if got := s.NormalizedThickness(); got != 2 {
		t.Errorf("NormalizedThickness() = %v, want 2", got)
	}
}

func TestSteelSpecs_NormalizedThickness_FallsBackToLegacy(t *testing.T) {
	s := models.SteelSpecs{Thickness: 3}
	if got := s.NormalizedThickness(); got != 3 {
		t.Errorf("NormalizedThickness() = %v, want 3", got)
	}
}

func TestSteelSpecs_NormalizedWidth_PrefersMMKey(t *testing.T) {
	s := models.SteelSpecs{Width: 1, WidthMM: 5}
	if got := s.NormalizedWidth(); got != 5 {
		t.Errorf("NormalizedWidth() = %v, want 5", got)
	}
}

func TestSteelSpecs_ToNormalized_ClearsLegacyKeys(t *testing.T) {
	s := models.SteelSpecs{Thickness: 1.5, Width: 3, Grade: "IS2062"}
	norm := s.ToNormalized()

	if norm.Thickness != 0 {
		t.Errorf("ToNormalized().Thickness = %v, want 0", norm.Thickness)
	}
	if norm.Width != 0 {
		t.Errorf("ToNormalized().Width = %v, want 0", norm.Width)
	}
	if norm.ThicknessMM != 1.5 {
		t.Errorf("ToNormalized().ThicknessMM = %v, want 1.5", norm.ThicknessMM)
	}
	if norm.WidthMM != 3 {
		t.Errorf("ToNormalized().WidthMM = %v, want 3", norm.WidthMM)
	}
	if norm.Grade != "IS2062" {
		t.Errorf("ToNormalized().Grade = %v, want IS2062", norm.Grade)
	}
}

func TestSteelSpecs_IsValid_ReturnsFalseForEmpty(t *testing.T) {
	s := models.SteelSpecs{}
	if s.IsValid() {
		t.Error("IsValid() = true for empty specs, want false")
	}
}

func TestSteelSpecs_IsValid_ReturnsTrueForDimension(t *testing.T) {
	cases := []struct {
		name string
		spec models.SteelSpecs
	}{
		{"thickness_mm", models.SteelSpecs{ThicknessMM: 1}},
		{"width_mm", models.SteelSpecs{WidthMM: 1}},
		{"thickness", models.SteelSpecs{Thickness: 1}},
		{"diameter", models.SteelSpecs{Diameter: 8}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.spec.IsValid() {
				t.Error("IsValid() = false, want true")
			}
		})
	}
}

func TestCreateItemRequest_JSON_DeserialisationFromFrontend(t *testing.T) {
	payload := `{
		"name": "Stainless Steel",
		"category": "RAW",
		"base_unit": "WEIGHT",
		"specs": {
			"thickness_mm": 1.5,
			"width_mm": 1
		},
		"low_stock_threshold": 1000
	}`

	var req models.CreateItemRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if req.Name != "Stainless Steel" {
		t.Errorf("Name = %q, want Stainless Steel", req.Name)
	}
	if req.Category != "RAW" {
		t.Errorf("Category = %q, want RAW", req.Category)
	}
	if req.Specs.ThicknessMM != 1.5 {
		t.Errorf("Specs.ThicknessMM = %v, want 1.5", req.Specs.ThicknessMM)
	}
	if req.Specs.WidthMM != 1 {
		t.Errorf("Specs.WidthMM = %v, want 1", req.Specs.WidthMM)
	}
	if req.LowStockThreshold != 1000 {
		t.Errorf("LowStockThreshold = %v, want 1000", req.LowStockThreshold)
	}

	// Ensure no coil_weight confusion
	norm := req.Specs.ToNormalized()
	out, err := json.Marshal(norm)
	if err != nil {
		t.Fatalf("Marshal normalized specs failed: %v", err)
	}

	var stored map[string]any
	if err := json.Unmarshal(out, &stored); err != nil {
		t.Fatalf("Unmarshal stored specs failed: %v", err)
	}

	if _, exists := stored["coil_weight"]; exists {
		t.Error("Stored specs contain coil_weight, should not be present")
	}
}

func TestCreateItemRequest_JSON_NoCoilWeightAccepted(t *testing.T) {
	payload := `{
		"name": "Steel",
		"category": "RAW",
		"base_unit": "WEIGHT",
		"specs": {
			"thickness_mm": 2,
			"width_mm": 4,
			"coil_weight": 500
		}
	}`

	var req models.CreateItemRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// coil_weight should be silently ignored — not part of SteelSpecs
	norm := req.Specs.ToNormalized()
	out, err := json.Marshal(norm)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var stored map[string]any
	if err := json.Unmarshal(out, &stored); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if _, exists := stored["coil_weight"]; exists {
		t.Error("coil_weight leaked into normalized specs")
	}
}

func TestCreateItemRequest_JSON_NoCategoryCodeRequired(t *testing.T) {
	payload := `{
		"name": "Carbon Steel",
		"category": "RAW",
		"base_unit": "WEIGHT",
		"specs": { "thickness_mm": 1, "width_mm": 3 }
	}`

	var req models.CreateItemRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// category_code should be empty — backend derives it automatically
	if req.CategoryCode != "" {
		t.Errorf("CategoryCode = %q, want empty (auto-derived)", req.CategoryCode)
	}
}
