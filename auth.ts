import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return null;

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          workspaceId: user.workspaceId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.workspaceId) token.workspaceId = user.workspaceId;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.workspaceId = typeof token.workspaceId === "string" ? token.workspaceId : "";
      }
      return session;
    },
  },
});
