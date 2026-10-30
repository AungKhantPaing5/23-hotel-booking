import type { PoolClient } from "pg";
import { matchingCustomer, type CustomerAccount } from "@/lib/customer-login";

export async function lockCustomer(client: PoolClient, email: string, phone: string) {
  // Always acquire identity locks in the same order across request and verification.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`customer-email:${email}`]);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`customer-phone:${phone}`]);
  const result = await client.query<CustomerAccount>(
    `SELECT u.id,u.email,u.phone,u.full_name,u.is_enabled,
       EXISTS(SELECT 1 FROM staff_profiles sp WHERE sp.user_id=u.id) AS is_staff
     FROM users u WHERE lower(u.email)=$1 OR u.phone=$2 FOR UPDATE OF u`, [email, phone]);
  return matchingCustomer(result.rows, email, phone);
}
