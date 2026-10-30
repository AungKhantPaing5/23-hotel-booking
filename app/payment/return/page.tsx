import Link from "next/link";
import Header from "@/components/Header";
export default function PaymentReturnPage() {
  return <><Header /><main className="container py-16"><section className="panel mx-auto max-w-xl p-8 text-center"><p className="eyebrow">PAYMENT UPDATE</p><h1 className="serif mt-2 text-3xl">Check your verified payment status</h1><p className="mt-4 text-sm leading-6 text-[#6f7886]">The payment provider has returned you to the hotel website. This return page does not itself confirm that money was received. Your booking will show a paid deposit only after the provider&apos;s signed callback is verified.</p><Link href="/my-bookings" className="btn btn-primary mt-6">View my bookings</Link></section></main></>;
}
