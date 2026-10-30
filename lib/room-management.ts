import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { withTransaction } from "@/lib/db/pool";
import { roomFields } from "@/lib/room-inventory";

export async function saveRoom(request: Request, id?: string) {
  try {
    await requireStaffApi(["super_admin","manager"]);
    const raw = await request.json();
    const parsed = (id ? roomFields.partial().refine(value=>Object.keys(value).length>0,"No changes provided.") : roomFields).safeParse(raw);
    if (!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message || "Check room details."},{status:400});
    const {room_numbers:numbers,...fields} = parsed.data;
    const room = await withTransaction(async client => {
      let roomId = id;
      if (roomId) {
        const locked = await client.query("SELECT id FROM rooms WHERE id=$1 FOR UPDATE",[roomId]);
        if (!locked.rowCount) return null;
        const entries = Object.entries(fields).map(([key,value])=>[key,key==='image_url' ? value || null : value] as const);
        if (entries.length) await client.query(`UPDATE rooms SET ${entries.map(([key],i)=>`"${key}"=$${i+2}`).join(',')} WHERE id=$1`,[roomId,...entries.map(([,value])=>value)]);
      } else {
        const entries = Object.entries(fields).map(([key,value])=>[key,key==='image_url' ? value || null : value] as const);
        roomId = (await client.query<{id:string}>(`INSERT INTO rooms (${entries.map(([key])=>`"${key}"`).join(',')}) VALUES(${entries.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,entries.map(([,value])=>value))).rows[0].id;
      }
      if (numbers) {
        // A primary key prevents one physical room being listed under multiple types.
        for (const number of [...numbers].sort()) {
          const saved = await client.query(`INSERT INTO room_units(room_number,room_id) VALUES($1,$2)
            ON CONFLICT(room_number) DO UPDATE SET is_active=true WHERE room_units.room_id=EXCLUDED.room_id RETURNING room_number`,[number,roomId]);
          if (!saved.rowCount) throw new Error("ROOM_NUMBER_USED_BY_OTHER_TYPE");
        }
        // Soft removal preserves all historical booking foreign keys.
        await client.query("UPDATE room_units SET is_active=false WHERE room_id=$1 AND NOT(room_number=ANY($2::text[])) AND is_active=true",[roomId,numbers]);
      }
      return (await client.query(`SELECT r.*,ARRAY(SELECT room_number FROM room_units u WHERE u.room_id=r.id AND u.is_active ORDER BY room_number) AS room_numbers FROM rooms r WHERE r.id=$1`,[roomId])).rows[0];
    });
    return room ? NextResponse.json({room},{status:id?200:201}) : NextResponse.json({error:"Room type not found."},{status:404});
  } catch (error) {
    const e = error as {message?:string;code?:string};
    if (e.message === "UNAUTHENTICATED") return NextResponse.json({error:"Sign in as staff."},{status:401});
    if (e.message === "FORBIDDEN") return NextResponse.json({error:"Only managers and administrators can manage room types."},{status:403});
    if (e.code === "23505" || e.message === "ROOM_NUMBER_USED_BY_OTHER_TYPE") return NextResponse.json({error:"That room number or URL slug already exists. Each physical room number can belong to only one room type."},{status:409});
    if (e.message?.includes("ROOM_HAS_ACTIVE_BOOKINGS")) return NextResponse.json({error:"Cannot remove a room number with pending, confirmed or checked-in bookings. Complete or cancel those reservations first."},{status:409});
    if (e.code === "22P02" || error instanceof SyntaxError) return NextResponse.json({error:"Invalid room details."},{status:400});
    console.error("Room inventory save failed",error);
    return NextResponse.json({error:"Could not save room inventory. Confirm database migration 007 has been applied."},{status:500});
  }
}
