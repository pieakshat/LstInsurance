import { ProtocolDetailClient } from "./protocol-detail-client";

export default async function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProtocolDetailClient protocolId={id} />;
}
