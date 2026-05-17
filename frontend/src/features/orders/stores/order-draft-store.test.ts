import { describe, expect, it, beforeEach } from "vitest";
import {
  createDraftOrderLine,
  useOrderDraftStore,
} from "@/features/orders/stores/order-draft-store";

describe("order draft store", () => {
  beforeEach(() => {
    useOrderDraftStore.getState().reset();
  });

  it("persists draft edits and hydration state", () => {
    const line = createDraftOrderLine();
    const store = useOrderDraftStore.getState();

    store.setCustomerQuery("Acme");
    store.setNotes("Urgent dispatch");
    store.setLines([
      {
        ...line,
        finished_good_item_id: "item-1",
        ordered_qty: 12,
        unit_price: 130,
      },
    ]);
    store.markSaved();

    const snapshot = useOrderDraftStore.getState();
    expect(snapshot.customer_query).toBe("Acme");
    expect(snapshot.notes).toBe("Urgent dispatch");
    expect(snapshot.lines[0]?.ordered_qty).toBe(12);
    expect(snapshot.last_saved_at).toBeTruthy();

    store.hydrate({
      notes: "Revised notes",
    });

    expect(useOrderDraftStore.getState().notes).toBe("Revised notes");
  });

  it("resets back to a clean draft document", () => {
    const store = useOrderDraftStore.getState();
    store.setCustomerQuery("Customer");
    store.setNotes("Notes");
    store.reset();

    const snapshot = useOrderDraftStore.getState();
    expect(snapshot.customer_query).toBe("");
    expect(snapshot.notes).toBe("");
    expect(snapshot.selected_customer).toBeNull();
    expect(snapshot.lines).toHaveLength(1);
  });
});
