import { FinishedGoodDetailPage } from "@/features/inventory/components/finished-good-detail-page";

type FinishedGoodDetailRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function FinishedGoodDetailRoute({
  params,
}: FinishedGoodDetailRouteProps) {
  const { productId } = await params;

  return <FinishedGoodDetailPage productId={productId} />;
}
