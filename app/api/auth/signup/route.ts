import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setStudentSessionCookie } from "@/lib/auth";
import {
  createSignupStudent,
  signupErrorDiagnostic,
  signupErrorResponse,
} from "@/lib/signup";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid signup request." },
      { status: 400 },
    );
  }

  try {
    const student = await createSignupStudent(payload, {
      findStudentByEmail: (email) =>
        prisma.student.findUnique({
          where: { email },
          select: { id: true },
        }),
      createStudent: (data) =>
        prisma.student.create({
          data,
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
        }),
    });

    const response = NextResponse.json({
      success: true,
      student,
    });
    return await setStudentSessionCookie(response, student.id);
  } catch (error) {
    const result = signupErrorResponse(error);
    if (result.status === 500) {
      console.error("Student signup failed:", signupErrorDiagnostic(error));
    }
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
}
