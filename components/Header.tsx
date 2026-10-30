import { getCurrentUser } from "@/lib/db/session";
import HeaderClient from "@/components/HeaderClient";

export default async function Header() {
  const user = await getCurrentUser();
  return <HeaderClient user={user ? { full_name: user.full_name, email: user.email, phone: user.phone } : null} />;
}
