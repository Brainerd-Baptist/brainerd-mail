import { redirect } from "next/navigation";
import Builder from "@/components/Builder";

export default function EditorPage({ searchParams }: { searchParams: { e?: string } }) {
  if (!searchParams.e) redirect("/emails");
  return <Builder key={searchParams.e ?? "new"} emailId={searchParams.e} />;
}
