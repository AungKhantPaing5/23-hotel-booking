# Booking system review — 30 October 2026

## Fixed

- Web compilation no longer includes the separately installed Expo mobile project.
- Fixed strict TypeScript errors in database queries and admin pages.
- Replaced the incompatible ESLint flat configuration with the Next.js 15 compatible configuration.
- Corrected MyanMyanPay SDK factory invocation and MMK currency typing.
- Upgraded the resolved dependencies and pinned a patched PostCSS through an override. Production dependency audit: zero reported vulnerabilities at review time.
- Customer date validation and database validation now use the Myanmar hotel calendar. The booking form respects the selected room's guest capacity.
- OTP verification always examines the latest issued code, including consumed/expired codes, preventing fallback to an older unused code.
- Production session signing rejects shipped example secrets; malformed session tokens and malformed password hashes fail closed.
- PostgreSQL TLS verifies certificates when enabled.
- A unique database index prevents concurrent pending/paid deposit records for one booking. Existing installations must apply migration 005 after resolving any historic duplicates.
- SMS requests now time out instead of waiting indefinitely.
- Added a standalone Docker image, production Compose configuration, locked npm dependencies, automated checks and regression tests.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: zero errors; existing advisory warnings remain (loose database result types, image optimization, unused variables).
- `npm test`: Myanmar date boundary, password salting/verification, malformed password hashes.
- `npm run build`: production build passed.
- `npm run test:smoke`: checks anonymous requests cannot read bookings or start bookings/payments.
- `npm audit --omit=dev`: zero reported vulnerabilities after dependency override.

## Before live use

- Full database-backed reservation, concurrent booking, migration and Docker startup tests were not run in this environment because no PostgreSQL/Docker runtime was available. Perform these on a staging server before taking reservations.
- Room type inventory is now implemented through `room_units` (migration 007). Each physical number belongs to one room type and booking overlap is checked per physical number.
- Pending requests block inventory until staff confirms/rejects them. Add an operational expiry policy if requests should expire automatically.
- Real customer OTP requires a configured SMS service. The generic SMS adapter must be matched to your provider's actual API. The fixed development OTP is disabled in production.
- MyanMyanPay/Dinger integrations need approved merchant credentials and provider sandbox verification. No real payment or refund was made. Gateway refund reconciliation is outside this review.
- Apply rate limiting at the HTTPS reverse proxy, particularly staff login and OTP routes, before exposing the app publicly.
- Payment checkouts left pending must be reconciled with the provider before a new attempt; do not simply delete pending/paid records.
- The supplied Expo source remains available under `mobile/`; its build and device behavior were not tested in this web booking review.
- Back up PostgreSQL and the upload volume. No real customer data or payment credentials are included in the repository.

## Customer login update

- Email-first customer login followed by local 09 phone input and a six-digit SMS OTP. Email is an account identifier, not a verified inbox.
- Staff/Admin email/password login does not ask for a phone number. Admin destinations redirect to the separate staff login page.
- OTPs are bound to both email and phone. Existing email/phone mismatches, disabled accounts and all staff accounts are rejected by customer OTP routes. Existing phone-only accounts may safely attach a previously unused email after phone verification.
- Migration 006 adds OTP email binding while preserving users, profiles and bookings.
- Web unit tests and HTTP smoke tests cover input validation, identity binding, account takeover prevention and the initial guest/staff forms. A PostgreSQL-backed end-to-end login still needs staging verification. Mobile source is updated to send email alongside OTP requests; a native device build was not tested.

## Signed-in header correction

The old customer header always rendered a hardcoded Sign in link, even when the protected My bookings page had successfully loaded the current user's reservations. The header now reads the validated server session and displays the guest's name (or email), a My bookings link and Sign out. Desktop and mobile navigation use the same session state. Sign out clears the server cookie and reloads the login page. The session API is marked private/no-store.

## Room type / physical number inventory update

- Admin can create/edit multiple physical room numbers per room type. Changes to type details and number inventory commit atomically. Active booking numbers cannot be removed; soft removal preserves historical bookings.
- Date-based availability is shared by web/mobile. All new bookings require an active number from the chosen type; the server rechecks membership and PostgreSQL exclusion constraints enforce the final overlap check.
- Migration 007 preserves old assignments and old unnumbered active bookings. Unnumbered legacy reservations conservatively hold their entire room type for their stay dates. Resolve/assign them before selling those overlapping dates. A migration with conflicting historic room ownership fails for manual reconciliation.
- Embedded PostgreSQL (PGlite) tests execute the actual schema/migration, availability SQL and booking service: different-number same-date bookings, duplicate-number rejection, overlapping stays, adjacent stays, cancellation/rebooking, wrong-type rejection, inventory removal protections, migration reapplication and history preservation. This does not replace a concurrency/load test on the deployed PostgreSQL 17 server.
- Mobile source is updated; no native build/device test was performed.

## Returning customer password login

- Customer Sign in now uses email/password without SMS. Registration and password setup/reset use phone OTP followed by a new password. Existing OTP-only accounts retain their IDs, profile and bookings when they set a password.
- Migration 008 adds persistent failed-login tracking and a password session version. Password changes invalidate previous sessions; staff sign-in issues the current session version and still does not request a phone.
- Embedded PostgreSQL tests exercise the actual OTP/password routes and token verification: old-account setup, new registration, password hashing, OTP reuse rejection, returning login with no phone and no new OTP, staff isolation, disabled accounts, failed-login limits, reset and old-session invalidation.

## Customer support chat

- Added a responsive round customer chat launcher, private conversation history, reply badges, and a staff inbox with search, unread markers, pagination and resolution status. Messages refresh through HTTP polling while the page is visible.
- Support-only employees have the new support_staff role, can access the support inbox, and cannot access hotel inventory, reservations, payments or staff administration. Manager/Receptionist/Super Admin may also reply.
- Migration 009 adds chat tables and the role. Server-side authorization prevents customer impersonation, cross-customer access and access by unrelated/inactive staff roles. Messages are plain text and React escapes them. Length limits, persistent sender rate limits and retry idempotency are enforced.
- Embedded PostgreSQL/API tests cover migration reapplication, ownership isolation, role enforcement, sending/replying, read cursors, unread counts, resolution/reopening, history pagination, cursor validation, duplicate retries and rate limiting. A deployed multi-client browser/concurrency test is still recommended before live rollout. Native app chat is outside this web widget update.

## Hotel logo and booking confirmation correction

- Replaced header/footer/login/admin text marks with the supplied hotel logo, added its browser icon and updated the mobile login image. The Docker runtime copies public assets so the logo is available after deployment.
- Reproduced the confirmation failure with the actual transition service and PostgreSQL: parameter $3 was inferred as both text and booking_status (42P08). Explicit enum casts fix confirmation and check-in. Tests cover legacy unnumbered reservations, numbered reservations, check-in, selection preservation and stale status rejection. No new database migration is needed for this correction.
