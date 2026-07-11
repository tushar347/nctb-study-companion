export type StoredStudentProfile = {
  id?: string;
  studentKey?: string;
  email?: string | null;
  name?: string | null;
  classLevel?: number | null;
  section?: string | null;
  rollNumber?: string | null;
  schoolName?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
};

export function getStoredStudentProfile(): StoredStudentProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const savedProfile = localStorage.getItem("studentProfile");

  if (savedProfile) {
    try {
      return JSON.parse(savedProfile) as StoredStudentProfile;
    } catch {
      return null;
    }
  }

  return null;
}

export function getStoredStudentKey() {
  if (typeof window === "undefined") {
    return "demo-student";
  }

  const profile = getStoredStudentProfile();
  const savedKey = localStorage.getItem("studentKey");

  return profile?.studentKey || savedKey || "demo-student";
}

export function getStoredStudentName() {
  const profile = getStoredStudentProfile();

  return profile?.name || "Student";
}
