import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function isDatabaseConnectionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") ||
    (error instanceof Error &&
      (error.message.includes("Can't reach database server") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("Connection refused")))
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
            include: {
              studentProfile: true,
              teacherProfile: true,
            },
          });
        } catch (error) {
          if (isDatabaseConnectionError(error)) {
            throw new Error("database_unavailable");
          }
          throw error;
        }

        if (!user) return null;
        if (!user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        const displayName =
          user.studentProfile?.displayName ??
          user.teacherProfile?.displayName ??
          user.email;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: displayName,
          studentProfileId: user.studentProfile?.id ?? null,
          teacherProfileId: user.teacherProfile?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role as UserRole;
        token.studentProfileId = user.studentProfileId as string | null;
        token.teacherProfileId = user.teacherProfileId as string | null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.studentProfileId = (token.studentProfileId as string) ?? null;
        session.user.teacherProfileId = (token.teacherProfileId as string) ?? null;
      }
      return session;
    },
  },
};

export function isTeacherRole(role: UserRole) {
  return role === UserRole.TEACHER || role === UserRole.ADMIN;
}

export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN;
}
