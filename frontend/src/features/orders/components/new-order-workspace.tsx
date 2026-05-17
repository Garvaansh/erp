"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api/api-client";
import { useDebounce } from "@/hooks/useDebounce";
import { useFinishedGoodsMaster } from "@/features/inventory/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OrderCustomerSection } from "@/features/orders/components/order-customer-section";
import { OrderLinesEditor } from "@/features/orders/components/order-lines-editor";
import { OrderSummaryCard } from "@/features/orders/components/order-summary-card";
import {
  draftCustomerSchema,
  orderDraftFormSchema,
  type DraftCustomerValues,
  type OrderDraftFormValues,
} from "@/features/orders/schemas/order-schema";
import {
  useCreateCustomer,
  useCreateOrder,
} from "@/features/orders/hooks/use-order-mutations";
import { useCustomerSearch } from "@/features/orders/hooks/use-orders";
import {
  createDraftOrderLine,
  useOrderDraftStore,
} from "@/features/orders/stores/order-draft-store";
import {
  getCustomerErrorMessage,
  getOrderErrorMessage,
} from "@/features/orders/utils/errors";
import { calculateOrderSummary } from "@/features/orders/utils/summary";
import type {
  CustomerRecord,
  CustomerSearchResult,
  CustomerCreateResponse,
} from "@/features/orders/types";

function customerToSearchResult(customer: CustomerRecord): CustomerSearchResult {
  return {
    id: customer.id,
    display_name: customer.display_name,
    company_name: customer.company_name,
    phone_number: customer.phone_number,
    match_source: "customer",
    matched_value: customer.phone_number || customer.gst_number || customer.display_name,
    confidence: {
      score: 1,
      level: "high",
      reason: "Selected customer",
    },
  };
}

export function NewOrderWorkspace() {
  const router = useRouter();
  const draftStore = useOrderDraftStore();
  const finishedGoodsQuery = useFinishedGoodsMaster();
  const createOrderMutation = useCreateOrder();
  const createCustomerMutation = useCreateCustomer();

  const [showCreateCustomerForm, setShowCreateCustomerForm] = useState(
    !draftStore.selected_customer,
  );
  const [customerCreateError, setCustomerCreateError] = useState("");
  const [probableMatches, setProbableMatches] = useState<CustomerSearchResult[]>([]);

  const debouncedCustomerQuery = useDebounce(draftStore.customer_query, 300);
  const customerSearchQuery = useCustomerSearch(debouncedCustomerQuery);

  const orderForm = useForm<OrderDraftFormValues>({
    resolver: zodResolver(orderDraftFormSchema),
    defaultValues: {
      notes: draftStore.notes,
      lines:
        draftStore.lines.length > 0 ? draftStore.lines : [createDraftOrderLine()],
    },
    mode: "onChange",
  });

  const createCustomerForm = useForm<DraftCustomerValues>({
    resolver: zodResolver(draftCustomerSchema),
    defaultValues: draftStore.draft_customer,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "lines",
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = orderForm.watch((value) => {
      draftStore.hydrate({
        notes: value.notes ?? "",
        lines:
          value.lines?.map((line) => ({
            key: line.key ?? crypto.randomUUID(),
            finished_good_item_id: line.finished_good_item_id ?? "",
            ordered_qty: Number(line.ordered_qty) || 0,
            unit_price: Number(line.unit_price) || 0,
          })) ?? [],
      });
    });

    return () => subscription.unsubscribe();
  }, [draftStore, orderForm]);

  useEffect(() => {
    const subscription = createCustomerForm.watch((value) => {
      draftStore.setDraftCustomer({
        display_name: value.display_name ?? "",
        phone_number: value.phone_number ?? "",
        gst_number: value.gst_number ?? "",
      });
    });

    return () => subscription.unsubscribe();
  }, [createCustomerForm, draftStore]);

  const lines = orderForm.watch("lines");
  const summary = calculateOrderSummary(
    lines.map((line) => ({
      key: line.key,
      finished_good_item_id: line.finished_good_item_id,
      ordered_qty: Number(line.ordered_qty) || 0,
      unit_price: Number(line.unit_price) || 0,
    }))
  );

  const customerOptions = useMemo(() => {
    return (customerSearchQuery.data?.items ?? []).map((customer) => ({
      value: customer.id,
      label: customer.display_name,
      description: [customer.company_name, customer.phone_number]
        .filter(Boolean)
        .join(" · "),
      meta: customer.match_source,
    }));
  }, [customerSearchQuery.data?.items]);

  function handleSelectCustomer(customer: CustomerSearchResult) {
    draftStore.setSelectedCustomer(customer);
    draftStore.setCustomerQuery(customer.display_name);
    setShowCreateCustomerForm(false);
    setCustomerCreateError("");
    setProbableMatches([]);
  }

  async function handleCreateCustomer() {
    setCustomerCreateError("");
    setProbableMatches([]);

    const valid = await createCustomerForm.trigger();
    if (!valid) {
      return;
    }

    const values = createCustomerForm.getValues();

    try {
      const response = await createCustomerMutation.mutateAsync(values);
      const resolvedCustomer = response.customer
        ? customerToSearchResult(response.customer)
        : null;

      if (resolvedCustomer) {
        handleSelectCustomer(resolvedCustomer);
        toast.success(
          response.resolution === "exact_existing_customer"
            ? "Existing customer selected."
            : "Customer created.",
        );
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 409) {
        const payload = error.data as CustomerCreateResponse | undefined;
        setProbableMatches(payload?.matches ?? []);
      }

      setCustomerCreateError(getCustomerErrorMessage(error));
    }
  }

  function handleSaveDraft() {
    draftStore.markSaved();
    toast.success("Draft saved locally for this session.");
  }

  async function handleConfirmReserve(values: OrderDraftFormValues) {
    if (!draftStore.selected_customer) {
      toast.error("Select or create a customer before confirming the order.");
      return;
    }

    const products = finishedGoodsQuery.data ?? [];
    let hasAvailabilityError = false;

    values.lines.forEach((line, index) => {
      const product = products.find(
        (item) => item.item_id === line.finished_good_item_id,
      );

      if (product && line.ordered_qty > product.available_qty) {
        orderForm.setError(`lines.${index}.ordered_qty`, {
          type: "manual",
          message: `Only ${product.available_qty.toFixed(2)} kg available`,
        });
        hasAvailabilityError = true;
      }
    });

    if (hasAvailabilityError) {
      return;
    }

    try {
      const response = await createOrderMutation.mutateAsync({
        customer_id: draftStore.selected_customer.id,
        notes: values.notes,
        lines: values.lines.map((line) => ({
          finished_good_item_id: line.finished_good_item_id,
          ordered_qty: line.ordered_qty,
          unit_price: line.unit_price,
        })),
      });

      const orderId = response.order?.id;
      draftStore.reset();
      createCustomerForm.reset({
        display_name: "",
        phone_number: "",
        gst_number: "",
      });
      orderForm.reset({
        notes: "",
        lines: [createDraftOrderLine()],
      });

      toast.success("Order confirmed and reserved.");
      if (orderId) {
        router.push(`/orders/${orderId}`);
      }
    } catch (error) {
      toast.error(
        getOrderErrorMessage(
          error,
          "Unable to confirm and reserve this order right now.",
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[24px] border bg-background px-6 py-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            New Order
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Draft operational sales order
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Build the document in one workspace. Drafts are kept locally in this
            session until the backend reservation step is confirmed.
          </p>
        </div>
      </header>

      <OrderCustomerSection
        selectedCustomer={draftStore.selected_customer}
        searchQuery={draftStore.customer_query}
        onSearchQueryChange={draftStore.setCustomerQuery}
        searchOptions={customerOptions}
        searchResults={customerSearchQuery.data?.items ?? []}
        onSelectCustomer={handleSelectCustomer}
        isSearching={customerSearchQuery.isFetching}
        createForm={createCustomerForm}
        showCreateForm={showCreateCustomerForm}
        onToggleCreateForm={() => {
          if (draftStore.selected_customer) {
            draftStore.setSelectedCustomer(null);
            draftStore.setCustomerQuery("");
          }
          setShowCreateCustomerForm((current) => !current);
        }}
        onCreateCustomer={handleCreateCustomer}
        isCreatingCustomer={createCustomerMutation.isPending}
        createCustomerError={customerCreateError}
        probableMatches={probableMatches}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <OrderLinesEditor
            form={orderForm}
            fields={fields}
            append={append}
            remove={remove}
            products={finishedGoodsQuery.data ?? []}
          />

          <div className="rounded-[24px] border bg-background px-4 py-4 md:px-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Notes</div>
              <Textarea
                rows={4}
                placeholder="Commercial or dispatch instructions"
                {...orderForm.register("notes")}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <OrderSummaryCard summary={summary} />

          <div className="rounded-[24px] border bg-background px-4 py-4">
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={orderForm.handleSubmit(handleConfirmReserve)}
                disabled={
                  createOrderMutation.isPending || finishedGoodsQuery.isLoading
                }
              >
                {createOrderMutation.isPending
                  ? "Confirming..."
                  : "Confirm & Reserve"}
              </Button>
              {draftStore.last_saved_at ? (
                <p className="text-xs text-muted-foreground">
                  Last saved locally at{" "}
                  {new Date(draftStore.last_saved_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
