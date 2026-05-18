"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Edit2, MessageCircle, Smartphone, BadgeCheck, BadgeAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWhatsappSettings, updateWhatsappSettings } from "../api";
import { whatsappSettingsSchema, WhatsappSettingsFormValues } from "../schemas/settings-schemas";

export function WhatsappSettingsForm() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "whatsapp"],
    queryFn: getWhatsappSettings,
  });

  const form = useForm<WhatsappSettingsFormValues>({
    resolver: zodResolver(whatsappSettingsSchema),
    values: data || {
      enabled: false,
      business_phone: "",
      default_template: "Hello {{name}}, here is your invoice {{invoice_number}}.",
    },
  });

  const watchTemplate = useWatch({
    control: form.control,
    name: "default_template",
  });
  
  const displayTemplate = isEditing ? (watchTemplate ?? form.getValues("default_template")) : (data?.default_template || "");

  const mutation = useMutation({
    mutationFn: updateWhatsappSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "whatsapp"] });
      toast.success("WhatsApp configuration updated");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Consider it configured if it has a business phone or is explicitly enabled.
  const isConfigured = data && (data.business_phone || data.enabled);

  if (isConfigured && !isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">WhatsApp Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Automated messaging and business profile integration.
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Configuration
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center">
                  <Smartphone className="mr-2 h-4 w-4" />
                  Connection Status
                </span>
                {data.enabled ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <BadgeCheck className="mr-1 h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-50 text-slate-500">
                    <BadgeAlert className="mr-1 h-3 w-3" /> Disabled
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="grid grid-cols-3">
                  <span className="text-muted-foreground">Business Phone</span>
                  <span className="col-span-2 font-medium">{data.business_phone || "Not configured"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-slate-50 p-4 text-sm border text-slate-700 whitespace-pre-wrap">
                {data.default_template || "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Variables like <code className="bg-muted px-1 rounded">{"{{name}}"}</code> are replaced with customer details automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isConfigured ? "Edit WhatsApp Integration" : "Setup WhatsApp Integration"}</CardTitle>
        <CardDescription>
          Configure automatic notifications sent to your customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
            
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50/50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium text-slate-900">Enable WhatsApp Messaging</FormLabel>
                    <FormDescription>
                      Turn on automated invoice delivery and notifications.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="business_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormDescription>Must include country code.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="default_template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Message Template</FormLabel>
                  <FormControl>
                    <Input placeholder="Hello {{name}}, here is your invoice {{invoice_number}}..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Available variables: <code>{"{{name}}"}</code>, <code>{"{{invoice_number}}"}</code>, <code>{"{{total}}"}</code>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {displayTemplate && (
              <div className="rounded-md bg-slate-50 p-4 text-sm border">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Live Preview Example</p>
                <p className="text-slate-700 whitespace-pre-wrap">
                  {displayTemplate
                    .replace(/\{\{name\}\}/g, "Rahul Kumar")
                    .replace(/\{\{invoice_number\}\}/g, "INV-2026-00014")
                    .replace(/\{\{total\}\}/g, "₹5,900.00")}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t">
              {isConfigured && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    form.reset(data);
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
}
