export type DashboardSummary = {
  total_raw_material_weight: number;
  total_finished_pipes_weight: number;
  recent_activity: Array<{
    journal_id: string;
    created_at: string;
    worker_name: string;
    source_batch: string;
    input_qty: number;
    finished_qty: number;
    scrap_qty: number;
  }>;
};
