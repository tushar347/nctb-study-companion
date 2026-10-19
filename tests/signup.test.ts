import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test from "node:test";
import {
  createSignupStudent,
  signupErrorDiagnostic,
  signupErrorResponse,
  SignupRequestError,
} from "../lib/signup";

const signupPayload = {
  name: "Test Student",
  email: " TEST.STUDENT@example.com ",
  password: "test-password-123",
  classLevel: 6,
  section: " A ",
  rollNumber: " 12 ",
  schoolName: " Example School ",
  guardianName: " Test Guardian ",
  guardianPhone: " 01700000000 ",
};

function createDependencies(
  overrides: Partial<{
    findStudentByEmail: (email: string) => Promise<{ id: string } | null>;
    createStudent: (data: Record<string, unknown>) => Promise<{
      id: string;
      studentKey: string;
      email: string;
      name: string;
      classLevel: number;
      section: string;
      rollNumber: string;
      schoolName: string;
      guardianName: string;
      guardianPhone: string;
      createdAt: Date;
    }>;
  }> = {},
) {
  let savedData: Record<string, unknown> | undefined;
  const dependencies = {
    findStudentByEmail:
      overrides.findStudentByEmail ?? (async () => null),
    createStudent:
      overrides.createStudent ??
      (async (data: Record<string, unknown>) => {
        savedData = data;
        return {
          id: "student-id",
          studentKey: String(data.studentKey),
          email: String(data.email),
          name: String(data.name),
          classLevel: Number(data.classLevel),
          section: String(data.section),
          rollNumber: String(data.rollNumber),
          schoolName: String(data.schoolName),
          guardianName: String(data.guardianName),
          guardianPhone: String(data.guardianPhone),
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
        };
      }),
    hashPassword: (password: string) => bcrypt.hash(password, 4),
    createStudentKey: () => "student-test-key",
  };
  return {
    dependencies,
    getSavedData: () => savedData,
  };
}

test("creates a normalized account with every signup field and a password hash", async () => {
  const { dependencies, getSavedData } = createDependencies();
  const student = await createSignupStudent(signupPayload, dependencies);
  const saved = getSavedData();

  assert.equal(student.email, "test.student@example.com");
  assert.equal(saved?.name, "Test Student");
  assert.equal(saved?.classLevel, 6);
  assert.equal(saved?.section, "A");
  assert.equal(saved?.rollNumber, "12");
  assert.equal(saved?.schoolName, "Example School");
  assert.equal(saved?.guardianName, "Test Guardian");
  assert.equal(saved?.guardianPhone, "01700000000");
  assert.deepEqual(saved?.memory, { create: {} });
  assert.equal(saved?.studentKey, "student-test-key");
  assert.notEqual(saved?.passwordHash, signupPayload.password);
  assert.equal(
    await bcrypt.compare(
      signupPayload.password,
      String(saved?.passwordHash),
    ),
    true,
  );
  assert.equal("passwordHash" in student, false);
});

test("rejects invalid signup input with HTTP 400", async () => {
  const { dependencies } = createDependencies();
  await assert.rejects(
    createSignupStudent({ ...signupPayload, classLevel: 99 }, dependencies),
    (error: unknown) => {
      assert.ok(error instanceof SignupRequestError);
      assert.deepEqual(signupErrorResponse(error), {
        status: 400,
        error: "One or more account fields are invalid.",
      });
      return true;
    },
  );
});

test("rejects each missing required field with HTTP 400", async () => {
  const { dependencies } = createDependencies();
  for (const field of ["name", "email", "password"] as const) {
    const payload = { ...signupPayload, [field]: "" };
    await assert.rejects(
      createSignupStudent(payload, dependencies),
      (error: unknown) => {
        assert.deepEqual(signupErrorResponse(error), {
          status: 400,
          error: "Name, email, and password are required.",
        });
        return true;
      },
    );
  }
});

test("rejects an existing email before attempting account creation", async () => {
  let createCalled = false;
  const { dependencies } = createDependencies({
    findStudentByEmail: async () => ({ id: "existing-student" }),
    createStudent: async () => {
      createCalled = true;
      throw new Error("Should not create a duplicate");
    },
  });

  await assert.rejects(
    createSignupStudent(signupPayload, dependencies),
    (error: unknown) => {
      assert.deepEqual(signupErrorResponse(error), {
        status: 409,
        error: "An account already exists with this email.",
      });
      return true;
    },
  );
  assert.equal(createCalled, false);
});

test("maps a concurrent duplicate-email database constraint to HTTP 409", async () => {
  const { dependencies } = createDependencies({
    createStudent: async () => {
      throw Object.assign(new Error("private database details"), {
        code: "P2002",
        meta: { target: ["email"] },
      });
    },
  });
  await assert.rejects(
    createSignupStudent(signupPayload, dependencies),
    (error: unknown) => {
      assert.deepEqual(signupErrorResponse(error), {
        status: 409,
        error: "An account already exists with this email.",
      });
      return true;
    },
  );
});

test("returns a generic HTTP 500 for database errors without exposing details", () => {
  const error = Object.assign(new Error("secret connection string"), {
    code: "P1001",
  });
  assert.deepEqual(signupErrorResponse(error), {
    status: 500,
    error: "Signup failed.",
  });
  assert.deepEqual(signupErrorDiagnostic(error), {
    name: "Error",
    code: "P1001",
  });
  assert.equal(JSON.stringify(signupErrorResponse(error)).includes("secret"), false);
});

test("does not hide database read failures behind an account-creation fallback", async () => {
  const databaseError = Object.assign(
    new Error("secret connection string"),
    { code: "P1001" },
  );
  const { dependencies } = createDependencies({
    findStudentByEmail: async () => {
      throw databaseError;
    },
  });

  await assert.rejects(
    createSignupStudent(signupPayload, dependencies),
    (error: unknown) => {
      assert.equal(error, databaseError);
      assert.deepEqual(signupErrorResponse(error), {
        status: 500,
        error: "Signup failed.",
      });
      return true;
    },
  );
});
