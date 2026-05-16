import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_AUTH_ROUTES = [
  '/',
  '/login',
  '/register',
  '/signup',
  '/forgot-password',
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublicRoute =
    pathname === '/' ||
    PUBLIC_AUTH_ROUTES.some(
      (path) => path !== '/' && pathname.startsWith(path)
    );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.png|apple-icon\\.png|api).*)',
  ],
};






// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// const PUBLIC_AUTH_ROUTES = ['/', '/login', '/register', '/signup', '/forgot-password'];

// export function proxy(request: NextRequest) {
//   if (PUBLIC_AUTH_ROUTES.some((path) => request.nextUrl.pathname.startsWith(path))) {
//     return NextResponse.next();
//   }

//   const token = request.cookies.get('access_token')?.value;
//   if (!token) {
//     const url = new URL('/login', request.url);
//     return NextResponse.redirect(url);
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.png|apple-icon\\.png|api).*)'],
// };
