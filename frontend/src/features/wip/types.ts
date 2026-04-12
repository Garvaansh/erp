export type WIPStage = "molding" | "polishing";

export type WIPItemCategory = "RAW" | "SEMI_FINISHED";

export type WIPSelectableItem = {
  item_id: string;
  label: string;
  category: WIPItemCategory;
};

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

export type PolishingPayload = {
  source_batch_id: string;
  molded_input: string;
  finished_output: string;
  polishing_scrap_qty: string;
  polishing_shortlength_qty: string;
  final_adjustment_qty: string;
  note?: string;
};

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
