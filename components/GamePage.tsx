import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { toPublicWheel } from "@/lib/defaults";
import { romeDay, romeMidnight } from "@/lib/time";
import type { Wheel } from "@/lib/types";
import Game from "./Game";
import { closedMessage, isOpenToday } from "@/lib/event";
import { getAdmin } from "@/lib/admin";

export async function GamePage({ wheel }: { wheel: Wheel | null }) {
  if (!wheel || !wheel.active) {
    return (
      <main className="center-page">
        <div className="card">
          <img src="/brand/fitup-logo.png" alt="FitUP" style={{ height: 40 }} />
          <h1>Ruota non disponibile</h1>
          <p>Questa ruota al momento non è attiva. Riprova più tardi!</p>
        </div>
      </main>
    );
  }
  let remaining: number | null = null;
  const limit = wheel.settings.limitPerDevicePerDay;
  if (limit > 0) {
    const device = (await cookies()).get("fu_dev")?.value;
    const used = device ? await (await db()).countDeviceSpinsSince(wheel.id, device, romeMidnight(romeDay(new Date())).toISOString()) : 0;
    remaining = Math.max(0, limit - used);
  }
  const open = isOpenToday(wheel.event);
  // fuori calendario: lo staff collegato al backend può provare (giocate non registrate)
  const test = !open && !!(await getAdmin());
  return <Game wheel={toPublicWheel(wheel)} remaining={remaining} closed={open || test ? null : closedMessage(wheel.event!)} test={test} />;
}
