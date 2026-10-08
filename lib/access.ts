// Chi può entrare nel backend e cosa vede.
// - Amministratori: accesso completo (ruote, report, schermi TV).
// - Account di un club (email del club su CORE, es. seregno@fitup.it): solo la propria ruota,
//   i link da usare e lo storico giocate con la consegna dei premi. Niente modifiche né statistiche.
import clubsFile from "@/data/clubs.json";

export const GLOBAL_ADMINS = [
  "luca.visentin@fitup.it",
  "matteo.mosconi@fitup.it",
  "davide.trevisan@fitup.it",
  "alessandro.genova@fitup.it",
  "nicole.crea@fitup.it",
];

export type Access = { role: "global" } | { role: "club"; clubId: string; clubName: string };

const CLUBS = (clubsFile as { clubs: { coreId: string; name: string; email?: string | null }[] }).clubs;

export function accessFor(email: string | null | undefined): Access | null {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  if (GLOBAL_ADMINS.includes(e)) return { role: "global" };
  const club = CLUBS.find((c) => c.email?.toLowerCase() === e);
  return club ? { role: "club", clubId: club.coreId, clubName: club.name } : null;
}
