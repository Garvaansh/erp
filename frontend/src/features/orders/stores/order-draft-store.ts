import { create } from "zustand";
import type {
  CustomerSearchResult,
  DraftCustomerInput,
  DraftLineInput,
  OrderDraftState,
} from "@/features/orders/types";

function createEmptyLine(): DraftLineInput {
  return {
    key: crypto.randomUUID(),
    finished_good_item_id: "",
    ordered_qty: 0,
    unit_price: 0,
  };
}

function createEmptyCustomer(): DraftCustomerInput {
  return {
    display_name: "",
    phone_number: "",
    gst_number: "",
  };
}

type OrderDraftStore = OrderDraftState & {
  setCustomerQuery: (query: string) => void;
  setSelectedCustomer: (customer: CustomerSearchResult | null) => void;
  setDraftCustomer: (customer: DraftCustomerInput) => void;
  setNotes: (notes: string) => void;
  setLines: (lines: DraftLineInput[]) => void;
  markSaved: () => void;
  hydrate: (draft: Partial<OrderDraftState>) => void;
  reset: () => void;
};

export const useOrderDraftStore = create<OrderDraftStore>((set) => ({
  customer_query: "",
  selected_customer: null,
  draft_customer: createEmptyCustomer(),
  notes: "",
  lines: [createEmptyLine()],
  last_saved_at: null,
  setCustomerQuery: (customer_query) => set({ customer_query }),
  setSelectedCustomer: (selected_customer) => set({ selected_customer }),
  setDraftCustomer: (draft_customer) => set({ draft_customer }),
  setNotes: (notes) => set({ notes }),
  setLines: (lines) => set({ lines: lines.length > 0 ? lines : [createEmptyLine()] }),
  markSaved: () => set({ last_saved_at: new Date().toISOString() }),
  hydrate: (draft) =>
    set((state) => ({
      ...state,
      ...draft,
      lines:
        draft.lines && draft.lines.length > 0 ? draft.lines : state.lines,
      draft_customer: draft.draft_customer ?? state.draft_customer,
    })),
  reset: () =>
    set({
      customer_query: "",
      selected_customer: null,
      draft_customer: createEmptyCustomer(),
      notes: "",
      lines: [createEmptyLine()],
      last_saved_at: null,
    }),
}));

export function createDraftOrderLine() {
  return createEmptyLine();
}
