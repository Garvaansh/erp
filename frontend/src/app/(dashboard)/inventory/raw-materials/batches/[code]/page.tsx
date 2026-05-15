import { RawMaterialBatchDetailPage } from "@/app/(dashboard)/inventory/raw-materials/components/raw-material-batch-detail-page";

type RawMaterialBatchDetailRouteProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function RawMaterialBatchDetailRoute({
  params,
}: RawMaterialBatchDetailRouteProps) {
  const { code } = await params;

  return <RawMaterialBatchDetailPage batchCode={decodeURIComponent(code)} />;
}
