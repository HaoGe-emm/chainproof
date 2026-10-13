import LocalVersionHistory from "@/components/local-version-history";
export default async function LocalWorkPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  return <LocalVersionHistory key={workId} mode="detail" workId={workId} />;
}
