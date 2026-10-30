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
- Each `rooms` record currently represents one reservable inventory unit: the schema prevents overlapping pending, confirmed or checked-in stays for that record. It does **not** track a quantity of interchangeable rooms per room type. Create separate inventory records/slugs for separate reservable rooms, or implement room-type inventory before selling multiple units of the same type.
- Pending requests block inventory until staff confirms/rejects them. Add an operational expiry policy if requests should expire automatically.
- Real customer OTP requires a configured SMS service. The generic SMS adapter must be matched to your provider's actual API. The fixed development OTP is disabled in production.
- MyanMyanPay/Dinger integrations need approved merchant credentials and provider sandbox verification. No real payment or refund was made. Gateway refund reconciliation is outside this review.
- Apply rate limiting at the HTTPS reverse proxy, particularly staff login and OTP routes, before exposing the app publicly.
- Payment checkouts left pending must be reconciled with the provider before a new attempt; do not simply delete pending/paid records.
- The supplied Expo source remains available under `mobile/`; its build and device behavior were not tested in this web booking review.
- Back up PostgreSQL and the upload volume. No real customer data or payment credentials are included in the repository.

## Customer login update

- Email-first customer login followed by local 09 phone input and a six-digit SMS OTP. Email is an account identifier, not a verified inbox.
- Staff/Admin email/password login does not ask for a phone number. Admin destinations default to the Staff tab.
- OTPs are bound to both email and phone. Existing email/phone mismatches, disabled accounts and all staff accounts are rejected by customer OTP routes. Existing phone-only accounts may safely attach a previously unused email after phone verification.
- Migration 006 adds OTP email binding while preserving users, profiles and bookings.
- Web unit tests and HTTP smoke tests cover input validation, identity binding, account takeover prevention and the initial guest/staff forms. A PostgreSQL-backed end-to-end login still needs staging verification. Mobile source is updated to send email alongside OTP requests; a native device build was not tested.
