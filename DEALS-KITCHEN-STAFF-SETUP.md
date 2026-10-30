# Deals, Kitchen and Staff Setup — Docker PostgreSQL Edition

1. Ensure Docker Desktop is running and PostgreSQL is healthy: `docker compose ps`.
2. Run the Next.js project: `npm run dev`.
3. Sign in as the Super Admin, created with `npm run create-admin`.
4. Open `/admin/deals-kitchen` to add or publish Deals and Kitchen catalogue items.
5. Open `/admin/staff` to create staff accounts with an initial password and a job-specific role.

Roles: `super_admin` manages every module and staff accounts; `manager` manages hotel operations/catalogue but cannot create staff accounts; `receptionist` works on reservations and guest requests; `kitchen_staff` handles kitchen/dining; `deals_staff` handles deals; `service_staff` handles non-kitchen/non-deals service orders; `accountant` sees payment/finance records.

The application uses local PostgreSQL via Docker. Database credentials are read on the server only. Staff role checks are implemented in Next.js/API route handlers and sensitive state transitions use PostgreSQL transactions. Production deployment still needs a unique session secret, backups, TLS, a production SMS gateway, and an approved payment provider adapter.
