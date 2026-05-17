package services

import (
	"errors"
	"sort"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
)

const (
	customerResolutionExactExisting = "exact_existing_customer"
	customerResolutionProbable      = "probable_matches"
	customerResolutionCreateNew     = "create_new_customer"

	customerMatchSourceGST      = "gst"
	customerMatchSourcePhone    = "phone"
	customerMatchSourceWhatsApp = "whatsapp"
	customerMatchSourceAlias    = "alias"
	customerMatchSourceFuzzy    = "fuzzy"
	customerMatchSourceName     = "name"
	customerMatchSourceCompany  = "company"
)

var (
	ErrCreateCustomerFailed       = errors.New("unable to create customer")
	ErrSearchCustomersFailed      = errors.New("unable to search customers")
	ErrInvalidCustomerPayload     = errors.New("invalid customer payload")
	ErrInvalidCustomerSearchQuery = errors.New("invalid customer search query")
)

type customerAliasInput struct {
	Raw        string
	Normalized string
}

type normalizedCustomerIdentityInput struct {
	DisplayName        string
	NormalizedName     string
	PhoneNumber        string
	NormalizedPhone    string
	WhatsAppNumber     string
	NormalizedWhatsApp string
	Email              string
	GSTNumber          string
	NormalizedGST      string
	CompanyName        string
	Notes              string
	Aliases            []customerAliasInput
}

type normalizedCustomerSearchInput struct {
	Raw             string
	NormalizedName  string
	NormalizedPhone string
	NormalizedGST   string
	LowerQuery      string
}

type customerMatch struct {
	Customer     db.Customer
	MatchSource  string
	MatchedValue string
	Confidence   models.CustomerConfidenceMetadata
	sortRank     int
}

type customerResolutionResult struct {
	Outcome  string
	Customer *db.Customer
	Matches  []customerMatch
}

func normalizeCustomerCreateRequest(req models.CreateCustomerRequest) (normalizedCustomerIdentityInput, error) {
	displayName := strings.TrimSpace(req.DisplayName)
	normalizedName := utils.NormalizeName(displayName)
	if displayName == "" || normalizedName == "" {
		return normalizedCustomerIdentityInput{}, ErrInvalidCustomerPayload
	}

	phoneNumber := strings.TrimSpace(req.PhoneNumber)
	normalizedPhone := utils.NormalizePhone(phoneNumber)
	if phoneNumber != "" && normalizedPhone == "" {
		return normalizedCustomerIdentityInput{}, ErrInvalidCustomerPayload
	}

	whatsAppNumber := strings.TrimSpace(req.WhatsAppNumber)
	normalizedWhatsApp := utils.NormalizePhone(whatsAppNumber)
	if whatsAppNumber != "" && normalizedWhatsApp == "" {
		return normalizedCustomerIdentityInput{}, ErrInvalidCustomerPayload
	}

	gstNumber := strings.TrimSpace(req.GSTNumber)
	normalizedGST := utils.NormalizeGST(gstNumber)
	if gstNumber != "" && !isValidNormalizedGST(normalizedGST) {
		return normalizedCustomerIdentityInput{}, ErrInvalidCustomerPayload
	}

	aliases := normalizeCustomerAliases(req.Aliases, normalizedName)

	return normalizedCustomerIdentityInput{
		DisplayName:        displayName,
		NormalizedName:     normalizedName,
		PhoneNumber:        phoneNumber,
		NormalizedPhone:    normalizedPhone,
		WhatsAppNumber:     whatsAppNumber,
		NormalizedWhatsApp: normalizedWhatsApp,
		Email:              strings.TrimSpace(req.Email),
		GSTNumber:          gstNumber,
		NormalizedGST:      normalizedGST,
		CompanyName:        strings.TrimSpace(req.CompanyName),
		Notes:              strings.TrimSpace(req.Notes),
		Aliases:            aliases,
	}, nil
}

func normalizeCustomerSearchQuery(raw string) (normalizedCustomerSearchInput, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return normalizedCustomerSearchInput{}, ErrInvalidCustomerSearchQuery
	}

	return normalizedCustomerSearchInput{
		Raw:             trimmed,
		NormalizedName:  utils.NormalizeName(trimmed),
		NormalizedPhone: utils.NormalizePhone(trimmed),
		NormalizedGST:   normalizeSearchGST(trimmed),
		LowerQuery:      strings.ToLower(trimmed),
	}, nil
}

func normalizeSearchGST(raw string) string {
	normalized := utils.NormalizeGST(raw)
	if !isValidNormalizedGST(normalized) {
		return ""
	}
	return normalized
}

func normalizeCustomerAliases(rawAliases []string, normalizedName string) []customerAliasInput {
	seen := map[string]struct{}{
		normalizedName: {},
	}
	aliases := make([]customerAliasInput, 0, len(rawAliases))
	for _, rawAlias := range rawAliases {
		trimmed := strings.TrimSpace(rawAlias)
		normalizedAlias := utils.NormalizeName(trimmed)
		if trimmed == "" || normalizedAlias == "" {
			continue
		}
		if _, exists := seen[normalizedAlias]; exists {
			continue
		}
		seen[normalizedAlias] = struct{}{}
		aliases = append(aliases, customerAliasInput{
			Raw:        trimmed,
			Normalized: normalizedAlias,
		})
	}
	return aliases
}

func isValidNormalizedGST(value string) bool {
	if len(value) != 15 {
		return false
	}
	for _, char := range value {
		if (char < '0' || char > '9') && (char < 'A' || char > 'Z') {
			return false
		}
	}
	return true
}

func buildCustomerReadModel(row db.Customer) models.CustomerReadModel {
	return models.CustomerReadModel{
		ID:             uuidString(row.ID),
		DisplayName:    strings.TrimSpace(row.DisplayName),
		CompanyName:    textValue(row.CompanyName),
		PhoneNumber:    textValue(row.PhoneNumber),
		WhatsAppNumber: textValue(row.WhatsappNumber),
		Email:          textValue(row.Email),
		GSTNumber:      textValue(row.GstNumber),
		Notes:          textValue(row.Notes),
		IsActive:       row.IsActive,
		CreatedAt:      timestampValue(row.CreatedAt),
		UpdatedAt:      timestampValue(row.UpdatedAt),
	}
}

func buildCustomerSearchResult(match customerMatch) models.CustomerSearchResult {
	return models.CustomerSearchResult{
		ID:           uuidString(match.Customer.ID),
		DisplayName:  strings.TrimSpace(match.Customer.DisplayName),
		CompanyName:  textValue(match.Customer.CompanyName),
		PhoneNumber:  textValue(match.Customer.PhoneNumber),
		MatchSource:  match.MatchSource,
		MatchedValue: match.MatchedValue,
		Confidence:   match.Confidence,
	}
}

func sortCustomerMatches(matches []customerMatch) {
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].sortRank != matches[j].sortRank {
			return matches[i].sortRank < matches[j].sortRank
		}
		if matches[i].Confidence.Score != matches[j].Confidence.Score {
			return matches[i].Confidence.Score > matches[j].Confidence.Score
		}
		leftName := matches[i].Customer.NormalizedName
		rightName := matches[j].Customer.NormalizedName
		if leftName != rightName {
			return leftName < rightName
		}
		return uuidString(matches[i].Customer.ID) < uuidString(matches[j].Customer.ID)
	})
}

func matchesToSearchResults(matches []customerMatch) []models.CustomerSearchResult {
	out := make([]models.CustomerSearchResult, 0, len(matches))
	for _, match := range matches {
		out = append(out, buildCustomerSearchResult(match))
	}
	return out
}

func mergeCustomerMatch(existing *customerMatch, candidate customerMatch) customerMatch {
	if existing == nil {
		return candidate
	}
	if candidate.sortRank < existing.sortRank {
		return candidate
	}
	if candidate.sortRank == existing.sortRank && candidate.Confidence.Score > existing.Confidence.Score {
		return candidate
	}
	return *existing
}
