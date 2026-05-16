import { FinishedGoodDetailPage } from "@/app/(dashboard)/inventory/finished-goods/components/finished-good-detail-page";

type FinishedGoodDetailRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FinishedGoodDetailRoute({
  params,
}: FinishedGoodDetailRouteProps) {
  const { id } = await params;

  return <FinishedGoodDetailPage itemId={id} />;
}
