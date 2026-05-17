package services

import (
	"context"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomerQueryService struct {
	queries *db.Queries
	fuzzy   customerFuzzyService
}

func NewCustomerQueryService(pool *pgxpool.Pool) *CustomerQueryService {
	if pool == nil {
		return &CustomerQueryService{}
	}
	return &CustomerQueryService{
		queries: db.New(pool),
		fuzzy:   newCustomerFuzzyService(),
	}
}

func (s *CustomerQueryService) SearchCustomers(ctx context.Context, rawQuery string, page int32, pageSize int32) (*models.CustomerSearchPage, error) {
	if s == nil || s.queries == nil {
		return nil, ErrSearchCustomersFailed
	}

	input, err := normalizeCustomerSearchQuery(rawQuery)
	if err != nil {
		return nil, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	matchByCustomerID := make(map[string]customerMatch)

	if input.NormalizedGST != "" {
		if row, err := s.queries.GetCustomerByNormalizedGST(ctx, textOrNull(input.NormalizedGST)); err == nil {
			customerID := uuidString(row.ID)
			matchByCustomerID[customerID] = exactCustomerMatch(row, customerMatchSourceGST, input.NormalizedGST, "matched canonical GST identity")
		}
	}

	if input.NormalizedPhone != "" {
		if row, err := s.queries.GetCustomerByNormalizedPhone(ctx, textOrNull(input.NormalizedPhone)); err == nil {
			customerID := uuidString(row.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), exactCustomerMatch(row, customerMatchSourcePhone, input.NormalizedPhone, "matched canonical phone identity"))
		}
		if row, err := s.queries.GetCustomerByNormalizedWhatsApp(ctx, textOrNull(input.NormalizedPhone)); err == nil {
			customerID := uuidString(row.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), exactCustomerMatch(row, customerMatchSourceWhatsApp, input.NormalizedPhone, "matched canonical WhatsApp identity"))
		}
	}

	if input.NormalizedName != "" {
		aliasRows, err := s.queries.ListCustomersByNormalizedAlias(ctx, input.NormalizedName)
		if err != nil {
			return nil, ErrSearchCustomersFailed
		}
		for _, row := range aliasRows {
			customerID := uuidString(row.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), customerMatch{
				Customer:     row,
				MatchSource:  customerMatchSourceAlias,
				MatchedValue: input.NormalizedName,
				Confidence: models.CustomerConfidenceMetadata{
					Score:  0.985,
					Level:  "high",
					Reason: "matched curated customer alias",
				},
				sortRank: customerAliasExactRank,
			})
		}

		lexicalRows, err := s.queries.ListCustomerSearchCandidates(ctx, db.ListCustomerSearchCandidatesParams{
			NormalizedQuery: input.NormalizedName,
			LowerQuery:      input.LowerQuery,
			PageLimit:       customerSearchCandidateLimit,
		})
		if err != nil {
			return nil, ErrSearchCustomersFailed
		}
		for _, row := range lexicalRows {
			match := lexicalCustomerMatch(input, row)
			customerID := uuidString(row.Customer.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), match)
		}

		fuzzyRows, err := s.queries.ListCustomerFuzzyCandidates(ctx, db.ListCustomerFuzzyCandidatesParams{
			NormalizedQuery: input.NormalizedName,
			LowerQuery:      input.LowerQuery,
			PageLimit:       customerFuzzyCandidateLimit,
		})
		if err != nil {
			return nil, ErrSearchCustomersFailed
		}
		for _, row := range fuzzyRows {
			match, ok := s.fuzzy.Score(input.NormalizedName, row.Customer, row.MatchedAlias)
			if !ok {
				continue
			}
			customerID := uuidString(row.Customer.ID)
			matchByCustomerID[customerID] = mergeCustomerMatch(existingCustomerMatch(matchByCustomerID, customerID), match)
		}
	}

	matches := mapCustomerMatches(matchByCustomerID)
	sortCustomerMatches(matches)

	total := len(matches)
	start := int((page - 1) * pageSize)
	if start > total {
		start = total
	}
	end := start + int(pageSize)
	if end > total {
		end = total
	}

	return &models.CustomerSearchPage{
		Items:    matchesToSearchResults(matches[start:end]),
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	}, nil
}

func lexicalCustomerMatch(input normalizedCustomerSearchInput, row db.ListCustomerSearchCandidatesRow) customerMatch {
	source := customerMatchSourceName
	matchedValue := row.Customer.NormalizedName
	score := 0.86
	level := "medium"
	reason := "matched normalized customer name"

	switch {
	case row.Customer.NormalizedName == input.NormalizedName:
		source = customerMatchSourceName
		matchedValue = row.Customer.NormalizedName
		score = 0.93
		reason = "exact normalized customer name match"
	case row.MatchedNormalizedAlias != "":
		source = customerMatchSourceAlias
		matchedValue = row.MatchedAlias
		score = 0.91
		reason = "matched customer alias prefix"
	case strings.EqualFold(textValue(row.Customer.CompanyName), input.Raw):
		source = customerMatchSourceCompany
		matchedValue = textValue(row.Customer.CompanyName)
		score = 0.89
		reason = "matched company name"
	case textValue(row.Customer.CompanyName) != "":
		source = customerMatchSourceCompany
		matchedValue = textValue(row.Customer.CompanyName)
		score = 0.84
		level = "review"
		reason = "matched company name prefix"
	default:
		source = customerMatchSourceName
		matchedValue = row.Customer.NormalizedName
		score = 0.86
		reason = "matched normalized customer name prefix"
	}

	return customerMatch{
		Customer:     row.Customer,
		MatchSource:  source,
		MatchedValue: matchedValue,
		Confidence: models.CustomerConfidenceMetadata{
			Score:  score,
			Level:  level,
			Reason: reason,
		},
		sortRank: customerLexicalRank,
	}
}
