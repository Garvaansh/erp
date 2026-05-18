"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Edit2, Settings, AlignLeft, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInvoiceSettings, updateInvoiceSettings, getBusinessSettings } from "../api";
import { invoiceSettingsSchema, InvoiceSettingsFormValues } from "../schemas/settings-schemas";
import { InvoicePreviewShell } from "@/features/invoices/components/invoice-preview-shell";
import { buildSettingsPreviewDocument } from "@/features/invoices/utils/build-settings-preview";

export function InvoiceSettingsForm() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: invoiceData, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ["settings", "invoice"],
    queryFn: getInvoiceSettings,
  });

  const { data: businessData } = useQuery({
    queryKey: ["settings", "business"],
    queryFn: getBusinessSettings,
  });

  const defaultValues: InvoiceSettingsFormValues = {
    invoice_prefix: "INV-",
    default_payment_terms_days: 30,
    footer_note: "",
    declaration_text: "",
    default_cgst_percent: 9,
    default_sgst_percent: 9,
  };

  const form = useForm<InvoiceSettingsFormValues>({
    resolver: zodResolver(invoiceSettingsSchema),
    values: invoiceData ?? defaultValues,
  });

  // useWatch gives us live-reactive values for the preview
  const watchedValues = useWatch({ control: form.control });

  const mutation = useMutation({
    mutationFn: updateInvoiceSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invoice"] });
      toast.success("Invoice configuration updated");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  if (isInvoiceLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = !!(invoiceData?.invoice_prefix);

  // Always build preview from live watched values (form state), falling back to saved data
  const previewDoc = buildSettingsPreviewDocument({
    companyName: businessData?.company_name ?? "",
    gstin: businessData?.gstin ?? "",
    address: businessData?.address ?? "",
    phone: businessData?.phone ?? "",
    email: businessData?.email ?? "",
    logoUrl: businessData?.logo_url ?? "",
    bankDetails: businessData?.bank_details ?? "",
    invoicePrefix: watchedValues.invoice_prefix ?? invoiceData?.invoice_prefix ?? "INV-",
    paymentTermsDays: Number(watchedValues.default_payment_terms_days ?? invoiceData?.default_payment_terms_days ?? 30),
    cgstPercent: Number(watchedValues.default_cgst_percent ?? invoiceData?.default_cgst_percent ?? 9),
    sgstPercent: Number(watchedValues.default_sgst_percent ?? invoiceData?.default_sgst_percent ?? 9),
    footerNote: watchedValues.footer_note ?? invoiceData?.footer_note ?? "",
    declarationText: watchedValues.declaration_text ?? invoiceData?.declaration_text ?? "",
  });

  const renderReadView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Invoice Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Default settings applied to all new invoices.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit Settings
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center">
              <Settings className="mr-1.5 h-3.5 w-3.5" /> Defaults & Taxes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row label="Invoice Prefix" value={invoiceData!.invoice_prefix} />
            <Row label="Payment Terms" value={`Net ${invoiceData!.default_payment_terms_days} Days`} />
            <Row label="Default CGST" value={`${invoiceData!.default_cgst_percent}%`} />
            <Row label="Default SGST" value={`${invoiceData!.default_sgst_percent}%`} />
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center">
              <AlignLeft className="mr-1.5 h-3.5 w-3.5" /> Footer & Declarations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row label="Footer Note" value={invoiceData!.footer_note || "—"} />
            <Row label="Declaration" value={invoiceData!.declaration_text || "—"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderEditForm = () => (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pb-4">
        <CardTitle>{isConfigured ? "Edit Invoice Configuration" : "Setup Invoice Configuration"}</CardTitle>
        <CardDescription>
          Configure default taxes, formatting, and standard terms. The preview updates live.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Prefix</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_payment_terms_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="30"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_cgst_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default CGST (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        placeholder="9"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_sgst_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default SGST (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        placeholder="9"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="footer_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer Note</FormLabel>
                  <FormControl>
                    <Input placeholder="This is a computer-generated invoice." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="declaration_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Declaration Text</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="We declare that this invoice shows the actual price of goods..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-2 border-t">
              {isConfigured && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset(invoiceData ?? defaultValues);
                    setIsEditing(false);
                  }}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Top: form or read view — full width */}
      {isConfigured && !isEditing ? renderReadView() : renderEditForm()}

      {/* Bottom: live A4 preview (always visible) */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center mb-3 uppercase tracking-wider">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Live Invoice Preview
        </h4>
        {/* Scale the 794px A4 doc to fit the container */}
        <div className="overflow-auto rounded-md">
          <div
            style={{
              transformOrigin: "top left",
              transform: "scale(0.72)",
              width: "794px",
              // Compensate the scale so the parent div shows correctly
              marginBottom: "calc((794px * 0.72 - 794px))",
            }}
          >
            <InvoicePreviewShell doc={previewDoc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right ml-4 truncate max-w-[200px]">{value}</span>
    </div>
  );
}
