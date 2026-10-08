"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Ruote", match: (p: string) => p === "/admin" || p.startsWith("/admin/ruote") },
  { href: "/admin/report", label: "Report vincite", match: (p: string) => p.startsWith("/admin/report") },
  { href: "/admin/tv", label: "Schermi TV", match: (p: string) => p.startsWith("/admin/tv") },
];

// account di un club: solo la propria ruota e lo storico giocate
const CLUB_LINKS = [
  { href: "/admin", label: "La mia ruota", match: (p: string) => p === "/admin" },
  { href: "/admin/report", label: "Giocate e premi", match: (p: string) => p.startsWith("/admin/report") },
];

export default function AdminNavLinks({ club = false }: { club?: boolean }) {
  const path = usePathname();
  return (
    <nav>
      {(club ? CLUB_LINKS : LINKS).map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "is-active" : ""}>{l.label}</Link>
      ))}
    </nav>
  );
}
