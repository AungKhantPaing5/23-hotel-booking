import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BedDouble, Coffee, MapPin,
  ShieldCheck, Sparkles, Waves, Wifi, Utensils, Users,
} from "lucide-react";
import Header from "@/components/Header";
import { createClient } from "@/lib/db/client";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const fallbackImages = [
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1100&q=85",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1100&q=85",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1100&q=85",
];

export default async function Home() {
  const hotelDb = await createClient();
  const { data: rooms } = await hotelDb
    .from("rooms")
    .select("id,name,slug,description,nightly_rate,capacity,features,image_url")
    .eq("is_active", true)
    .order("display_order");
  const hotelName = process.env.NEXT_PUBLIC_HOTEL_NAME || "23 Hotel & Residence";
  const hotelAddress = process.env.NEXT_PUBLIC_HOTEL_ADDRESS || "Yangon, Myanmar";

  return (
    <>
      <Header />
      <main>
        <section className="hero-luxury">
          <div className="hero-luxury__image" aria-hidden="true" />
          <div className="hero-luxury__wash" aria-hidden="true" />
          <div className="site-container hero-luxury__inner">
            <div className="hero-copy">
              <div className="eyebrow eyebrow--light"><span className="eyebrow__rule" /> A DIFFERENT KIND OF CITY STAY</div>
              <h1 className="hero-title">Arrive. Unwind.<br /><em>Feel at home.</em></h1>
              <p className="hero-description">
                Considered spaces, warm hospitality, and thoughtful little details. Find your own pace at {hotelName}.
              </p>
              <div className="hero-actions">
                <Link href="#rooms" className="button button--champagne">Discover our rooms <ArrowUpRight size={16} /></Link>
                <Link href="/my-bookings" className="hero-text-link">Manage a booking <ArrowRight size={15} /></Link>
              </div>
              <div className="hero-note"><span className="hero-note__dot" /> A calm, welcoming stay in Yangon</div>
            </div>
            <div className="hero-art-card">
              <div className="hero-art-card__image" />
              <div className="hero-art-card__bottom">
                <div><span className="micro-label">YOUR SPACE TO RESET</span><p>Comfort, with intention.</p></div>
                <span className="hero-art-card__number">23</span>
              </div>
            </div>
            <div className="hero-index"><span>01</span><span className="hero-index__line" /><span>03</span></div>
          </div>
        </section>

        <section className="benefit-bar" aria-label="Hotel highlights">
          <div className="site-container benefit-bar__inner">
            <div className="benefit-item"><span className="benefit-item__icon"><ShieldCheck size={19} /></span><div><strong>Stay with confidence</strong><span>Clear booking updates</span></div></div>
            <div className="benefit-item"><span className="benefit-item__icon"><Sparkles size={19} /></span><div><strong>Thoughtful comfort</strong><span>Details that make a difference</span></div></div>
            <div className="benefit-item"><span className="benefit-item__icon"><Coffee size={19} /></span><div><strong>Service on your terms</strong><span>Your stay, your rhythm</span></div></div>
            <div className="benefit-bar__aside"><span>DESIGNED FOR EVERY KIND OF STAY</span><span className="benefit-bar__spark">✳</span></div>
          </div>
        </section>

        <section id="rooms" className="rooms-section site-container">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow"><span className="eyebrow__rule" /> REST, RECHARGE, REPEAT</p>
              <h2 className="section-title">A room to call <em>yours.</em></h2>
              <p className="section-description">Whether you are visiting for a night or settling in a little longer, find a space that feels right.</p>
            </div>
            <div className="section-heading-row__side"><span className="availability-dot" /> RATES IN MMK · PER NIGHT</div>
          </div>

          <div className="room-grid">
            {(rooms || []).map((room: any, index: number) => (
              <article className={`room-card ${index === 0 ? "room-card--featured" : ""}`} key={room.id}>
                <Link href={`/rooms/${room.slug}`} className="room-card__image-link" aria-label={`View ${room.name}`}>
                  <div className="room-card__image" style={{ backgroundImage: `url(${room.image_url || fallbackImages[index % fallbackImages.length]})` }} />
                  <span className="room-card__label">{index === 0 ? "GUEST FAVOURITE" : `ROOM ${String(index + 1).padStart(2, "0")}`}</span>
                  <span className="room-card__open"><ArrowUpRight size={18} /></span>
                </Link>
                <div className="room-card__body">
                  <div className="room-card__topline"><span className="room-card__category">ROOMS & RESIDENCES</span><span className="room-card__capacity"><Users size={13} /> {room.capacity} guests</span></div>
                  <h3>{room.name}</h3>
                  <p className="room-card__description">{room.description || "A calm, comfortable space with the essentials considered."}</p>
                  <div className="room-card__bottom"><div><strong>{money(Number(room.nightly_rate))}</strong><span> / night</span></div><Link href={`/rooms/${room.slug}`} className="room-card__link">Explore room <ArrowRight size={14} /></Link></div>
                </div>
              </article>
            ))}
            {(!rooms || rooms.length === 0) && (
              <div className="empty-rooms"><BedDouble size={28} /><h3>Your next stay is taking shape.</h3><p>Room listings will appear here once active rooms have been added in the database.</p><Link href="/login" className="button button--outline">Staff sign in <ArrowUpRight size={15} /></Link></div>
            )}
          </div>
        </section>

        <section id="experiences" className="experience-section">
          <div className="site-container experience-section__inner">
            <div className="experience-copy">
              <p className="eyebrow eyebrow--light"><span className="eyebrow__rule" /> MORE THAN A ROOM</p>
              <h2 className="section-title section-title--light">Make room for<br /><em>the good things.</em></h2>
              <p className="experience-copy__description">From a refreshing swim to a quiet meal or an extra touch of comfort, the little things can make a stay feel special.</p>
              <Link href="/services" className="button button--champagne">Explore hotel services <ArrowUpRight size={15} /></Link>
              <div className="experience-signature"><span>23</span><span>STAY A LITTLE BETTER</span></div>
            </div>
            <div className="experience-cards">
              <Link href="/services" className="experience-card experience-card--pool"><div className="experience-card__image" /><span className="experience-card__icon"><Waves size={19} /></span><div className="experience-card__copy"><span>01 / WELLNESS</span><h3>Swim & reset</h3><p>A refreshing pause in your day.</p></div><ArrowUpRight className="experience-card__arrow" size={18} /></Link>
              <Link href="/services" className="experience-card experience-card--dining"><div className="experience-card__image" /><span className="experience-card__icon"><Utensils size={19} /></span><div className="experience-card__copy"><span>02 / DINING</span><h3>Good things to eat</h3><p>Thoughtful bites and special deals.</p></div><ArrowUpRight className="experience-card__arrow" size={18} /></Link>
              <Link href="/services" className="experience-card experience-card--comfort"><div className="experience-card__image" /><span className="experience-card__icon"><Wifi size={19} /></span><div className="experience-card__copy"><span>03 / COMFORT</span><h3>Just ask</h3><p>Request what you need, when you need it.</p></div><ArrowUpRight className="experience-card__arrow" size={18} /></Link>
            </div>
          </div>
        </section>

        <section id="location" className="location-section site-container">
          <div className="location-copy">
            <p className="eyebrow"><span className="eyebrow__rule" /> EASY TO FIND, EASY TO SETTLE IN</p>
            <h2 className="section-title">Your next stop<br /><em>is right here.</em></h2>
            <p className="section-description">Plan your route before you arrive, and let the rest of the journey slow down.</p>
            <div className="location-address"><span className="location-address__icon"><MapPin size={18} /></span><div><span>FIND US</span><strong>{hotelAddress}</strong></div></div>
            <a className="button button--navy" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelAddress || "23 Hotel & Residence, Yangon, Myanmar")}`}>Get road directions <ArrowUpRight size={15} /></a>
          </div>
          <div className="location-visual">
            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
              <iframe title="Map and directions to 23 Hotel & Residence" className="location-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(hotelAddress || "23 Hotel & Residence, Yangon, Myanmar")}`} />
            ) : (
              <div className="location-map-placeholder"><div className="map-grid" /><span className="map-pin"><MapPin size={22} /></span><div className="map-place-card"><span className="map-place-card__mark">23</span><div><strong>23 Hotel & Residence</strong><span>{hotelAddress}</span></div></div><span className="map-hint">Add your Google Maps API key to embed the map</span></div>
            )}
            <div className="location-visual__badge"><MapPin size={15} /><span>YOUR ROUTE, MADE SIMPLE</span></div>
          </div>
        </section>

        <section className="closing-cta"><div className="site-container closing-cta__inner"><div><p className="eyebrow eyebrow--light">YOUR TIME, WELL SPENT</p><h2>Good stays leave<br /><em>room to remember.</em></h2></div><Link href="/#rooms" className="button button--champagne">Find your room <ArrowUpRight size={16} /></Link></div></section>
      </main>
      <footer className="site-footer"><div className="site-container site-footer__top"><Link href="/" className="brand brand--footer"><BrandLogo size={48}/><span className="brand__copy"><span className="brand__name">23 Hotel & Residence</span><span className="brand__tagline">A CONSIDERED CITY STAY</span></span></Link><p className="site-footer__note">Thoughtfully yours, from check-in to check-out.</p><nav className="site-footer__links" aria-label="Footer navigation"><Link href="/login">Guest sign in</Link><Link href="/my-bookings">My bookings</Link><Link href="/admin">Staff portal</Link></nav></div><div className="site-container site-footer__bottom"><span>© {new Date().getFullYear()} 23 Hotel & Residence. All rights reserved.</span><span>MADE FOR A BETTER STAY</span></div></footer>
    </>
  );
}
