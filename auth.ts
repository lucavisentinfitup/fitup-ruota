import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || "fitup.it").toLowerCase();

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      // `hd` mostra a Google solo gli account del dominio; il controllo vero è in signIn().
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile) return false;
      const hd = (profile as { hd?: string }).hd?.toLowerCase();
      return profile.email_verified === true && isAllowedEmail(profile.email) && hd === ALLOWED_DOMAIN;
    },
  },
});
