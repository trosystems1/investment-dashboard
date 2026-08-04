export { default } from 'next-auth/middleware'
export const config = {
matcher: ['/((?!api/auth|api/aria|api/cron|api/settings|login|_next/static|_next/image|favicon.ico).*)'],
}

