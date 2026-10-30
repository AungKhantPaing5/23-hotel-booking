"use client";
import { hotelToday } from "@/lib/hotel-date";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Availability = {key:string; numbers:string[]; loading:boolean; error:string};
export default function BookingForm({roomId,roomName,price,capacity=2}:{roomId:string;roomName:string;price:number;capacity?:number}) {
  const router=useRouter();
  const [checkIn,setCheckIn]=useState(""); const [checkOut,setCheckOut]=useState("");
  const [roomNumber,setRoomNumber]=useState("");
  const [guests,setGuests]=useState(String(Math.min(2,capacity)));
  const [note,setNote]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [availability,setAvailability]=useState<Availability>({key:"",numbers:[],loading:false,error:""});
  const today=hotelToday(); const key=`${roomId}:${checkIn}:${checkOut}`;
  const validDates=Boolean(checkIn && checkOut && checkIn>=today && checkOut>checkIn);
  const ready=validDates && availability.key===key && !availability.loading && !availability.error;
  useEffect(()=>{
    if (!validDates) return;
    const controller=new AbortController();
    setAvailability({key,numbers:[],loading:true,error:""});
    fetch(`/api/public/room-availability?${new URLSearchParams({roomId,checkIn,checkOut})}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error || "Could not check room availability.");return data;})
      .then(data=>{if(!controller.signal.aborted)setAvailability({key,numbers:data.roomNumbers || [],loading:false,error:""});})
      .catch(failure=>{if(!controller.signal.aborted)setAvailability({key,numbers:[],loading:false,error:failure instanceof Error?failure.message:"Could not load room numbers."});});
    return ()=>controller.abort();
  },[roomId,checkIn,checkOut,key,validDates,refresh]);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setError("");
    if (!ready || !availability.numbers.includes(roomNumber)) {setError("Choose an available room number for your stay dates.");return;}
    setBusy(true);
    try {
      const response=await fetch("/api/bookings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({roomId,roomNumber,checkIn,checkOut,guests:Number(guests),note})});
      const data=await response.json();
      if(response.status===401){router.push("/login?next=/my-bookings");return;}
      if(!response.ok){setRoomNumber("");setRefresh(value=>value+1);throw new Error(data.error || "Could not create booking.");}
      router.push("/my-bookings?created=1");router.refresh();
    } catch(failure){setError(failure instanceof Error?failure.message:"Something went wrong.");}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="grid gap-4">
    <div className="rounded bg-[#f6f7f2] p-3"><p className="text-xs text-[#6d796f]">Room type</p><p className="font-semibold">{roomName}</p><p className="text-sm">{price.toLocaleString()} MMK <span className="text-xs text-[#78847b]">/ night</span></p></div>
    <label className="field">CHECK-IN<input className="control" type="date" min={today} required value={checkIn} disabled={busy} onChange={event=>{setCheckIn(event.target.value);setRoomNumber("");}}/></label>
    <label className="field">CHECK-OUT<input className="control" type="date" min={checkIn || today} required value={checkOut} disabled={busy} onChange={event=>{setCheckOut(event.target.value);setRoomNumber("");}}/></label>
    <label className="field">ROOM NUMBER<select className="control" required value={roomNumber} disabled={busy || !ready || !availability.numbers.length} onChange={event=>setRoomNumber(event.target.value)}>
      <option value="">{!validDates?"Choose stay dates first":availability.loading?"Checking availability…":"Select a room number"}</option>
      {ready && availability.numbers.map(number=><option key={number} value={number}>{number}</option>)}
    </select></label>
    {ready && !availability.numbers.length && <p role="status" className="text-sm text-[#977444]">No available room numbers for these dates. Try different dates or contact reception.</p>}
    {availability.key===key && availability.error && <div role="alert" className="text-sm text-red-700">{availability.error} <button type="button" className="underline" onClick={()=>setRefresh(value=>value+1)}>Retry</button></div>}
    <label className="field">GUESTS<select className="control" value={guests} disabled={busy} onChange={event=>setGuests(event.target.value)}>{Array.from({length:Math.min(20,capacity)},(_,i)=>i+1).map(number=><option key={number} value={number}>{number} guest{number>1?"s":""}</option>)}</select></label>
    <label className="field">SPECIAL REQUEST (OPTIONAL)<textarea className="control" rows={3} maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} placeholder="Arrival time, accessibility or other requests"/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className="btn btn-primary w-full" disabled={busy || !ready || !roomNumber}>{busy?"Submitting…":"Request a reservation"}</button>
    <p className="text-xs leading-5 text-[#6f7886]">Your selected room number is held while the hotel reviews your request. Payment is not collected by this form.</p>
  </form>;
}
