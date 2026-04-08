import { apiClient } from "@/lib/api-client";
import {
  createItemDefinitionInputSchema,
  itemDefinitionSchema,
  itemDefinitionsSchema,
  receiveStockPayloadSchema,
  selectableItemsSchema,
} from "@/features/inventory/schemas";
import type {
  ActiveBatch,
  CreateItemDefinitionInput,
  ItemCategory,
  ItemDefinition,
  InventorySnapshot,
  InventoryViewRow,
  ReceiveStockPayload,
  ReceiveStockResult,
  SelectableItem,
} from "@/features/inventory/types";

type InventoryViewResponse = {
  RAW: InventoryViewRow[];
  SEMI_FINISHED: InventoryViewRow[];
  FINISHED: InventoryViewRow[];
  SCRAP: InventoryViewRow[];
};

type ActiveBatchesResponse = { batches: ActiveBatch[] };
type ListItemsResponse = { items: ItemDefinition[] };
type CreateItemResponse = { item: ItemDefinition | null };
type SelectableItemsResponse = {
  items: SelectableItem[];
};

const ITEMS_PAGE_LIMIT = 200;

/**
 * Fetches the full inventory snapshot in a single round-trip via the
 * /api/inventory/view BFF endpoint. This replaces the previous 4-way
 * fan-out that hit /api/items?category=X four times.
 */
export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const data = await apiClient<InventoryViewResponse>("/inventory/view", {
    method: "GET",
  });

  return {
    RAW: Array.isArray(data.RAW) ? data.RAW : [],
    SEMI_FINISHED: Array.isArray(data.SEMI_FINISHED) ? data.SEMI_FINISHED : [],
    FINISHED: Array.isArray(data.FINISHED) ? data.FINISHED : [],
    SCRAP: Array.isArray(data.SCRAP) ? data.SCRAP : [],
  };
}

export async function listActiveBatches(
  itemId: string,
): Promise<ActiveBatch[]> {
  const params = new URLSearchParams({ productId: itemId });
  const data = await apiClient<ActiveBatchesResponse>(
    `/inventory/batches?${params.toString()}`,
    { method: "GET" },
  );

  return Array.isArray(data.batches) ? data.batches : [];
}

async function getItemsPage(
  category: ItemCategory,
  offset: number,
): Promise<ItemDefinition[]> {
  const params = new URLSearchParams({
    category,
    limit: String(ITEMS_PAGE_LIMIT),
    offset: String(offset),
  });

  const data = await apiClient<ListItemsResponse>(
    `/items?${params.toString()}`,
    {
      method: "GET",
    },
  );

  const parsed = itemDefinitionsSchema.safeParse(data.items);
  return parsed.success ? parsed.data : [];
}

export async function getRawItemDefinitions(): Promise<ItemDefinition[]> {
  const rows: ItemDefinition[] = [];
  let offset = 0;

  while (true) {
    const page = await getItemsPage("RAW", offset);
    rows.push(...page);

    if (page.length < ITEMS_PAGE_LIMIT) {
      break;
    }

    offset += ITEMS_PAGE_LIMIT;
  }

  return rows;
}

export async function getRawItemById(
  itemId: string,
): Promise<ItemDefinition | null> {
  const normalizedId = itemId.trim();
  if (!normalizedId) {
    return null;
  }

  const rawItems = await getRawItemDefinitions();
  const found = rawItems.find((item) => item.id === normalizedId);
  if (!found) {
    return null;
  }

  const parsed = itemDefinitionSchema.safeParse(found);
  return parsed.success ? parsed.data : null;
}

export async function getSelectableRawItems(): Promise<SelectableItem[]> {
  const data = await apiClient<SelectableItemsResponse>("/items/selectable", {
    method: "GET",
  });

  const parsed = selectableItemsSchema.safeParse(data.items);
  if (!parsed.success) {
    return [];
  }

  return parsed.data.filter((item) => item.category === "RAW");
}

export async function createItemDefinition(
  input: CreateItemDefinitionInput,
): Promise<ItemDefinition | null> {
  const parsedInput = createItemDefinitionInputSchema.parse(input);

  const data = await apiClient<CreateItemResponse>("/items", {
    method: "POST",
    body: JSON.stringify(parsedInput),
  });

  const parsedItem = itemDefinitionSchema.safeParse(data.item);
  return parsedItem.success ? parsedItem.data : null;
}

export async function receiveStock(
  payload: ReceiveStockPayload,
): Promise<ReceiveStockResult> {
  const parsed = receiveStockPayloadSchema.parse(payload);

  const data = await apiClient<ReceiveStockResult>("/inventory/receive", {
    method: "POST",
    body: JSON.stringify({
      ...parsed,
      idempotency_key: crypto.randomUUID(),
    }),
  });

  return data ?? {};
}
