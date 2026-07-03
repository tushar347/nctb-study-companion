import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
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
        error: error instanceof Error ? error.message : "Login failed.",
      },
      { status: 500 },
    );
  }
}
