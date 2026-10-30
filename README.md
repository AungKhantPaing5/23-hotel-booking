# 23 Hotel & Residence — Docker PostgreSQL Edition

Customer Website + Admin Dashboard + Android/iOS customer app. This edition does not require any hosted database account. The database is PostgreSQL running locally in Docker; the Next.js server talks to it through a private server-only connection. The browser and Expo app call the hotel's API and never connect directly to PostgreSQL.

## Customer email and phone login

Customers enter an email first, then an **11-digit Myanmar mobile number starting with 09**, then the SMS OTP. No customer password is required in this flow. The email identifies the account; the SMS code verifies control of the phone, not ownership of the email inbox. Returning customers must use their registered email and phone combination. A previous phone-only customer may add an unused email after phone verification without losing bookings.

Staff/Admin keep email + password login with no phone prompt. `/staff/login?next=/admin` opens the separate staff login page. Customer OTP never signs into staff accounts, including inactive staff.

**Existing installations must apply migration 006 before restarting:**

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U hotel_app -d 23hotel < docker/postgres/migrations/006_customer_email_otp.sql
```

Use your configured database username/name if different. Production Compose users should add `-f compose.production.yml` after `docker compose`. Existing sessions and bookings are preserved; pending old OTP codes must be requested again. Fresh installations include the new column automatically.

In local development the OTP remains `123456`. Production requires a working SMS provider and a random `OTP_SECRET` of at least 32 characters. The app converts local `09` input to the existing international database/SMS representation internally.

## Reviewed booking release

See [REVIEW.md](REVIEW.md) for fixes, verification and remaining deployment requirements.

### Production Docker deployment

1. Copy `.env.example` to `.env`. Set a unique database password, random `SESSION_SECRET` and `OTP_SECRET`, your public HTTPS URL and approved SMS/payment credentials. Use an alphanumeric database password (or URL-encode it in the connection string).
2. Start the application:

```bash
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml exec web node scripts/create-admin.mjs
```

3. Put an HTTPS reverse proxy in front of `127.0.0.1:3000`. Production cookies require HTTPS. Add rate limiting to login and OTP endpoints.
4. For existing databases, back up first and apply every outstanding migration in `docker/postgres/migrations/` in filename order. Initialization scripts only run on an empty database volume. Migration 005 intentionally stops if duplicate active deposit records exist; reconcile these before retrying.

A room record is a single reservable unit, not a room type with stock quantity. Separate physical inventory needs separate room records in this version.

### Run checks

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

The mobile project has its own dependencies and build under `mobile/`.

## Stack

- Web + Admin: Next.js App Router, React, TypeScript, Tailwind CSS
- Mobile: Expo React Native (Android + iOS)
- Database: PostgreSQL in Docker Compose
- Auth: local application auth with signed HTTP-only web cookies and bearer tokens for mobile; salted `scrypt` password hashes for staff accounts
- Customer phone verification: local dev OTP (`123456`) only in development; production requires an SMS provider
- Maps: Google Maps road-directions link, with optional embedded map key
- Payment integrations: MyanMyanPay MMQR QR checkout and Dinger hosted wallet/bank/card checkout adapters; live use still requires merchant approval, real credentials, enabled methods, and provider sandbox verification

## Requirements on Windows

1. Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Install Node.js 22 LTS or later.
3. Use PowerShell from the project root.

## First run (Windows PowerShell)

For a Burmese walkthrough, see [`SETUP-WINDOWS-MYANMAR.md`](./SETUP-WINDOWS-MYANMAR.md).

```powershell
# 1. In the root folder, create the environment files
Copy-Item .env.example .env
Copy-Item .env.example .env.local

# 2. Start the local PostgreSQL container
npm run db:up

# 3. Check container status and logs
 docker compose ps
 docker compose logs --tail 80 db

# 4. Install web dependencies
npm install

# 5. Create or reset the first Super Admin account interactively
npm run create-admin

# 6. Start the web customer site and admin dashboard
npm run dev
```

Open `http://localhost:3000`. Sign in at `http://localhost:3000/staff/login?next=/admin` using the email and password entered in `npm run create-admin`. You can run the admin creation command again later to reset the password for that email and ensure its `super_admin` role.

The SQL schema and demo room/service rows are initialized automatically when Docker creates a **new empty database volume**.

### If Docker's database was already initialized without the schema

The initialization folder runs only when PostgreSQL initializes a fresh data directory. If this is a brand-new local setup and you are certain the volume contains no data you need, reset it with:

```powershell
# WARNING: this permanently deletes the local 23hotel database volume.
docker compose down -v
docker compose up -d db
```

Do not run `down -v` if you have bookings or customer information you need to keep. For a populated database, apply a reviewed SQL migration/backup procedure instead.

## Customer login and OTP

In local development (`npm run dev`), enter your email, then an 11-digit `09` phone number, request an OTP and use `123456`. It is intentionally a predictable development-only code; the server refuses to use the development code when `NODE_ENV=production`. In production, set `AUTH_OTP_MODE=production`, configure `SMS_API_URL`, `SMS_API_KEY` and `SMS_SENDER_ID` to match your chosen SMS vendor's actual API, and test delivery/rate limits. Do not deploy with local OTP enabled.

## Add rooms and manage deals/kitchen

1. Sign in as Super Admin.
2. Open `/admin/rooms` to add/update room listings. Active rooms appear on the customer website and mobile app via the local API.
3. Open `/admin/deals-kitchen` to create/publish Kitchen and Deals catalogue items. Upload a JPG/PNG/WebP photo up to 5 MB; active service/deal photos appear on the website and mobile app.
4. Open `/admin/staff` to create employee accounts with initial passwords and job-specific roles. This edition does not depend on SMTP invitations.

### Staff access

- `super_admin`: all hotel administration, including staff account management
- `manager`: room/catalogue/booking/order/request/finance operations, but cannot create staff accounts
- `receptionist`: reservations and guest requests
- `kitchen_staff` / legacy `order_staff`: kitchen and dining orders only
- `deals_staff`: deals orders only
- `service_staff`: non-kitchen, non-deals hotel service orders
- `accountant`: payment/finance pages only

The admin APIs check roles server-side. A worker's order action also checks the category and assignment in a database transaction. PostgreSQL is bound to the PC loopback address `127.0.0.1:55432`, not the LAN; only the Next.js server connects to it. Phones connect to the Next.js API on port 3000.

## Run the Android/iOS app

Keep the web server and Docker database running. In another PowerShell window:

```powershell
Set-Location .\mobile
Copy-Item .env.example .env
notepad .env
npm install
npx expo install --fix
npx expo start
```

Change `EXPO_PUBLIC_API_URL` in `mobile/.env` before starting Expo:

- Physical Android/iPhone: `http://YOUR_WINDOWS_PC_LAN_IP:3000` (find with `ipconfig`, use the IPv4 address of the same Wi-Fi network)
- Android Emulator: `http://10.0.2.2:3000`
- Expo Web / same PC browser: `http://localhost:3000`

Allow Node.js/port 3000 through Windows Firewall on your **Private network only** if the physical phone cannot reach the API. PostgreSQL port 55432 does not need to be exposed to the phone.

Install Expo Go and scan the QR code for development preview. For store-ready native builds, configure EAS Build; a locally built iOS app requires macOS/Xcode.

## Common commands

```powershell
npm run db:up       # Start Docker PostgreSQL
npm run db:down     # Stop PostgreSQL (keeps data)
npm run db:logs     # Follow database logs
npm run create-admin
npm run typecheck
npm run lint
npm run build
```

## Environment files and security

- `.env` is read by Docker Compose. `.env.local` is read by Next.js. Keep `POSTGRES_PASSWORD` and `SESSION_SECRET` consistent between them.
- Change the local development secrets before deploying. Production must use a unique random `SESSION_SECRET` with at least 32 characters.
- Never put `DATABASE_URL`, database passwords, SMS keys or payment secrets in `NEXT_PUBLIC_*` variables or in `mobile/.env`.
- Set backups, TLS/reverse proxy, rate limits, monitoring, logging and privacy retention before exposing the service to the internet.

## What still requires external providers

- Live booking SMS and OTP SMS require an SMS gateway and the exact vendor request/response format.
- Live transactions are not enabled by code alone: configure approved MyanMyanPay/Dinger merchant credentials, enable the required methods in the merchant portal, set public HTTPS callback/return URLs, and complete provider sandbox/live acceptance testing. A button, return URL or screenshot is not proof of payment.
- Google Maps embeds need an appropriately restricted Google Maps API key; the directions link does not require that key.

## Verification status

The Docker database schema, app source and configuration are included. The project must still be installed and tested on your Windows machine with Docker Desktop, including login, room creation, booking overlap, staff-role access and mobile device API reachability. This generated bundle has not been tested against your specific Windows/Docker installation.


### Kitchen and Deals image uploads

- In Admin → Deals & Kitchen, choose **Add Kitchen item** or **Add a Deal**, then select a JPG, PNG, or WebP photo (maximum 5 MB).
- Image files are stored locally under `storage/services/`; PostgreSQL stores the relative URL in `services.image_url`. Back up this folder along with the database.
- Fresh Docker databases include the `image_url` column in `001_schema.sql`. If the database volume already existed before this update, apply the migration once from the project root while Docker PostgreSQL is running:

```powershell
Get-Content .\docker\postgres\migrations\002_services_image_url.sql | docker compose exec -T db psql -U hotel_app -d 23hotel
```

- Published item photos are shown on the website `/services` page and the Expo mobile Services & deals tab. The app resolves the relative image path through `EXPO_PUBLIC_API_URL`.

## Booking deposits and catalogue photos

- Room photos and Kitchen/Deals photos are uploaded as image files (JPG, PNG, WebP; max 5 MB) and stored under `storage/rooms` and `storage/services`. Do not enter external image URLs for new uploads.
- After the hotel confirms a reservation, the customer can start a deposit payment from **My bookings** in the web app or mobile app. The default deposit is 30% of the booking total; set `BOOKING_DEPOSIT_PERCENT` in `.env.local` and `.env` to change it. Set `NEXT_PUBLIC_BOOKING_DEPOSIT_PERCENT` to the same value for the website label, and `EXPO_PUBLIC_BOOKING_DEPOSIT_PERCENT` in `mobile/.env` for the mobile label. The server is authoritative for the amount.
- Run migration 003 for `payments.payment_type` and migration 004 for assigned room numbers against an existing database. The fresh init schema includes both changes.
- Deposit methods: MMQR through MyanMyanPay and hosted wallets/banks/cards through Dinger. Live transactions require approved merchant credentials, enabled methods, public HTTPS callback/return URLs, and sandbox/live acceptance testing. A browser redirect alone never marks a payment as paid.


## New customer booking, room assignment, images and deposits

- Kitchen/Deals and room photo files are written into `storage/services` and `storage/rooms`; application routes under `/uploads/...` serve those images. Files live on the server/container disk, so add persistent storage for the `storage` directory when deploying.
- Customers must sign in to request a room, and service/deal orders must reference their own confirmed or checked-in booking. Orders are linked to that booking and show the booking code/room after check-in.
- Reception can assign a physical room number when changing a confirmed reservation to `checked_in`. The database prevents the same physical room number being assigned to two checked-in guests at once.
- A confirmed booking requires a configurable deposit (`BOOKING_DEPOSIT_PERCENT`, default 30%). Online methods are MMQR through MyanMyanPay and hosted wallets/banks/cards through Dinger. Real payment acceptance requires approved merchant credentials, enabled payment methods, a public HTTPS URL, provider dashboard callback/return URL configuration, and sandbox/live acceptance testing. The app only marks payments paid after a signed/verified provider callback; a browser redirect alone never marks a payment as paid.
- Existing databases must apply both migrations 003 and 004 once. Fresh databases created from `docker/postgres/init/001_schema.sql` already have the room assignment column, but running migration 004 is safe.

Customer login is `/login`. Staff login is separately available at `/staff/login`; the customer page has no staff tab or staff login link.

Legacy URLs such as `/login?next=/admin` automatically redirect to `/staff/login` and require only staff email/password, without phone or OTP.
