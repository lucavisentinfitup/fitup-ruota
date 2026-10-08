import { headers } from "next/headers";
import { clubWheel, getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { eventText, isOpenToday } from "@/lib/event";
import { toPublicWheel } from "@/lib/defaults";
import ClubHome from "./ClubHome";
import clubsFile from "@/data/clubs.json";
import WheelList from "./WheelList";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getAdmin();
  if (user?.role === "club") {
    const wheel = await clubWheel(user);
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const tvs = wheel ? (await (await db()).listTvs()).filter((t) => t.wheelId === wheel.id).map((t) => ({ id: t.id, name: t.name, code: t.code })) : [];
    return (
      <>
        <div className="page-head">
          <div>
            <h1>FitUP {user.clubName}</h1>
            <p>La ruota del tuo club e i link da usare. La ruota la gestisce la sede: qui non si modifica.</p>
          </div>
        </div>
        {wheel ? (
          <ClubHome wheel={toPublicWheel(wheel)} active={wheel.active} eventLabel={eventText(wheel.event) || null} openToday={isOpenToday(wheel.event)} origin={origin}
            shortHost={process.env.TV_SHORT_HOST || "fitup-tv.vercel.app"} tvs={tvs} />
        ) : (
          <div className="alert">Non c&apos;è ancora una ruota per il tuo club: contatta la sede.</div>
        )}
      </>
    );
  }
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
