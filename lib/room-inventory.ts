import { z } from "zod";
export const roomNumberSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9 -]{0,14}$/, "Use a room number such as A100 (maximum 15 characters).");
export const roomNumbersSchema = z.array(roomNumberSchema).min(1,"Add at least one physical room number.").max(500).refine(numbers => new Set(numbers).size === numbers.length,"Room numbers must not be repeated.");
export const roomFields = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000),
  nightly_rate: z.coerce.number().finite().min(0).max(1000000000),
  capacity: z.coerce.number().int().min(1).max(20),
  features: z.array(z.string().trim().min(1).max(60)).max(20),
  image_url: z.string().trim().max(2000).refine(value => value === "" || /^https?:\/\/\S+$/i.test(value) || /^\/uploads\/rooms\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(value)),
  display_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.boolean(),
  room_numbers: roomNumbersSchema,
});
export function splitRoomNumbers(value: string): string[] {
  return value.split(/[,\n]+/).map(number=>number.trim().toUpperCase()).filter(Boolean);
}
