"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Check, Edit3, Eye, EyeOff, Image as ImageIcon, LoaderCircle, Plus, Upload, X } from "lucide-react";
import { money } from "@/lib/format";

type Room = {
  id: string;
  name: string;
  slug: string;
  description: string;
  nightly_rate: number | string;
  capacity: number;
  features: string[] | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

type FormValues = {
  name: string;
  slug: string;
  description: string;
  nightly_rate: string;
  capacity: string;
  features: string;
  image_url: string;
  display_order: string;
  is_active: boolean;
};

const blankForm: FormValues = {
  name: "", slug: "", description: "", nightly_rate: "85000", capacity: "2",
  features: "King bed, Air conditioning, Wi-Fi, Private bathroom", image_url: "", display_order: "0", is_active: true,
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function makeSlug(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export function RoomManager({ initialRooms }: { initialRooms: Room[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(blankForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rooms = useMemo(() => [...initialRooms].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)), [initialRooms]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function resetForm() {
    const input = document.getElementById("room-photo") as HTMLInputElement | null;
    if (input) input.value = "";
    setForm(blankForm);
    setEditingId(null);
    setImageFile(null);
    setSlugManuallyEdited(false);
    setMessage("");
    setError("");
  }

  function beginEdit(room: Room) {
    const input = document.getElementById("room-photo") as HTMLInputElement | null;
    if (input) input.value = "";
    setEditingId(room.id);
    setImageFile(null);
    setSlugManuallyEdited(true);
    setMessage("");
    setError("");
    setForm({
      name: room.name,
      slug: room.slug,
      description: room.description || "",
      nightly_rate: String(room.nightly_rate),
      capacity: String(room.capacity),
      features: (room.features || []).join(", "),
      image_url: room.image_url || "",
      display_order: String(room.display_order ?? 0),
      is_active: room.is_active,
    });
    document.getElementById("room-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setError("");
    if (!selected) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      setError("Choose a JPG, PNG or WebP image file.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Room photos must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setImageFile(selected);
    setMessage("");
  }

  async function uploadSelectedImage(): Promise<string> {
    if (!imageFile) return form.image_url.trim();
    const data = new FormData();
    data.append("file", imageFile);
    const response = await fetch("/api/admin/rooms/upload", { method: "POST", body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to upload the room photo.");
    if (typeof result.image_url !== "string" || !result.image_url.startsWith("/uploads/rooms/")) {
      throw new Error("The server returned an invalid room photo path.");
    }
    setForm((old) => ({ ...old, image_url: result.image_url }));
    setImageFile(null);
    const input = document.getElementById("room-photo") as HTMLInputElement | null;
    if (input) input.value = "";
    return result.image_url;
  }

  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const savedImagePath = await uploadSelectedImage();
      const payload = {
        name: form.name.trim(),
        slug: (form.slug || makeSlug(form.name)).trim(),
        description: form.description.trim(),
        nightly_rate: Number(form.nightly_rate),
        capacity: Number(form.capacity),
        features: form.features.split(",").map((value) => value.trim()).filter(Boolean),
        image_url: savedImagePath,
        display_order: Number(form.display_order || 0),
        is_active: form.is_active,
      };
      const response = await fetch(editingId ? `/api/admin/rooms/${editingId}` : "/api/admin/rooms", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save the room.");
      setMessage(editingId ? "Room details updated." : "Room added successfully. It will appear on the customer website when active.");
      setForm(blankForm);
      setImageFile(null);
      setEditingId(null);
      setSlugManuallyEdited(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the room.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(room: Room) {
    setBusyRoomId(room.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !room.is_active }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update room visibility.");
      setMessage(!room.is_active ? `${room.name} is now visible on the customer website.` : `${room.name} has been hidden from customers. Existing booking records are unchanged.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update room visibility.");
    } finally {
      setBusyRoomId(null);
    }
  }

  const previewImage = imagePreview || form.image_url;

  return <div className="space-y-7">
    <section id="room-editor" className="panel scroll-mt-6 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">ROOM INVENTORY</p>
          <h2 className="serif mt-2 text-2xl">{editingId ? "Edit room details" : "Add a room"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7886]">Rooms marked active are published to the customer website and mobile app automatically. Upload a room photo directly from your computer; JPG, PNG and WebP files up to 5 MB are supported.</p>
        </div>
        {editingId && <button type="button" onClick={resetForm} className="btn btn-outline"><X size={14}/> Cancel edit</button>}
      </div>

      {message && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={submitRoom} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">ROOM NAME *
            <input className="control" value={form.name} onChange={(e) => setForm((old) => ({ ...old, name: e.target.value, slug: slugManuallyEdited ? old.slug : makeSlug(e.target.value) }))} placeholder="e.g. Deluxe King Room" minLength={2} maxLength={100} required />
          </label>
          <label className="field">URL SLUG *
            <input className="control" value={form.slug} onChange={(e) => { setSlugManuallyEdited(true); setForm((old) => ({ ...old, slug: makeSlug(e.target.value) })); }} placeholder="deluxe-king-room" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use lowercase letters, numbers and hyphens." />
            <span className="text-[10px] font-normal tracking-normal text-[#858c96]">Customer room URL: /rooms/{form.slug || "room-name"}</span>
          </label>
          <label className="field">PRICE PER NIGHT (MMK) *
            <input className="control" type="number" inputMode="numeric" min="0" max="1000000000" step="1000" value={form.nightly_rate} onChange={(e) => setForm((old) => ({ ...old, nightly_rate: e.target.value }))} required />
          </label>
          <label className="field">MAXIMUM GUESTS *
            <input className="control" type="number" min="1" max="20" step="1" value={form.capacity} onChange={(e) => setForm((old) => ({ ...old, capacity: e.target.value }))} required />
          </label>
          <label className="field md:col-span-2">DESCRIPTION
            <textarea className="control min-h-24 resize-y" value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} maxLength={2000} placeholder="Describe the room, bedding, view and amenities." />
          </label>
          <div className="field md:col-span-2">
            <label htmlFor="room-photo" className="mb-2 block">ROOM PHOTO (JPG, PNG OR WEBP · MAX 5 MB)</label>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-start">
              <div className="rounded-md border border-dashed border-[#d5c8ad] bg-[#faf8f3] p-4">
                <label htmlFor="room-photo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[#d8cdb8] bg-white px-4 py-2 text-sm font-semibold text-[#172234] hover:bg-[#f7f3ea]">
                  <Upload size={16}/>{imageFile ? "Choose a different photo" : "Choose photo file"}
                </label>
                <input id="room-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={chooseImage} />
                <p className="mt-3 break-all text-sm text-[#6f7886]">{imageFile ? imageFile.name : form.image_url ? "Current room photo will be kept unless you choose a new file." : "No photo selected. Choose an image from your computer."}</p>
                <p className="mt-1 text-xs text-[#858c96]">Uploaded photos are stored in this project&apos;s persistent storage/rooms folder.</p>
                {imageFile && <button type="button" className="mt-3 text-xs font-semibold text-[#8f3e35] underline" onClick={() => { setImageFile(null); const input = document.getElementById("room-photo") as HTMLInputElement | null; if (input) input.value = ""; }}>Cancel selected photo</button>}
              </div>
              <div className="flex h-36 items-center justify-center overflow-hidden rounded-md border border-[#e7e3da] bg-[#eeece5]">
                {previewImage ? <img src={previewImage} alt="Room photo preview" className="h-full w-full object-cover" /> : <div className="text-center text-[#b5a278]"><ImageIcon size={30} className="mx-auto"/><span className="mt-2 block text-xs">Photo preview</span></div>}
              </div>
            </div>
          </div>
          <label className="field md:col-span-2">FEATURES (SEPARATE WITH COMMAS)
            <input className="control" value={form.features} onChange={(e) => setForm((old) => ({ ...old, features: e.target.value }))} placeholder="King bed, Wi-Fi, Air conditioning" />
          </label>
          <label className="field">DISPLAY ORDER
            <input className="control" type="number" min="0" max="9999" step="1" value={form.display_order} onChange={(e) => setForm((old) => ({ ...old, display_order: e.target.value }))} />
          </label>
          <div className="flex items-center gap-3 self-end rounded-md border border-[#e7e3da] p-3">
            <input id="room-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm((old) => ({ ...old, is_active: e.target.checked }))} className="h-4 w-4 accent-[#977444]" />
            <label htmlFor="room-active" className="text-sm font-semibold text-[#172234]">Publish to customer site</label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#eeeae1] pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : editingId ? <Check size={15}/> : <Plus size={15}/>} {saving ? (imageFile ? "Uploading & saving..." : "Saving...") : editingId ? "Save changes" : "Add room"}
          </button>
          {!editingId && <button type="button" onClick={resetForm} className="btn btn-outline">Clear form</button>}
        </div>
      </form>
    </section>

    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 md:p-6">
        <div><p className="eyebrow">ROOMS & RESIDENCES</p><h2 className="serif mt-2 text-2xl">All rooms <span className="font-sans text-sm text-[#818895]">({rooms.length})</span></h2></div>
        <div className="flex gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">{rooms.filter((room) => room.is_active).length} published</span><span className="rounded-full bg-[#f2f0eb] px-3 py-1.5 font-semibold text-[#687180]">{rooms.filter((room) => !room.is_active).length} hidden</span></div>
      </div>
      {rooms.length ? <div className="divide-y divide-[#eeeae1]">
        {rooms.map((room) => <article key={room.id} className="grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center md:p-5">
          <div className="relative h-28 overflow-hidden rounded-md bg-[#eeece5] sm:h-24">
            {room.image_url ? <img src={room.image_url} alt={room.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#b5a278]"><ImageIcon size={26}/></div>}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#172234]">{room.name}</h3><span className={`status ${room.is_active ? "confirmed" : "cancelled"}`}>{room.is_active ? "Published" : "Hidden"}</span></div>
            <p className="mt-1 text-xs text-[#7d8490]">/rooms/{room.slug} · up to {room.capacity} guests · order {room.display_order}</p>
            <p className="mt-2 line-clamp-2 text-sm text-[#6f7886]">{room.description || "No description added."}</p>
            <p className="mt-2 text-sm font-semibold text-[#977444]">{money(Number(room.nightly_rate))}<span className="font-normal text-[#838a94]"> / night</span></p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" onClick={() => beginEdit(room)} className="btn btn-outline min-h-10 px-3 py-2"><Edit3 size={13}/> Edit</button>
            <button type="button" disabled={busyRoomId === room.id} onClick={() => toggleActive(room)} className="btn btn-outline min-h-10 px-3 py-2 disabled:opacity-60">
              {busyRoomId === room.id ? <LoaderCircle size={13} className="animate-spin"/> : room.is_active ? <EyeOff size={13}/> : <Eye size={13}/>} {room.is_active ? "Hide" : "Publish"}
            </button>
          </div>
        </article>)}
      </div> : <div className="p-10 text-center"><BedDouble size={30} className="mx-auto text-[#b5a278]"/><p className="serif mt-3 text-xl">No rooms have been added</p><p className="mt-2 text-sm text-[#6f7886]">Use the form above to add your first room. Published rooms will automatically appear on the customer website and mobile app.</p></div>}
    </section>
  </div>;
}
