import Link from "next/link";
export default function SetPasswordPage() {
  return <main className="container py-20"><div className="panel mx-auto max-w-lg p-7"><p className="eyebrow">STAFF ACCOUNT</p><h1 className="serif mt-2 text-3xl">Staff accounts are managed locally</h1><p className="mt-3 text-sm leading-6 text-[#6f7886]">The Super Admin creates employee accounts from the Staff & Roles page and sets an initial password. Email invitations are not used by this Docker edition.</p><Link href="/login?next=/admin" className="btn btn-primary mt-6 inline-flex">Go to staff login</Link></div></main>;
}
