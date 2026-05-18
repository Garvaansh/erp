import { z } from "zod";

export const businessSettingsSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)"
    ),
  phone: z.string().min(10, "Phone must be at least 10 characters"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required"),
  logo_url: z.string().url("Must be a valid URL").or(z.literal("")),
  bank_details: z.string().min(1, "Bank details are required"),
});

// Numeric fields must remain z.number() to be compatible with RHF + zodResolver.
// Use valueAsNumber on <input type="number"> to ensure numbers come in (not strings).
export const invoiceSettingsSchema = z.object({
  invoice_prefix: z.string().min(1, "Prefix is required").max(10, "Max 10 characters"),
  default_payment_terms_days: z.number().min(0),
  footer_note: z.string(),
  declaration_text: z.string(),
  default_cgst_percent: z.number().min(0).max(100),
  default_sgst_percent: z.number().min(0).max(100),
});

export const whatsappSettingsSchema = z
  .object({
    enabled: z.boolean(),
    business_phone: z.string(),
    default_template: z.string(),
  })
  .refine(
    (data) => {
      if (data.enabled && data.business_phone.length < 10) return false;
      return true;
    },
    {
      message: "Business phone must be provided if WhatsApp is enabled",
      path: ["business_phone"],
    }
  );

export type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>;
export type InvoiceSettingsFormValues = z.infer<typeof invoiceSettingsSchema>;
export type WhatsappSettingsFormValues = z.infer<typeof whatsappSettingsSchema>;
