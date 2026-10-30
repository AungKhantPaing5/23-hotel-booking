import {requireStaff} from "@/lib/auth";
import SupportInbox from "@/components/support/SupportInbox";
export const dynamic="force-dynamic";
export default async function SupportPage(){
  await requireStaff(["super_admin","manager","receptionist","support_staff"]);
  return <><p className="eyebrow">CUSTOMER CARE</p><h1 className="serif mt-2 text-3xl">Support chat</h1><p className="mt-2 mb-6 text-sm text-[#6f7886]">Read customer messages, reply and mark conversations resolved. New messages refresh automatically.</p><SupportInbox/></>;
}
