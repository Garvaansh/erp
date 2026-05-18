"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Edit2, Building2, MapPin, Landmark, Phone, Mail, Image as ImageIcon } from "lucide-react";

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
import { getBusinessSettings, updateBusinessSettings } from "../api";
import { businessSettingsSchema, BusinessSettingsFormValues } from "../schemas/settings-schemas";

export function BusinessSettingsForm() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "business"],
    queryFn: getBusinessSettings,
  });

  const form = useForm<BusinessSettingsFormValues>({
    resolver: zodResolver(businessSettingsSchema),
    values: data || {
      company_name: "",
      gstin: "",
      phone: "",
      email: "",
      address: "",
      logo_url: "",
      bank_details: "",
    },
  });

  const mutation = useMutation({
    mutationFn: updateBusinessSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "business"] });
      toast.success("Business profile updated successfully");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = data && data.company_name;

  if (isConfigured && !isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Business Profile</h3>
            <p className="text-sm text-muted-foreground">
              Core identity and billing details used across the system.
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Building2 className="mr-2 h-4 w-4" />
                Company Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="grid grid-cols-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="col-span-2 font-medium">{data.company_name}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted-foreground">GSTIN</span>
                  <span className="col-span-2 font-medium">{data.gstin || "—"}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="col-span-2 font-medium flex items-center">
                    <Phone className="mr-2 h-3 w-3 text-muted-foreground" />
                    {data.phone}
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-muted-foreground">Email</span>
                  <span className="col-span-2 font-medium flex items-center">
                    <Mail className="mr-2 h-3 w-3 text-muted-foreground" />
                    {data.email}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <MapPin className="mr-2 h-4 w-4" />
                Address & Branding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Business Address</span>
                  <p className="font-medium whitespace-pre-wrap">{data.address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center mb-1">
                    <ImageIcon className="mr-2 h-3 w-3" />
                    Logo URL
                  </span>
                  <p className="font-medium break-all">{data.logo_url || "Not configured"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Landmark className="mr-2 h-4 w-4" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium whitespace-pre-wrap">{data.bank_details}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isConfigured ? "Edit Business Profile" : "Setup Business Profile"}</CardTitle>
        <CardDescription>
          Configure your company identity. These details will appear on invoices and public documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="29ABCDE1234F1Z5" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support Email</FormLabel>
                    <FormControl>
                      <Input placeholder="support@acme.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Industrial Area..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Details</FormLabel>
                  <FormControl>
                    <Input placeholder="Bank Name, A/C: 123456, IFSC: SBIN0000123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
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
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
