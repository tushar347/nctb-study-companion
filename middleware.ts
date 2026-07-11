import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/home",
  "/reader",
  "/teacher",
  "/quiz",
  "/games",
  "/progress",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const studentKey = request.cookies.get("nctb_student_key")?.value;

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !studentKey) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && studentKey) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
