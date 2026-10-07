import type { Metadata } from "next";
import { GamePage } from "@/components/GamePage";
import { getWheelBySlugCached } from "@/lib/db";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = await getWheelBySlugCached((await params).slug);
  return { title: w ? `${w.name} – FitUP` : "Ruota della fortuna FitUP" };
}

export default async function Play({ params }: Props) {
  return <GamePage wheel={await getWheelBySlugCached((await params).slug)} />;
}
