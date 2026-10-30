import { saveRoom } from "@/lib/room-management";
export async function POST(request: Request) { return saveRoom(request); }
