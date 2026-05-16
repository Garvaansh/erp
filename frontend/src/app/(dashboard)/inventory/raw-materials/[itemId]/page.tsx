import { RawMaterialDetailPage } from "@/app/(dashboard)/inventory/raw-materials/components/raw-material-detail-page";

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
