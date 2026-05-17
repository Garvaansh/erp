import { OrderDetailPage } from "@/features/orders/components/order-detail-page";

type OrderDetailRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailRoute({
  params,
}: OrderDetailRouteProps) {
  const { id } = await params;

  return <OrderDetailPage orderId={id} />;
}
