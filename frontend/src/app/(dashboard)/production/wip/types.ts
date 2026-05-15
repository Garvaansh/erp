// ─── Production Run (ledger row) ────────────────────────────────────────────

export type WIPRunWorkstation = "MOLDING" | "POLISHING" | "UNKNOWN";
export type WIPRunStatus = "COMPLETED" | "FAILED";

/** A single row in the WIP production ledger. */
export type WIPProductionRun = {
  run_id: string;
  run_sequence: number;
  output_batch_code: string;
  workstation: WIPRunWorkstation;
  input_qty: number;
  output_qty: number;
  scrap_qty: number;
  shortlength_qty: number;
  process_loss_qty: number;
  batches_consumed: number;
  status: WIPRunStatus;
  created_at: string;
  // Operator + item info joined on the backend — never raw UUIDs
  operator_name?: string;
  item_name?: string;
  item_sku?: string;
  run_type?: string;
};

// ─── Finished Good item (for product selector dropdown) ──────────────────────

/** A finished good item shown in the product selector. */
export type WIPFinishedGoodOption = {
  id: string;               // internal UUID — used for API calls only
  sku: string;              // e.g. "CUR-32MM"
  name: string;             // e.g. "Curtain Rod 32mm"
  linked_raw_material_id?: string; // resolved recipe linkage (from backend)
};

// ─── Allocatable stock (inventory context card) ───────────────────────────────

export type AllocatableStock = {
  item_id: string;
  batch_type: "RAW" | "MOLDED" | "FINISHED";
  available_qty: number;
  batch_count: number;
};

// ─── Command payloads (sent to BFF → backend) ────────────────────────────────

/** Payload sent to POST /api/wip/molding */
export type MoldingRunPayload = {
  output_item_id: string;
  input_qty: number;
  output_qty: number;
  scrap_qty: number;
  shortlength_qty: number;
  notes?: string;
};

/** Payload sent to POST /api/wip/polishing */
export type PolishingRunPayload = {
  output_item_id: string;
  input_qty: number;
  output_qty: number;
  scrap_qty: number;
  shortlength_qty: number;
  notes?: string;
};

/** Minimal response after a successful production run */
export type WIPRunResult = {
  run_id: string;
  output_batch_code: string;
  batches_consumed: number;
  status: string;
};

// Backward-compat aliases for older WIP API consumers.
// These are kept so existing components compile while the migration is in flight.
// DO NOT use these in new code.

/** @deprecated Use WIPFinishedGoodOption instead */
export type WIPSelectableItem = {
  item_id: string;
  label: string;
  category: "RAW" | "SEMI_FINISHED";
};

/** @deprecated Batch selection is now handled server-side via FIFO */
export type WIPLotOption = {
  id: string;
  batch_id: string;
  batch_code: string;
  sku: string;
  remaining_qty: number;
  arrival_date: string;
  initial_weight: number;
  remaining_weight: number;
  status: string;
};

/** @deprecated Use WIPProductionRun instead */
export type WIPActivityEntry = {
  journal_id: string;
  created_at: string;
  batch_code: string;
  item_sku: string;
  item_name: string;
  workstation: "MOLDING" | "POLISHING" | "UNKNOWN";
  input_qty: string;
  output_qty: string;
  scrap_qty: string;
  short_qty: string;
  difference: string;
  status: "BALANCED" | "TOLERANCE" | "FLAGGED";
  approval_state: "FINAL" | "PENDING_APPROVAL" | "REJECTED";
  operator_name: string;
};

/** @deprecated Not used in the new WIP architecture */
export type WIPSubmissionResult = {
  success: boolean;
  journal_id: string;
  movement_group_id: string;
  status: string;
  requires_approval: boolean;
  difference: string;
  tolerance: string;
  output_batch_id?: string;
};

/** @deprecated Not used in the new WIP architecture */
export type MoldingPayload = {
  source_batch_id: string;
  input_weight: string;
  molded_output: string;
  scrap_qty: string;
  shortlength_qty: string;
  process_loss_qty: string;
  diameter: string;
  note?: string;
};

/** @deprecated Not used in the new WIP architecture */
export type PolishingPayload = {
  source_batch_id: string;
  molded_input: string;
  finished_output: string;
  polishing_scrap_qty: string;
  polishing_shortlength_qty: string;
  final_adjustment_qty: string;
  note?: string;
};

/** @deprecated Not used in the new WIP architecture */
export type PendingWIPApproval = {
  journal_id: string;
  movement_group_id: string;
  source_batch_id: string;
  source_batch_code: string;
  source_batch_type: string;
  input_weight: string;
  expected_total: string;
  difference: string;
  tolerance: string;
  note: string;
  created_at: string;
  created_by: string;
};

/** @deprecated */
export type WIPStage = "molding" | "polishing";
/** @deprecated */
export type WIPItemCategory = "RAW" | "SEMI_FINISHED";
