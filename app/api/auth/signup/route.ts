import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { setStudentSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { error: "Invalid signup request." },
        { status: 400 },
      );
    }
    const body = payload as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = (typeof body.email === "string" ? body.email : "")
      .trim()
      .toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const classLevel = Number(body.classLevel ?? 6);
    const section =
      typeof body.section === "string" ? body.section.trim() : "";
    const rollNumber =
      typeof body.rollNumber === "string" ? body.rollNumber.trim() : "";
    const schoolName =
      typeof body.schoolName === "string" ? body.schoolName.trim() : "";
    const guardianName =
      typeof body.guardianName === "string" ? body.guardianName.trim() : "";
    const guardianPhone =
      typeof body.guardianPhone === "string"
        ? body.guardianPhone.trim()
        : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { error: "Password must be between 6 and 128 characters." },
        { status: 400 },
      );
    }

    if (
      name.length > 100 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !Number.isInteger(classLevel) ||
      classLevel < 1 ||
      classLevel > 12 ||
      section.length > 30 ||
      rollNumber.length > 30 ||
      schoolName.length > 200 ||
      guardianName.length > 100 ||
      guardianPhone.length > 30
    ) {
      return NextResponse.json(
        { error: "One or more account fields are invalid." },
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
    const studentKey = `student-${randomBytes(24).toString("hex")}`;

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

    return await setStudentSessionCookie(response, student.id);
  } catch (error) {
    console.error(
      "Student signup failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error: "Signup failed.",
      },
      { status: 500 },
    );
  }
}
