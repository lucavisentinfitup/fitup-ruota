import { GamePage } from "@/components/GamePage";
import { getDefaultWheel } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <GamePage wheel={await getDefaultWheel()} />;
}
