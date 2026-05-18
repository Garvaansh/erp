package validators

import (
	"regexp"

	"github.com/go-playground/validator/v10"
)

var Validate *validator.Validate

func init() {
	Validate = validator.New()

	Validate.RegisterValidation("gstin", validateGSTIN)
}

func validateGSTIN(fl validator.FieldLevel) bool {
	gstin := fl.Field().String()
	if gstin == "" {
		return true // leave required to handle empty checks
	}
	// Basic Indian GSTIN format: 2 digits + 10 PAN chars + 1 entity code + Z + 1 check digit
	match, _ := regexp.MatchString(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`, gstin)
	return match
}
