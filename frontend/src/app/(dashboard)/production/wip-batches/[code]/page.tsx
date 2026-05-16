import { redirect } from "next/navigation";

type LegacyWipBatchDetailRouteProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function LegacyWipBatchDetailRoute({
  params,
}: LegacyWipBatchDetailRouteProps) {
  const { code } = await params;

  redirect(`/production/wip/batches/${encodeURIComponent(code)}`);
}
