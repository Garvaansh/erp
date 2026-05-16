import { WipBatchDetailPage } from "@/app/(dashboard)/production/wip/components/wip-batch-detail-page";

type WipBatchDetailRouteProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function WipBatchDetailRoute({
  params,
}: WipBatchDetailRouteProps) {
  const { code } = await params;

  return <WipBatchDetailPage batchCode={decodeURIComponent(code)} />;
}
