import { withTransaction } from "@/lib/db/pool";
import { customerEmail } from "@/lib/customer-login";
import { verifyPassword } from "@/lib/db/password";

// Equal-cost verification for unknown accounts; this is not a login credential.
const DUMMY_HASH=`scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;
export async function customerPasswordLogin(rawEmail: unknown, password: string) {
  const email=customerEmail(rawEmail);
  if (!password || password.length>256) return {status:400 as const,error:"Enter your email and password."};
  return withTransaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`customer-email:${email}`]);
    await client.query("INSERT INTO auth_password_attempts(email) VALUES($1) ON CONFLICT(email) DO NOTHING",[email]);
    const attempt=(await client.query<{attempts:number;expired:boolean}>("SELECT attempts,(window_started_at<now()-interval '15 minutes') AS expired FROM auth_password_attempts WHERE email=$1 FOR UPDATE",[email])).rows[0];
    if(attempt.expired) await client.query("UPDATE auth_password_attempts SET attempts=0,window_started_at=now() WHERE email=$1",[email]);
    else if(attempt.attempts>=10) return {status:429 as const,error:"Too many login attempts. Try again in 15 minutes."};
    const user=(await client.query<{id:string;email:string;phone:string|null;full_name:string;password_hash:string|null;session_version:number;is_enabled:boolean;is_staff:boolean}>(
      `SELECT u.id,u.email,u.phone,u.full_name,u.password_hash,u.session_version,u.is_enabled,
       EXISTS(SELECT 1 FROM staff_profiles sp WHERE sp.user_id=u.id) AS is_staff
       FROM users u WHERE lower(u.email)=$1 LIMIT 1 FOR UPDATE OF u`,[email])).rows[0];
    const valid=await verifyPassword(password,user?.password_hash || DUMMY_HASH);
    if(!user || !valid || !user.is_enabled || user.is_staff || !user.phone) {
      await client.query("UPDATE auth_password_attempts SET attempts=attempts+1 WHERE email=$1",[email]);
      return {status:401 as const,error:"Incorrect email or password. If your account used OTP before, choose Set or reset password. Staff must use the staff login page."};
    }
    await client.query("DELETE FROM auth_password_attempts WHERE email=$1",[email]);
    return {status:200 as const,user:{id:user.id,email:user.email,phone:user.phone,full_name:user.full_name,session_version:user.session_version}};
  });
}
