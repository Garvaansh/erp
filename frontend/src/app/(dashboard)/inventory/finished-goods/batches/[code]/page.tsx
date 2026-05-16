import { FinishedBundleDetailPage } from "@/app/(dashboard)/inventory/finished-goods/components/finished-bundle-detail-page";

type FinishedBundleDetailRouteProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function FinishedBundleDetailRoute({
  params,
}: FinishedBundleDetailRouteProps) {
  const { code } = await params;

  return <FinishedBundleDetailPage batchCode={decodeURIComponent(code)} />;
}
