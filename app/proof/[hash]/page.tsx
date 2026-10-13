import ProofCertificate from "@/components/proof-certificate";

export default async function CertificatePage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  return <ProofCertificate key={hash.toLowerCase()} hash={hash} />;
}
