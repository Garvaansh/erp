export type DailyLogPayload = {
  source_batch_id: string;
  output_item_name: string;
  output_item_specs: {
    thickness: number;
    width: number;
    grade: string;
    coil_weight: number;
  };
  input_qty: number;
  finished_qty: number;
  scrap_qty: number;
};

export type DailyLogResult = {
  success: boolean;
  journal_id: string;
};

export type DailyLogActionState = {
  ok: boolean;
  message: string;
};
