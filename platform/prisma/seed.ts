import { PrismaClient, UserRole, AttemptStatus, CommandAction, ButtonEventType, RobotTouchType, LevelType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyLevelTypeDefaults, defaultConfigForType } from "../src/lib/level-config";
import { DEFAULT_CT_CONSTRUCTS } from "../src/lib/ct/constructs";
import { analyzeAttemptConstructs } from "../src/lib/ct/scoring";

const prisma = new PrismaClient();

async function main() {
  await prisma.teacherNote.deleteMany();
  await prisma.studentConstructPerformance.deleteMany();
  await prisma.levelCTConstruct.deleteMany();
  await prisma.cTConstruct.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.robotTouchEvent.deleteMany();
  await prisma.actionButtonEvent.deleteMany();
  await prisma.commandEvent.deleteMany();
  await prisma.levelAttempt.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.class.deleteMany();
  await prisma.levelStudentAssignment.deleteMany();
  await prisma.levelClassAssignment.deleteMany();
  await prisma.level.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const teacherUser = await prisma.user.create({
    data: {
      email: "teacher@sparc.edu",
      password: passwordHash,
      role: UserRole.TEACHER,
      teacherProfile: { create: { displayName: "Dr. Morgan Chen" } },
    },
    include: { teacherProfile: true },
  });

  await prisma.user.create({
    data: {
      email: "admin@sparc.edu",
      password: passwordHash,
      role: UserRole.ADMIN,
      teacherProfile: { create: { displayName: "SPARC Administrator" } },
    },
  });

  const classA = await prisma.class.create({
    data: {
      name: "Computational Thinking — Period 3",
      code: "CT-P3-2026",
      description: "Grade 6 robot programming cohort",
      teachers: {
        create: { teacherId: teacherUser.teacherProfile!.id },
      },
    },
  });

  const levelDefs = [
    {
      levelKey: "level_0",
      name: "Block introduction (Level 0)",
      orderIndex: 0,
      difficulty: 1,
      levelType: LevelType.INTRO,
      published: true,
      config: applyLevelTypeDefaults(
        LevelType.INTRO,
        defaultConfigForType(LevelType.INTRO, "Block introduction")
      ),
    },
    {
      levelKey: "level_1",
      name: "Level 1 — Learn the blocks",
      orderIndex: 1,
      difficulty: 1,
      levelType: LevelType.DRAG_ACTIONS,
      published: true,
      config: applyLevelTypeDefaults(
        LevelType.DRAG_ACTIONS,
        defaultConfigForType(LevelType.DRAG_ACTIONS, "Level 1")
      ),
    },
    {
      levelKey: "level_2",
      name: "Level 2 — Place the flag",
      orderIndex: 2,
      difficulty: 2,
      levelType: LevelType.FLAG_PLACEMENT,
      published: true,
      config: applyLevelTypeDefaults(
        LevelType.FLAG_PLACEMENT,
        {
          ...defaultConfigForType(LevelType.FLAG_PLACEMENT, "Level 2"),
          guidedActions: ["forward", "forward", "forward"],
          robotStartFacing: { x: 1, y: 0 },
        }
      ),
    },
    {
      levelKey: "level_3",
      name: "Level 3 — Choose the turn",
      orderIndex: 3,
      difficulty: 3,
      levelType: LevelType.CHOOSE_BUTTONS,
      published: true,
      config: applyLevelTypeDefaults(
        LevelType.CHOOSE_BUTTONS,
        defaultConfigForType(LevelType.CHOOSE_BUTTONS, "Level 3")
      ),
    },
    {
      levelKey: "level_4",
      name: "Pattern Detective",
      orderIndex: 4,
      difficulty: 4,
      levelType: LevelType.DRAG_ACTIONS,
      published: false,
      config: defaultConfigForType(LevelType.DRAG_ACTIONS, "Level 4"),
    },
    {
      levelKey: "level_5",
      name: "Debug the Path",
      orderIndex: 5,
      difficulty: 5,
      levelType: LevelType.DRAG_ACTIONS,
      published: false,
      config: defaultConfigForType(LevelType.DRAG_ACTIONS, "Level 5"),
    },
  ];

  const levels = await Promise.all(
    levelDefs.map((l) =>
      prisma.level.create({
        data: {
          levelKey: l.levelKey,
          name: l.name,
          orderIndex: l.orderIndex,
          difficulty: l.difficulty,
          levelType: l.levelType,
          published: l.published,
          config: l.config as object,
        },
      })
    )
  );

  const constructRecords = await Promise.all(
    DEFAULT_CT_CONSTRUCTS.map((c) =>
      prisma.cTConstruct.create({
        data: {
          slug: c.slug,
          name: c.name,
          color: c.color,
          sortOrder: c.sortOrder,
          description: `Default rubric for ${c.name}.`,
          rubricDescription: `Students demonstrate ${c.name} through command choices, efficiency, and problem-solving behavior.`,
        },
      })
    )
  );
  const bySlug = Object.fromEntries(constructRecords.map((c) => [c.slug, c]));

  const levelMappings: { levelIdx: number; items: { slug: string; weight: number; evidence: string }[] }[] = [
    {
      levelIdx: 0,
      items: [
        { slug: "sequencing", weight: 50, evidence: "Ordered block placement in intro steps" },
        { slug: "algorithm-design", weight: 30, evidence: "Completes guided sequence" },
        { slug: "debugging", weight: 20, evidence: "Retries after incorrect runs" },
      ],
    },
    {
      levelIdx: 1,
      items: [
        { slug: "sequencing", weight: 40, evidence: "Correct forward/turn order" },
        { slug: "algorithm-design", weight: 30, evidence: "Minimal command path to goal" },
        { slug: "debugging", weight: 30, evidence: "Command edits after failed runs" },
      ],
    },
    {
      levelIdx: 2,
      items: [
        { slug: "decomposition", weight: 35, evidence: "Breaks path into forward segments" },
        { slug: "algorithm-design", weight: 35, evidence: "Efficient route to flag" },
        { slug: "pattern-recognition", weight: 30, evidence: "Repeating move patterns" },
      ],
    },
    {
      levelIdx: 3,
      items: [
        { slug: "conditionals", weight: 40, evidence: "Chooses correct turn buttons" },
        { slug: "logical-reasoning", weight: 35, evidence: "Evaluates orientation before move" },
        { slug: "evaluation", weight: 25, evidence: "Tests solution before submit" },
      ],
    },
  ];

  for (const map of levelMappings) {
    const level = levels[map.levelIdx];
    for (const item of map.items) {
      const construct = bySlug[item.slug];
      if (!construct) continue;
      await prisma.levelCTConstruct.create({
        data: {
          levelId: level.id,
          constructId: construct.id,
          weightPercent: item.weight,
          expectedEvidence: item.evidence,
          rubricDescription: `On ${level.name}, assess ${construct.name} (${item.weight}%).`,
        },
      });
    }
  }

  const studentDefs = [
    { email: "alex@student.sparc.edu", name: "Alex Rivera", externalId: "STU-1001" },
    { email: "sam@student.sparc.edu", name: "Sam Okonkwo", externalId: "STU-1002" },
    { email: "jordan@student.sparc.edu", name: "Jordan Lee", externalId: "STU-1003" },
    { email: "taylor@student.sparc.edu", name: "Taylor Brooks", externalId: "STU-1004" },
  ];

  const students = [];
  for (const def of studentDefs) {
    const user = await prisma.user.create({
      data: {
        email: def.email,
        password: passwordHash,
        role: UserRole.STUDENT,
        studentProfile: {
          create: { displayName: def.name, externalId: def.externalId },
        },
      },
      include: { studentProfile: true },
    });
    await prisma.classStudent.create({
      data: { classId: classA.id, studentId: user.studentProfile!.id },
    });
    students.push(user.studentProfile!);
  }

  // Assign every published level so Unity receives the full progression (intro → level_1 → level_2 → …).
  const publishedLevels = levels.filter((_, i) => levelDefs[i].published);
  await prisma.levelClassAssignment.createMany({
    data: publishedLevels.map((level) => ({ classId: classA.id, levelId: level.id })),
  });

  const now = new Date();
  const mkAttempt = async (
    studentId: string,
    levelIdx: number,
    opts: {
      attemptNumber: number;
      status: AttemptStatus;
      passed: boolean;
      score: number;
      minutesAgo: number;
      robotTouched?: boolean;
    }
  ) => {
    const level = levels[levelIdx];
    const startedAt = new Date(now.getTime() - opts.minutesAgo * 60_000);
    const endedAt = new Date(startedAt.getTime() + (120 + opts.attemptNumber * 30) * 1000);

    const attempt = await prisma.levelAttempt.create({
      data: {
        studentId,
        classId: classA.id,
        levelId: level.id,
        attemptNumber: opts.attemptNumber,
        startedAt,
        endedAt,
        totalTimeSeconds: (endedAt.getTime() - startedAt.getTime()) / 1000,
        status: opts.status,
        passed: opts.passed,
        score: opts.score,
        initialCommand: "move forward",
        finalCommand: opts.passed ? "move forward; turn left; move forward" : "move forward; turn right",
        robotTouched: opts.robotTouched ?? false,
        robotTouchCount: opts.robotTouched ? 2 : 0,
        robotTouchDurationSeconds: opts.robotTouched ? 12.5 : 0,
        hintsUsed: opts.passed ? 0 : 1,
        mistakes: opts.passed ? [] : ["wrong_turn", "premature_submit"],
        feedback: opts.passed ? "Great decomposition!" : "Review turn direction before running.",
        closedButtons: ["Run Code"],
        disabledButtons: opts.passed ? [] : ["Loop"],
      },
    });

    const cmdEvents = [
      { command: "move forward", action: CommandAction.ADDED, offset: 5 },
      { command: "turn left", action: CommandAction.ADDED, offset: 45 },
      { command: "move forward", action: CommandAction.ADDED, offset: 70 },
    ];
    if (!opts.passed) {
      cmdEvents.push({ command: "turn right", action: CommandAction.ADDED, offset: 90 });
    }

    for (let i = 0; i < cmdEvents.length; i++) {
      const e = cmdEvents[i];
      await prisma.commandEvent.create({
        data: {
          attemptId: attempt.id,
          command: e.command,
          action: e.action,
          sequence: i,
          timestamp: new Date(startedAt.getTime() + e.offset * 1000),
        },
      });
    }

    await prisma.actionButtonEvent.createMany({
      data: [
        {
          attemptId: attempt.id,
          buttonName: "Move Forward",
          eventType: ButtonEventType.CLICKED,
          timestamp: new Date(startedAt.getTime() + 4_000),
        },
        {
          attemptId: attempt.id,
          buttonName: "Turn Left",
          eventType: ButtonEventType.CLICKED,
          timestamp: new Date(startedAt.getTime() + 44_000),
        },
        {
          attemptId: attempt.id,
          buttonName: "Run Code",
          eventType: ButtonEventType.CLOSED,
          timestamp: endedAt,
        },
      ],
    });

    if (opts.robotTouched) {
      const touchStart = new Date(startedAt.getTime() + 20_000);
      const touchEnd = new Date(touchStart.getTime() + 8_000);
      await prisma.robotTouchEvent.createMany({
        data: [
          { attemptId: attempt.id, eventType: RobotTouchType.TOUCH_START, timestamp: touchStart },
          {
            attemptId: attempt.id,
            eventType: RobotTouchType.TOUCH_END,
            timestamp: touchEnd,
            durationSeconds: 8,
          },
        ],
      });
    }

    await prisma.assessmentResult.create({
      data: {
        attemptId: attempt.id,
        decomposition: opts.passed ? 4 : 2,
        patternRecognition: opts.passed ? 4 : 3,
        algorithmicThinking: opts.passed ? 5 : 2,
        debugging: opts.passed ? 4 : 2,
        abstraction: opts.passed ? 3 : 2,
        persistence: opts.passed ? 4 : 3,
        creativity: opts.passed ? 3 : 2,
        totalScore: opts.score,
        mistakePattern: opts.passed ? null : "incorrect_turn_sequence",
        assessmentNotes: opts.passed ? "Strong sequencing." : "Student struggled with orientation.",
      },
    });

    if (!opts.passed && teacherUser.teacherProfile) {
      await prisma.teacherNote.create({
        data: {
          attemptId: attempt.id,
          teacherId: teacherUser.id,
          content: "Schedule a short re-teach on left vs right turns.",
        },
      });
    }

    return attempt;
  };

  const attemptIds: string[] = [];

  // Alex: strong progress
  attemptIds.push(
    (
      await mkAttempt(students[0].id, 0, {
        attemptNumber: 1,
        status: AttemptStatus.CORRECT,
        passed: true,
        score: 95,
        minutesAgo: 400,
      })
    ).id
  );
  attemptIds.push(
    (
      await mkAttempt(students[0].id, 1, {
        attemptNumber: 1,
        status: AttemptStatus.CORRECT,
        passed: true,
        score: 88,
        minutesAgo: 300,
      })
    ).id
  );
  attemptIds.push(
    (
      await mkAttempt(students[0].id, 2, {
        attemptNumber: 1,
        status: AttemptStatus.INCORRECT,
        passed: false,
        score: 55,
        minutesAgo: 200,
        robotTouched: true,
      })
    ).id
  );

  // Sam: mixed
  attemptIds.push(
    (
      await mkAttempt(students[1].id, 0, {
        attemptNumber: 1,
        status: AttemptStatus.CORRECT,
        passed: true,
        score: 90,
        minutesAgo: 500,
      })
    ).id
  );
  attemptIds.push(
    (
      await mkAttempt(students[1].id, 1, {
        attemptNumber: 1,
        status: AttemptStatus.INCORRECT,
        passed: false,
        score: 40,
        minutesAgo: 350,
        robotTouched: true,
      })
    ).id
  );
  attemptIds.push(
    (
      await mkAttempt(students[1].id, 1, {
        attemptNumber: 2,
        status: AttemptStatus.CORRECT,
        passed: true,
        score: 82,
        minutesAgo: 320,
      })
    ).id
  );

  // Jordan: needs help
  attemptIds.push(
    (
      await mkAttempt(students[2].id, 0, {
        attemptNumber: 1,
        status: AttemptStatus.INCORRECT,
        passed: false,
        score: 35,
        minutesAgo: 180,
        robotTouched: true,
      })
    ).id
  );
  attemptIds.push(
    (
      await mkAttempt(students[2].id, 0, {
        attemptNumber: 2,
        status: AttemptStatus.INCOMPLETE,
        passed: false,
        score: 0,
        minutesAgo: 60,
      })
    ).id
  );

  // Taylor: early progress
  attemptIds.push(
    (
      await mkAttempt(students[3].id, 0, {
        attemptNumber: 1,
        status: AttemptStatus.CORRECT,
        passed: true,
        score: 92,
        minutesAgo: 100,
      })
    ).id
  );

  for (const attemptId of attemptIds) {
    try {
      await analyzeAttemptConstructs(attemptId);
    } catch (e) {
      console.warn("CT analysis skipped for", attemptId, e);
    }
  }

  console.log("Seed complete.");
  console.log("Teacher: teacher@sparc.edu / password123");
  console.log("Students: alex@student.sparc.edu, sam@student.sparc.edu, etc. / password123");
  console.log("Unity external IDs: STU-1001 … STU-1004");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
