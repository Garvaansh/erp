import { RawMaterialDetailPage } from "@/features/inventory/components/raw-material-detail-page";

type RawMaterialDetailRouteProps = {
  params: Promise<{
    itemId: string;
  }>;
};

export default async function RawMaterialDetailRoute({
  params,
}: RawMaterialDetailRouteProps) {
  const { itemId } = await params;

  return <RawMaterialDetailPage itemId={itemId} />;
}
