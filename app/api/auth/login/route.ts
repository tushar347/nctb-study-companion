import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setStudentSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { error: "Invalid login request." },
        { status: 400 },
      );
    }
    const body = payload as Record<string, unknown>;

    const email = (typeof body.email === "string" ? body.email : "")
      .trim()
      .toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length > 128
    ) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 },
      );
    }

    const student = await prisma.student.findUnique({
      where: { email },
    });

    if (!student || !student.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const validPassword = await bcrypt.compare(password, student.passwordHash);

    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const safeStudent = {
      id: student.id,
      studentKey: student.studentKey,
      email: student.email,
      name: student.name,
      classLevel: student.classLevel,
      section: student.section,
      rollNumber: student.rollNumber,
      schoolName: student.schoolName,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
    };

    const response = NextResponse.json({
      success: true,
      student: safeStudent,
    });

    return await setStudentSessionCookie(response, student.id);
  } catch (error) {
    console.error(
      "Student login failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error: "Login failed.",
      },
      { status: 500 },
    );
  }
}
