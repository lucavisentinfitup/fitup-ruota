import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import WheelEditor from "./WheelEditor";

export const dynamic = "force-dynamic";

export default async function EditWheel({ params }: { params: Promise<{ id: string }> }) {
  const store = await db();
  const id = (await params).id;
  const wheel = await store.getWheel(id);
  if (!wheel) notFound();
  const wins = await store.countWinsBySegment(id);
  return <WheelEditor initial={wheel} wins={wins} />;
}
