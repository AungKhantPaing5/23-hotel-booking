import { ROOM_AVAILABILITY_SQL } from "@/lib/room-availability";
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/pool";
import { hotelToday } from "@/lib/hotel-date";
export const runtime = "nodejs";
const schema = z.object({roomId:z.string().uuid(),checkIn:z.iso.date(),checkOut:z.iso.date()});
export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || parsed.data.checkIn<hotelToday() || parsed.data.checkOut<=parsed.data.checkIn) return NextResponse.json({error:"Choose valid check-in and check-out dates."},{status:400});
  const {roomId,checkIn,checkOut} = parsed.data;
  try {
    const result = await query<{room_number:string}>(ROOM_AVAILABILITY_SQL,[roomId,checkIn,checkOut]);
    return NextResponse.json({roomNumbers:result.rows.map(row=>row.room_number)},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { console.error("Room availability failed",error);return NextResponse.json({error:"Could not load available room numbers."},{status:503}); }
}
