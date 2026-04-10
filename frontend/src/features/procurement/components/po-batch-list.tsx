import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProcurementBatch } from "@/features/procurement/types";

type POBatchListProps = {
  batches: ProcurementBatch[];
};

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function POBatchList({ batches }: POBatchListProps) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-base">Physical Receipts (LOTs)</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-600">No stock received yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Code</TableHead>
                <TableHead className="text-right">Initial Qty (kg)</TableHead>
                <TableHead className="text-right">Remaining Qty (kg)</TableHead>
                <TableHead>Received On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.batch_id}>
                  <TableCell className="font-medium text-slate-900">
                    {batch.batch_code}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {quantityFormatter.format(batch.initial_qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {quantityFormatter.format(batch.remaining_qty)}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {batch.received_at
                      ? new Date(batch.received_at).toLocaleString("en-IN")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
