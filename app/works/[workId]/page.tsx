import { DemoWorkDetail } from "@/components/version-prototype";
export default async function WorkPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  return <DemoWorkDetail key={workId} workId={workId} />;
}
