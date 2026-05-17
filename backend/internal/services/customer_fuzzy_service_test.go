package services

import (
	"testing"

	"github.com/erp/backend/internal/db"
)

func TestCustomerFuzzyServiceScoresTypoSimilarity(t *testing.T) {
	service := newCustomerFuzzyService()
	row := db.Customer{
		DisplayName:    "Acme Traders",
		NormalizedName: "acme traders",
	}

	match, ok := service.Score("acme trdaers", row, "")
	if !ok {
		t.Fatal("expected fuzzy score to accept a close typo")
	}
	if match.MatchSource != customerMatchSourceFuzzy {
		t.Fatalf("expected fuzzy source, got %q", match.MatchSource)
	}
	if match.Confidence.Score < 0.89 {
		t.Fatalf("expected strong fuzzy score, got %.3f", match.Confidence.Score)
	}
}

func TestCustomerFuzzyServicePrefersAliasWhenStronger(t *testing.T) {
	service := newCustomerFuzzyService()
	row := db.Customer{
		DisplayName:    "Shree Balaji Tubes",
		NormalizedName: "shree balaji tubes private limited",
	}

	match, ok := service.Score("balaji tubes", row, "balaji tubes")
	if !ok {
		t.Fatal("expected alias similarity to produce a match")
	}
	if match.MatchSource != customerMatchSourceAlias {
		t.Fatalf("expected alias source, got %q", match.MatchSource)
	}
}

func TestCustomerFuzzyServiceRejectsFalsePositive(t *testing.T) {
	service := newCustomerFuzzyService()
	row := db.Customer{
		DisplayName:    "Global Metals",
		NormalizedName: "global metals",
	}

	if _, ok := service.Score("acme traders", row, ""); ok {
		t.Fatal("expected unrelated names to be rejected")
	}
}
