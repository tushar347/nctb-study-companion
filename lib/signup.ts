import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export type SignupStudent = {
  id: string;
  studentKey: string;
  email: string | null;
  name: string | null;
  classLevel: number | null;
  section: string | null;
  rollNumber: string | null;
  schoolName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  createdAt: Date;
};

type CreateStudentInput = {
  studentKey: string;
  email: string;
  passwordHash: string;
  name: string;
  classLevel: number;
  section: string;
  rollNumber: string;
  schoolName: string;
  guardianName: string;
  guardianPhone: string;
  memory: { create: Record<string, never> };
};

type SignupDependencies = {
  findStudentByEmail(email: string): Promise<{ id: string } | null>;
  createStudent(data: CreateStudentInput): Promise<SignupStudent>;
  hashPassword?: (password: string) => Promise<string>;
  createStudentKey?: () => string;
};

export class SignupRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409,
  ) {
    super(message);
    this.name = "SignupRequestError";
  }
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new SignupRequestError("One or more account fields are invalid.", 400);
  }
  return value.trim();
}

function parseSignupPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SignupRequestError("Invalid signup request.", 400);
  }

  const body = payload as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const classLevel = body.classLevel === undefined ? 6 : Number(body.classLevel);
  const section = optionalString(body, "section");
  const rollNumber = optionalString(body, "rollNumber");
  const schoolName = optionalString(body, "schoolName");
  const guardianName = optionalString(body, "guardianName");
  const guardianPhone = optionalString(body, "guardianPhone");

  if (!name || !email || !password) {
    throw new SignupRequestError(
      "Name, email, and password are required.",
      400,
    );
  }

  if (password.length < 6 || password.length > 128) {
    throw new SignupRequestError(
      "Password must be between 6 and 128 characters.",
      400,
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
    throw new SignupRequestError("One or more account fields are invalid.", 400);
  }

  return {
    name,
    email,
    password,
    classLevel,
    section,
    rollNumber,
    schoolName,
    guardianName,
    guardianPhone,
  };
}

function isEmailUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    meta?: { target?: unknown };
  };
  if (candidate.code !== "P2002") {
    return false;
  }

  const target = candidate.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  return fields.some(
    (field) => typeof field === "string" && field.toLowerCase().includes("email"),
  );
}

export async function createSignupStudent(
  payload: unknown,
  dependencies: SignupDependencies,
): Promise<SignupStudent> {
  const input = parseSignupPayload(payload);
  const existing = await dependencies.findStudentByEmail(input.email);
  if (existing) {
    throw new SignupRequestError(
      "An account already exists with this email.",
      409,
    );
  }

  const passwordHash = await (dependencies.hashPassword ?? ((password) =>
    bcrypt.hash(password, 10)))(input.password);
  const studentKey =
    dependencies.createStudentKey?.() ??
    `student-${randomBytes(24).toString("hex")}`;

  try {
    return await dependencies.createStudent({
      studentKey,
      email: input.email,
      passwordHash,
      name: input.name,
      classLevel: input.classLevel,
      section: input.section,
      rollNumber: input.rollNumber,
      schoolName: input.schoolName,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      memory: { create: {} },
    });
  } catch (error) {
    if (isEmailUniqueConstraintError(error)) {
      throw new SignupRequestError(
        "An account already exists with this email.",
        409,
      );
    }
    throw error;
  }
}

export function signupErrorResponse(error: unknown) {
  if (error instanceof SignupRequestError) {
    return { status: error.status, error: error.message };
  }
  if (isEmailUniqueConstraintError(error)) {
    return {
      status: 409,
      error: "An account already exists with this email.",
    };
  }
  return { status: 500, error: "Signup failed." };
}

export function signupErrorDiagnostic(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: "UnknownError" };
  }
  const diagnostic: { name: string; code?: string } = {
    name: "name" in error && typeof error.name === "string"
      ? error.name
      : "UnknownError",
  };
  if ("code" in error && typeof error.code === "string") {
    diagnostic.code = error.code;
  }
  return diagnostic;
}
