package dto

type BusinessSettings struct {
	CompanyName string `json:"company_name" validate:"required"`
	GSTIN       string `json:"gstin" validate:"required,gstin"`
	Phone       string `json:"phone" validate:"required"`
	Email       string `json:"email" validate:"required,email"`
	Address     string `json:"address" validate:"required"`
	LogoURL     string `json:"logo_url" validate:"omitempty,url"`
	BankDetails string `json:"bank_details" validate:"required"`
}

type InvoiceSettings struct {
	InvoicePrefix           string  `json:"invoice_prefix" validate:"required,max=10"`
	DefaultPaymentTermsDays int     `json:"default_payment_terms_days" validate:"required,min=0"`
	FooterNote              string  `json:"footer_note"`
	DeclarationText         string  `json:"declaration_text"`
	DefaultCGSTPercent      float64 `json:"default_cgst_percent" validate:"min=0,max=100"`
	DefaultSGSTPercent      float64 `json:"default_sgst_percent" validate:"min=0,max=100"`
}

type WhatsappSettings struct {
	Enabled         bool   `json:"enabled"`
	BusinessPhone   string `json:"business_phone" validate:"required_if=Enabled true"`
	DefaultTemplate string `json:"default_template"`
}
