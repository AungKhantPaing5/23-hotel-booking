import Link from "next/link";
import Header from "@/components/Header";
import { createClient } from "@/lib/db/client";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Services() {
  const hotelDb = await createClient();
  const { data: services } = await hotelDb
    .from("services")
    .select("id,name,description,price,category,availability_note,image_url")
    .eq("is_active", true)
    .order("display_order");

  return <>
    <Header />
    <main className="container py-14">
      <p className="eyebrow">PERSONALIZE YOUR STAY</p>
      <h1 className="serif mt-2 text-4xl">Hotel services & deals</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[#6f7886]">Discover the little extras available during your stay. Sign in to submit a service request.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(services || []).map((service: any) => <article className="panel overflow-hidden" key={service.id}>
          {service.image_url ? <img src={service.image_url} alt={service.name} className="h-48 w-full object-cover" loading="lazy" /> : <div className="flex h-32 items-center justify-center bg-[#f5efe3] text-3xl text-[#92703c]">{String(service.category).toLowerCase() === "deals" ? "✦" : "♨"}</div>}
          <div className="p-5">
            <p className="eyebrow">{service.category}</p>
            <h2 className="serif mt-2 text-2xl">{service.name}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-[#6f7886]">{service.description}</p>
            <p className="mt-4 font-semibold">{Number(service.price) === 0 ? "Complimentary" : money(Number(service.price))}</p>
            <p className="mt-2 text-xs text-[#6f7886]">{service.availability_note}</p>
            <Link className="btn btn-primary mt-5 w-full" href={`/services/${service.id}/order`}>{String(service.category).trim().toLowerCase() === "deals" ? "Order deal" : "Request service"}</Link>
          </div>
        </article>)}
        {(!services || services.length === 0) && <div className="panel p-6 text-sm text-[#6f7886] sm:col-span-2 lg:col-span-3">Services will appear here after the database migration and service setup.</div>}
      </div>
    </main>
  </>;
}
