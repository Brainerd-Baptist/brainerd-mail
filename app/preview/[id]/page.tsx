import { notFound } from "next/navigation";
import LivePreview from "@/components/LivePreview";

export const metadata = { title: "Live preview | Brainerd Mail" };
const UUID = /^[0-9a-f-]{36}$/i;

export default function PreviewPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  return <LivePreview emailId={params.id} />;
}
