import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: UserRole;
      studentProfileId: string | null;
      teacherProfileId: string | null;
    };
  }

  interface User {
    role: UserRole;
    studentProfileId: string | null;
    teacherProfileId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    studentProfileId: string | null;
    teacherProfileId: string | null;
  }
}
