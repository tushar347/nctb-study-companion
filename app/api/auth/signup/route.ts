import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function makeStudentKey(name: string) {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const random = Math.random().toString(36).slice(2, 8);

  return `${cleanName || "student"}-${random}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const classLevel = Number(body.classLevel ?? 6);
    const section = String(body.section ?? "").trim();
    const rollNumber = String(body.rollNumber ?? "").trim();
    const schoolName = String(body.schoolName ?? "").trim();
    const guardianName = String(body.guardianName ?? "").trim();
    const guardianPhone = String(body.guardianPhone ?? "").trim();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const existing = await prisma.student.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account already exists with this email." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const studentKey = makeStudentKey(name);

    const student = await prisma.student.create({
      data: {
        studentKey,
        email,
        passwordHash,
        name,
        classLevel,
        section,
        rollNumber,
        schoolName,
        guardianName,
        guardianPhone,
        memory: {
          create: {},
        },
      },
      select: {
        id: true,
        studentKey: true,
        email: true,
        name: true,
        classLevel: true,
        section: true,
        rollNumber: true,
        schoolName: true,
        guardianName: true,
        guardianPhone: true,
        createdAt: true,
      },
    });

    const response = NextResponse.json({
      success: true,
      student,
    });

    response.cookies.set("nctb_student_key", student.studentKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Signup failed.",
      },
      { status: 500 },
    );
  }
}
