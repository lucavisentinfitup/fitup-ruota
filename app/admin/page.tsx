import { db } from "@/lib/db";
import clubsFile from "@/data/clubs.json";
import WheelList from "./WheelList";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const wheels = await (await db()).listWheels();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Le ruote</h1>
          <p>Una ruota per ogni club FitUP, tutte nate dalla ruota modello. Ogni ruota ha il suo link e il suo report.</p>
        </div>
      </div>
      <WheelList wheels={wheels} clubCount={clubsFile.clubs.length} />
    </>
  );
}
