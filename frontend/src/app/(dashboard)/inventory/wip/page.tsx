import { getCurrentUser } from "@/features/auth/api";
import { WIPProductionPage } from "@/features/wip/components/wip-production-page";

export const dynamic = "force-dynamic";

export default async function InventoryWIPPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.is_admin === true;

  return <WIPProductionPage isAdmin={isAdmin} />;
}
