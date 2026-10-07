import { db } from "@/lib/db";
import TvClient from "./TvClient";

export const dynamic = "force-dynamic";

export default async function TvPage() {
  const wheels = (await (await db()).listWheels()).map((w) => ({ id: w.id, name: w.name }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schermi TV</h1>
          <p>
            Ogni TV dei club apre il proprio link una volta sola. I clienti inquadrano il QR sulla TV e vedono il loro giro anche lì, in 16:9.
          </p>
        </div>
      </div>
      <TvClient wheels={wheels} />
    </>
  );
}
