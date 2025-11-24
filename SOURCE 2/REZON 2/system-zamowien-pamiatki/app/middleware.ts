import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Rate limiting storage (in production use Redis/external store)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // Reset or new client
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  clientData.count++;
  return false;
}

function getClientId(req: any): string {
  // Use IP address for rate limiting (in production use a more sophisticated method)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.ip || 'unknown';
  return ip;
}

export default withAuth(
  function middleware(req) {
    // Rate limiting for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      const clientId = getClientId(req);

      if (isRateLimited(clientId)) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
              'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
              'X-RateLimit-Remaining': '0',
            },
          }
        );
      }
    }

    // Security headers
    const response = NextResponse.next();

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // CORS headers for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      );
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers: response.headers });
      }
    }

    // Publiczne ścieżki - nie wymagają autoryzacji
    const publicPaths = [
      '/', // Strona główna = katalog publiczny
      '/katalog',
      '/nowosci',
      '/o-nas',
      '/kontakt',
      '/przedstawiciele',
      '/pliki',
      '/auth',
      '/api/products', // API dla publicznego katalogu
    ];

    // Sprawdź czy ścieżka jest publiczna
    const isPublicPath = publicPaths.some(path => {
      // Exact match dla "/"
      if (path === '/' && req.nextUrl.pathname === '/') {
        return true;
      }
      // StartsWith dla pozostałych
      return path !== '/' && req.nextUrl.pathname.startsWith(path);
    });

    // SPECJALNE PRZEKIEROWANIE: Zalogowany użytkownik na stronie głównej "/"
    // powinien być przekierowany do systemu zamówień
    if (req.nextUrl.pathname === '/' && req.nextauth.token) {
      return NextResponse.redirect(new URL('/zamowienia', req.url));
    }

    // Jeśli publiczna ścieżka, pozwól bez autoryzacji
    if (isPublicPath) {
      return response;
    }

    // Admin pages wymagają roli ADMIN
    if (req.nextUrl.pathname.startsWith('/admin')) {
      if (req.nextauth.token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/auth/login', req.url));
      }
    }

    // Warehouse pages wymagają roli WAREHOUSE lub SALES_DEPT
    if (req.nextUrl.pathname.startsWith('/magazyn')) {
      const allowedRoles = ['WAREHOUSE', 'SALES_DEPT', 'ADMIN'];
      if (!req.nextauth.token?.role || !allowedRoles.includes(req.nextauth.token.role)) {
        return NextResponse.redirect(new URL('/auth/login', req.url));
      }
    }

    // Inne chronione strony wymagają logowania
    if (!req.nextauth.token) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Publiczne ścieżki zawsze autoryzowane
        const publicPaths = [
          '/',
          '/katalog',
          '/nowosci',
          '/o-nas',
          '/kontakt',
          '/przedstawiciele',
          '/pliki',
          '/auth',
          '/api/products',
        ];
        const isPublicPath = publicPaths.some(path => {
          // Exact match dla "/"
          if (path === '/' && req.nextUrl.pathname === '/') {
            return true;
          }
          // StartsWith dla pozostałych
          return path !== '/' && req.nextUrl.pathname.startsWith(path);
        });

        if (isPublicPath) return true;

        // Inne strony wymagają tokena
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
