"use client";

import { UserPlus } from "lucide-react";
import { type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SearchCombobox, type SearchComboboxOption } from "@/features/orders/components/search-combobox";
import type { DraftCustomerValues } from "@/features/orders/schemas/order-schema";
import type { CustomerSearchResult } from "@/features/orders/types";

type OrderCustomerSectionProps = {
  selectedCustomer: CustomerSearchResult | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchOptions: SearchComboboxOption[];
  searchResults: CustomerSearchResult[];
  onSelectCustomer: (customer: CustomerSearchResult) => void;
  isSearching: boolean;
  createForm: UseFormReturn<DraftCustomerValues>;
  showCreateForm: boolean;
  onToggleCreateForm: () => void;
  onCreateCustomer: () => void;
  isCreatingCustomer: boolean;
  createCustomerError: string;
  probableMatches: CustomerSearchResult[];
};

export function OrderCustomerSection({
  selectedCustomer,
  searchQuery,
  onSearchQueryChange,
  searchOptions,
  searchResults,
  onSelectCustomer,
  isSearching,
  createForm,
  showCreateForm,
  onToggleCreateForm,
  onCreateCustomer,
  isCreatingCustomer,
  createCustomerError,
  probableMatches,
}: OrderCustomerSectionProps) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedCustomer ? (
          <div className="rounded-2xl border bg-muted/30 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold text-foreground">
                  {selectedCustomer.display_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedCustomer.company_name || "Direct customer"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedCustomer.phone_number || "Phone not recorded"}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onToggleCreateForm}>
                Change Customer
              </Button>
            </div>
          </div>
        ) : null}

        {!selectedCustomer || showCreateForm ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-foreground">
                Search existing customer
              </div>
              <SearchCombobox
                value={selectedCustomer?.id ?? ""}
                inputValue={searchQuery}
                onInputValueChange={onSearchQueryChange}
                onSelect={(option) => {
                  const customer = searchResults
                    .concat(probableMatches)
                    .find((item) => item.id === option.value);

                  if (customer) {
                    onSelectCustomer(customer);
                  }
                }}
                options={searchOptions}
                placeholder="Search customer name, phone, or GST"
                emptyText="No matching customers found."
                loading={isSearching}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleCreateForm}
              >
                <UserPlus className="mr-2 size-4" />
                Create New Customer
              </Button>
              <span className="text-xs text-muted-foreground">
                Use this only when the customer cannot be matched confidently.
              </span>
            </div>

            {showCreateForm ? (
              <Form {...createForm}>
                <div className="grid gap-4 rounded-2xl border bg-background px-4 py-4 md:grid-cols-3">
                  <FormField
                    control={createForm.control}
                    name="display_name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Customer or company name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="9876543210" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="gst_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GST</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional GST number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={onCreateCustomer}
                      disabled={isCreatingCustomer}
                    >
                      {isCreatingCustomer ? "Creating..." : "Create Customer"}
                    </Button>
                  </div>
                </div>
              </Form>
            ) : null}

            {createCustomerError && probableMatches.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {createCustomerError}
              </div>
            ) : null}

            {probableMatches.length > 0 ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <div className="text-sm font-medium text-amber-900">
                  Possible existing customers found. Please verify before creating
                  a new customer.
                </div>
                <div className="grid gap-2">
                  {probableMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => onSelectCustomer(match)}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-3 text-left transition-colors hover:bg-amber-100"
                    >
                      <div className="font-medium text-foreground">
                        {match.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {match.company_name || "Direct customer"}
                        {match.phone_number ? ` · ${match.phone_number}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
