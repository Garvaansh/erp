package services

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type customerIdentityReader interface {
	GetCustomerByNormalizedGST(ctx context.Context, normalizedGst pgtype.Text) (db.Customer, error)
	GetCustomerByNormalizedPhone(ctx context.Context, normalizedPhone pgtype.Text) (db.Customer, error)
	GetCustomerByNormalizedWhatsApp(ctx context.Context, normalizedWhatsapp pgtype.Text) (db.Customer, error)
	ListCustomersByNormalizedAlias(ctx context.Context, normalizedAlias string) ([]db.Customer, error)
	ListCustomerFuzzyCandidates(ctx context.Context, arg db.ListCustomerFuzzyCandidatesParams) ([]db.ListCustomerFuzzyCandidatesRow, error)
}

type CustomerResolutionService struct {
	fuzzy customerFuzzyService
}

func NewCustomerResolutionService() *CustomerResolutionService {
	return &CustomerResolutionService{fuzzy: newCustomerFuzzyService()}
}

func (s *CustomerResolutionService) ResolveCustomerIdentity(ctx context.Context, reader customerIdentityReader, input normalizedCustomerIdentityInput) (*customerResolutionResult, error) {
	if s == nil {
		s = NewCustomerResolutionService()
	}

	exactMatches, err := s.collectExactMatches(ctx, reader, input)
	if err != nil {
		return nil, err
	}
	if len(exactMatches) > 1 {
		sortCustomerMatches(exactMatches)
		return &customerResolutionResult{Outcome: customerResolutionProbable, Matches: exactMatches}, nil
	}
	if len(exactMatches) == 1 {
		exact := exactMatches[0]
		return &customerResolutionResult{Outcome: customerResolutionExactExisting, Customer: &exact.Customer, Matches: exactMatches}, nil
	}

	aliasMatches, err := s.collectAliasMatches(ctx, reader, input)
	if err != nil {
		return nil, err
	}
	if len(aliasMatches) > 1 {
		sortCustomerMatches(aliasMatches)
		return &customerResolutionResult{Outcome: customerResolutionProbable, Matches: aliasMatches}, nil
	}
	if len(aliasMatches) == 1 {
		alias := aliasMatches[0]
		return &customerResolutionResult{Outcome: customerResolutionExactExisting, Customer: &alias.Customer, Matches: aliasMatches}, nil
	}

	fuzzyMatches, err := s.collectFuzzyMatches(ctx, reader, input.NormalizedName)
	if err != nil {
		return nil, err
	}
	if len(fuzzyMatches) > 0 {
		sortCustomerMatches(fuzzyMatches)
		return &customerResolutionResult{Outcome: customerResolutionProbable, Matches: fuzzyMatches}, nil
	}

	return &customerResolutionResult{Outcome: customerResolutionCreateNew}, nil
}

func (s *CustomerResolutionService) collectExactMatches(ctx context.Context, reader customerIdentityReader, input normalizedCustomerIdentityInput) ([]customerMatch, error) {
	matchByCustomerID := make(map[string]customerMatch)

	if input.NormalizedGST != "" {
		row, err := reader.GetCustomerByNormalizedGST(ctx, textOrNull(input.NormalizedGST))
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			customerID := uuidString(row.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(nil, exactCustomerMatch(row, customerMatchSourceGST, input.NormalizedGST, "matched canonical GST identity"))
		}
	}

	if input.NormalizedPhone != "" {
		row, err := reader.GetCustomerByNormalizedPhone(ctx, textOrNull(input.NormalizedPhone))
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			customerID := uuidString(row.ID)
			merged := mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), exactCustomerMatch(row, customerMatchSourcePhone, input.NormalizedPhone, "matched canonical phone identity"))
			matchByCustomerID[customerID] = merged
		}
	}

	if input.NormalizedWhatsApp != "" {
		row, err := reader.GetCustomerByNormalizedWhatsApp(ctx, textOrNull(input.NormalizedWhatsApp))
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			customerID := uuidString(row.ID)
			merged := mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), exactCustomerMatch(row, customerMatchSourceWhatsApp, input.NormalizedWhatsApp, "matched canonical WhatsApp identity"))
			matchByCustomerID[customerID] = merged
		}
	}

	return mapCustomerMatches(matchByCustomerID), nil
}

func (s *CustomerResolutionService) collectAliasMatches(ctx context.Context, reader customerIdentityReader, input normalizedCustomerIdentityInput) ([]customerMatch, error) {
	aliasTerms := []string{input.NormalizedName}
	for _, alias := range input.Aliases {
		aliasTerms = append(aliasTerms, alias.Normalized)
	}

	matchByCustomerID := make(map[string]customerMatch)
	seenTerms := make(map[string]struct{})
	for _, aliasTerm := range aliasTerms {
		if aliasTerm == "" {
			continue
		}
		if _, exists := seenTerms[aliasTerm]; exists {
			continue
		}
		seenTerms[aliasTerm] = struct{}{}

		rows, err := reader.ListCustomersByNormalizedAlias(ctx, aliasTerm)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			customerID := uuidString(row.ID)
			match := customerMatch{
				Customer:     row,
				MatchSource:  customerMatchSourceAlias,
				MatchedValue: aliasTerm,
				Confidence: models.CustomerConfidenceMetadata{
					Score:  0.985,
					Level:  "high",
					Reason: "matched curated customer alias",
				},
				sortRank: customerAliasExactRank,
			}
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), match)
		}
	}

	return mapCustomerMatches(matchByCustomerID), nil
}

func (s *CustomerResolutionService) collectFuzzyMatches(ctx context.Context, reader customerIdentityReader, normalizedQuery string) ([]customerMatch, error) {
	if normalizedQuery == "" {
		return nil, nil
	}

	rows, err := reader.ListCustomerFuzzyCandidates(ctx, db.ListCustomerFuzzyCandidatesParams{
		NormalizedQuery: normalizedQuery,
		LowerQuery:      strings.ToLower(normalizedQuery),
		PageLimit:       customerFuzzyCandidateLimit,
	})
	if err != nil {
		return nil, err
	}

	matchByCustomerID := make(map[string]customerMatch)
	for _, row := range rows {
		match, ok := s.fuzzy.Score(normalizedQuery, row.Customer, row.MatchedAlias)
		if !ok {
			continue
		}
		customerID := uuidString(row.Customer.ID)
		matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), match)
	}

	return mapCustomerMatches(matchByCustomerID), nil
}

func exactCustomerMatch(row db.Customer, source string, matchedValue string, reason string) customerMatch {
	return customerMatch{
		Customer:     row,
		MatchSource:  source,
		MatchedValue: matchedValue,
		Confidence: models.CustomerConfidenceMetadata{
			Score:  1,
			Level:  "exact",
			Reason: reason,
		},
		sortRank: customerExactRank,
	}
}

func existingCustomerMatch(matchByCustomerID map[string]customerMatch, customerID string) *customerMatch {
	if match, ok := matchByCustomerID[customerID]; ok {
		return &match
	}
	return nil
}

func mapCustomerMatches(matchByCustomerID map[string]customerMatch) []customerMatch {
	matches := make([]customerMatch, 0, len(matchByCustomerID))
	for _, match := range matchByCustomerID {
		matches = append(matches, match)
	}
	return matches
}
