import { apiClient } from "@/lib/api/api-client";
import {
  createFinishedGoodInputSchema,
  createItemDefinitionInputSchema,
  finishedGoodDetailSchema,
  finishedGoodMasterRowSchema,
  itemDefinitionSchema,
  itemDefinitionsSchema,
  receiveStockPayloadSchema,
  selectableItemsSchema,
} from "@/features/inventory/schemas";
import type {
  ActiveBatch,
  CreateItemDefinitionInput,
  CreateFinishedGoodInput,
  FinishedGoodDetail,
  FinishedGoodMasterRow,
  ItemCategory,
  ItemDefinition,
  InventorySnapshot,
  InventoryViewRow,
  RawMaterialBatchRow,
  RawMaterialMasterRow,
  RawMaterialSummary,
  ReceiveStockPayload,
  ReceiveStockResult,
  SelectableItem,
  UpdateBatchStatusPayload,
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
type RawMaterialMasterResponse = { items: RawMaterialMasterRow[] };
type RawMaterialSummaryResponse = RawMaterialSummary;
type RawMaterialBatchesResponse = { batches: RawMaterialBatchRow[] };
type FinishedGoodsMasterResponse = { items: FinishedGoodMasterRow[] };
type FinishedGoodDetailResponse = FinishedGoodDetail;

type ActiveBatchType = "RAW" | "MOLDED" | "FINISHED";

const ITEMS_PAGE_LIMIT = 200;

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
  batchType?: ActiveBatchType,
): Promise<ActiveBatch[]> {
  const params = new URLSearchParams({ item_id: itemId });
  if (batchType) {
    params.set("type", batchType);
  }

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
    body: JSON.stringify(parsed),
  });

  return data ?? {};
}

export async function getRawMaterialMaster(): Promise<RawMaterialMasterRow[]> {
  const data = await apiClient<RawMaterialMasterResponse>(
    "/inventory/raw-materials",
    { method: "GET" },
  );

  return Array.isArray(data.items) ? data.items : [];
}

export async function getRawMaterialBatches(
  itemId: string,
): Promise<RawMaterialBatchRow[]> {
  const data = await apiClient<RawMaterialBatchesResponse>(
    `/inventory/raw-materials/${itemId.trim()}/batches`,
    { method: "GET" },
  );

  return Array.isArray(data.batches) ? data.batches : [];
}

export async function getRawMaterialSummary(
  itemId: string,
): Promise<RawMaterialSummary> {
  return apiClient<RawMaterialSummaryResponse>(
    `/inventory/raw-materials/${itemId.trim()}/summary`,
    { method: "GET" },
  );
}

export async function updateBatchStatus(
  batchId: string,
  payload: UpdateBatchStatusPayload,
): Promise<void> {
  await apiClient(`/inventory/batches/${batchId.trim()}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateItemThreshold(
  itemId: string,
  threshold: number,
): Promise<void> {
  await apiClient(`/items/${itemId.trim()}/threshold`, {
    method: "PATCH",
    body: JSON.stringify({ threshold }),
  });
}

export async function createFinishedGood(
  input: CreateFinishedGoodInput,
): Promise<ItemDefinition | null> {
  const parsedInput = createFinishedGoodInputSchema.parse(input);

  const data = await apiClient<CreateItemResponse>("/inventory/finished-goods", {
    method: "POST",
    body: JSON.stringify(parsedInput),
  });

  const parsedItem = itemDefinitionSchema.safeParse(data.item);
  return parsedItem.success ? parsedItem.data : null;
}

export async function getFinishedGoodsMaster(): Promise<FinishedGoodMasterRow[]> {
  const data = await apiClient<FinishedGoodsMasterResponse>(
    "/inventory/finished-goods",
    { method: "GET" },
  );

  const parsed = finishedGoodMasterRowSchema.array().safeParse(data.items);
  return parsed.success ? parsed.data : [];
}

export async function getFinishedGoodDetail(
  productId: string,
): Promise<FinishedGoodDetail | null> {
  const data = await apiClient<FinishedGoodDetailResponse>(
    `/inventory/finished-goods/${productId.trim()}`,
    { method: "GET" },
  );

  const parsed = finishedGoodDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
