import { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BusinessSettingsForm } from "@/features/settings/components/business-settings-form";
import { InvoiceSettingsForm } from "@/features/settings/components/invoice-settings-form";
import { WhatsappSettingsForm } from "@/features/settings/components/whatsapp-settings-form";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your system settings and configurations.",
};

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList>
          <TabsTrigger value="business">Business Profile</TabsTrigger>
          <TabsTrigger value="invoice">Invoice Defaults</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Manage your core business identity, contact details, and GSTIN.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="invoice" className="space-y-4">
          <div className="px-1">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Invoice Defaults</h3>
              <p className="text-sm text-muted-foreground">
                Configure how your invoices are generated and formatted.
              </p>
            </div>
            <InvoiceSettingsForm />
          </div>
        </TabsContent>
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>
                Set up WhatsApp business integration for automated communications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsappSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
