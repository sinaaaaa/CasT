import { NextRequest } from "next/server";
import { z } from "zod";
import { assertClassAccess } from "@/lib/class-access";
import { requireTeacher } from "@/lib/api-auth";
import { normalizeExternalStudentId } from "@/lib/game-service";
import { planStudentRange } from "@/lib/student-id-utils";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BULK_CHUNK_SIZE = 20;

const bulkCreateSchema = z.object({
  namePrefix: z.string().min(1).max(80),
  from: z.coerce.number().int().min(1).max(999999),
  to: z.coerce.number().int().min(1).max(999999),
  classId: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireTeacher();
    if (error) return error;

    let body: z.infer<typeof bulkCreateSchema>;
    try {
      body = bulkCreateSchema.parse(await request.json());
    } catch (e) {
      return Response.json({ error: "Invalid body", details: e }, { status: 400 });
    }

    const classId = body.classId?.trim();
    if (!scope!.isAdmin) {
      if (!scope!.teacherProfileId || (scope!.classIds?.length ?? 0) === 0) {
        return Response.json(
          { error: "Create a class first, then add students to it." },
          { status: 400 }
        );
      }
      if (!classId) {
        return Response.json(
          { error: "Class is required when adding students." },
          { status: 400 }
        );
      }
      if (!assertClassAccess(scope!, classId)) {
        return Response.json({ error: "You do not have access to this class" }, { status: 403 });
      }
    } else if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });
    }

    const plan = await planStudentRange(body.from, body.to, body.namePrefix);
    if (!plan.ok) {
      return Response.json(
        { error: plan.message, conflicts: plan.conflicts },
        { status: 409 }
      );
    }

    const password = body.password ?? "student123";
    const hashed = await bcrypt.hash(password, 10);

    let totalCreated = 0;
    for (let i = 0; i < plan.slots.length; i += BULK_CHUNK_SIZE) {
      const chunk = plan.slots.slice(i, i + BULK_CHUNK_SIZE);
      const createdInChunk = await prisma.$transaction(
        async (tx) => {
          let n = 0;
          for (const slot of chunk) {
            const externalId = normalizeExternalStudentId(slot.externalId);
            const email = `${externalId.toLowerCase().replace(/[^a-z0-9]/g, "")}@sparc.local`;

            const student = await tx.studentProfile.create({
              data: {
                displayName: slot.displayName,
                externalId,
                user: {
                  create: {
                    email,
                    password: hashed,
                    role: UserRole.STUDENT,
                  },
                },
              },
              select: { id: true },
            });

            if (classId) {
              await tx.classStudent.create({
                data: { classId, studentId: student.id },
              });
            }
            n += 1;
          }
          return n;
        },
        { timeout: 55_000 }
      );
      totalCreated += createdInChunk;
    }

    return Response.json(
      {
        created: totalCreated,
        from: plan.from,
        to: plan.to,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[bulk students]", e);
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Server error while creating students. Try a smaller range.",
      },
      { status: 500 }
    );
  }
}
