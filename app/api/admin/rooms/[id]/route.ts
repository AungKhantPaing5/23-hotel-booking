import { saveRoom } from "@/lib/room-management";
export async function PATCH(request: Request, {params}: {params:Promise<{id:string}>}) {
  return saveRoom(request,(await params).id);
}
