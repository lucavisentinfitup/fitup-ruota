import { db } from "@/lib/db";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export default async function Report({ searchParams }: { searchParams: Promise<{ wheelId?: string }> }) {
  const { wheelId } = await searchParams;
  const wheels = (await (await db()).listWheels()).map((w) => ({ id: w.id, name: w.name })).sort((a, b) => a.name.localeCompare(b.name, "it"));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Report vincite</h1>
          <p>Chi ha vinto cosa e in quale giornata. Segna i premi consegnati e scarica i dati in Excel.</p>
        </div>
      </div>
      <ReportClient wheels={wheels} initialWheelId={wheels.some((w) => w.id === wheelId) ? wheelId! : ""} />
    </>
  );
}
