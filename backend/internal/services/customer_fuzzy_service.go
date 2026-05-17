package services

import (
	"strings"

	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
)

const (
	customerFuzzyCandidateLimit  = 25
	customerSearchCandidateLimit = 50
	customerExactRank            = 1
	customerAliasExactRank       = 2
	customerLexicalRank          = 3
	customerFuzzyRank            = 4
)

type customerFuzzyService struct {
	jaroWinkler *metrics.JaroWinkler
	levenshtein *metrics.Levenshtein
}

func newCustomerFuzzyService() customerFuzzyService {
	return customerFuzzyService{
		jaroWinkler: metrics.NewJaroWinkler(),
		levenshtein: metrics.NewLevenshtein(),
	}
}

func (s customerFuzzyService) Score(query string, row db.Customer, alias string) (customerMatch, bool) {
	normalizedQuery := utils.NormalizeName(query)
	if normalizedQuery == "" {
		return customerMatch{}, false
	}

	candidates := []struct {
		source string
		value  string
		reason string
	}{
		{
			source: customerMatchSourceFuzzy,
			value:  row.NormalizedName,
			reason: "strong fuzzy similarity on normalized customer name",
		},
	}

	if normalizedAlias := utils.NormalizeName(alias); normalizedAlias != "" {
		candidates = append(candidates, struct {
			source string
			value  string
			reason string
		}{
			source: customerMatchSourceAlias,
			value:  normalizedAlias,
			reason: "strong fuzzy similarity on curated customer alias",
		})
	}

	if companyName := utils.NormalizeName(textValue(row.CompanyName)); companyName != "" {
		candidates = append(candidates, struct {
			source string
			value  string
			reason string
		}{
			source: customerMatchSourceFuzzy,
			value:  companyName,
			reason: "strong fuzzy similarity on customer company name",
		})
	}

	bestScore := 0.0
	bestSource := customerMatchSourceFuzzy
	bestValue := ""
	bestReason := ""

	for _, candidate := range candidates {
		if candidate.value == "" {
			continue
		}

		jaro := strutil.Similarity(normalizedQuery, candidate.value, s.jaroWinkler)
		lev := strutil.Similarity(normalizedQuery, candidate.value, s.levenshtein)
		score := (0.7 * jaro) + (0.3 * lev)
		if !passesFuzzyGate(normalizedQuery, candidate.value, jaro, lev, score) {
			continue
		}
		if score > bestScore {
			bestScore = score
			bestSource = candidate.source
			bestValue = candidate.value
			bestReason = candidate.reason
		}
	}

	if bestScore == 0 {
		return customerMatch{}, false
	}

	return customerMatch{
		Customer:     row,
		MatchSource:  bestSource,
		MatchedValue: bestValue,
		Confidence: models.CustomerConfidenceMetadata{
			Score:  roundScore(bestScore),
			Level:  fuzzyConfidenceLevel(bestScore),
			Reason: bestReason,
		},
		sortRank: customerFuzzyRank,
	}, true
}

func passesFuzzyGate(query string, candidate string, jaro float64, lev float64, score float64) bool {
	if score < 0.89 || jaro < 0.9 || lev < 0.7 {
		return false
	}

	queryTokens := strings.Fields(query)
	candidateTokens := strings.Fields(candidate)
	if len(queryTokens) > 0 && len(candidateTokens) > 0 {
		if queryTokens[0][0] != candidateTokens[0][0] {
			return false
		}
	}

	return true
}

func fuzzyConfidenceLevel(score float64) string {
	switch {
	case score >= 0.97:
		return "high"
	case score >= 0.93:
		return "medium"
	default:
		return "review"
	}
}

func roundScore(score float64) float64 {
	return float64(int(score*1000+0.5)) / 1000
}
