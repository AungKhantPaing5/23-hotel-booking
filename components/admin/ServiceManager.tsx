"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ChefHat, Pencil, Plus, Tags, Archive, Eye, EyeOff, X, Image as ImageIcon, Upload, LoaderCircle, Check } from "lucide-react";

type CatalogueItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | string;
  availability_note: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
};

type Draft = {
  name: string;
  description: string;
  category: "Deals" | "Kitchen";
  price: string;
  availability_note: string;
  image_url: string;
  display_order: string;
  is_active: boolean;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function isManagedCategory(category: string) {
  const value = category.trim().toLowerCase();
  return value === "deals" || ["kitchen", "food", "dining", "restaurant", "room service", "room_service"].includes(value);
}

const blankDraft = (): Draft => ({
  name: "",
  description: "",
  category: "Kitchen",
  price: "0",
  availability_note: "Available on request",
  image_url: "",
  display_order: "0",
  is_active: true,
});

export function ServiceManager({ initialItems }: { initialItems: CatalogueItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "Kitchen" | "Deals">("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const visibleItems = useMemo(() => items.filter((item) => isManagedCategory(item.category) && (filter === "all" || (filter === "Kitchen" ? item.category.toLowerCase() !== "deals" : item.category.toLowerCase() === filter.toLowerCase()))), [items, filter]);

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function clearPhotoInput() {
    const input = document.getElementById("service-photo") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function resetForm() {
    clearPhotoInput();
    setDraft(blankDraft());
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setError("");
    setMessage("");
    setShowForm(false);
  }

  function beginCreate(category: "Kitchen" | "Deals" = "Kitchen") {
    clearPhotoInput();
    setDraft({ ...blankDraft(), category });
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function beginEdit(item: CatalogueItem) {
    clearPhotoInput();
    setDraft({
      name: item.name,
      description: item.description || "",
      category: item.category.toLowerCase() === "deals" ? "Deals" : "Kitchen",
      price: String(item.price ?? 0),
      availability_note: item.availability_note || "Available on request",
      image_url: item.image_url || "",
      display_order: String(item.display_order ?? 0),
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setImageFile(null);
    setImagePreview(null);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setError("");
    if (!selected) { setImageFile(null); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      setError("Choose a JPG, PNG or WebP photo."); event.target.value = ""; return;
    }
    if (selected.size <= 0) {
      setError("The selected photo is empty."); event.target.value = ""; return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Kitchen and deal photos must be 5 MB or smaller."); event.target.value = ""; return;
    }
    setImageFile(selected);
    setMessage("");
  }

  async function uploadSelectedImage(): Promise<string> {
    if (!imageFile) return draft.image_url.trim();
    const data = new FormData();
    data.append("file", imageFile);
    data.append("category", draft.category);
    const response = await fetch("/api/admin/services/upload", { method: "POST", body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to upload the photo.");
    if (typeof result.image_url !== "string" || !/^\/uploads\/services\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(result.image_url)) {
      throw new Error("The server returned an invalid photo path.");
    }
    setField("image_url", result.image_url);
    setImageFile(null);
    clearPhotoInput();
    return result.image_url;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const savedImagePath = await uploadSelectedImage();
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category,
        price: Number(draft.price),
        availability_note: draft.availability_note.trim(),
        image_url: savedImagePath || null,
        display_order: Number(draft.display_order),
        is_active: draft.is_active,
      };
      const response = await fetch(editingId ? `/api/admin/services/${editingId}` : "/api/admin/services", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not save this item.");
      const item = body.service as CatalogueItem;
      setItems((current) => editingId ? current.map((old) => old.id === item.id ? item : old) : [item, ...current]);
      setMessage(editingId ? "Item updated successfully." : "Item added. Published items appear on the customer website and mobile app.");
      setShowForm(false);
      setDraft(blankDraft());
      setImageFile(null);
      setImagePreview(null);
      setEditingId(null);
      clearPhotoInput();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this item.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(item: CatalogueItem) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/services/${item.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_active: !item.is_active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not update publication status.");
      setItems((current) => current.map((old) => old.id === item.id ? body.service : old));
      setMessage(`${item.name} is ${item.is_active ? "hidden from" : "published to"} the customer catalogue.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update publication status.");
    } finally { setBusy(false); }
  }

  async function archive(item: CatalogueItem) {
    if (!window.confirm(`Archive “${item.name}”? It will no longer appear to customers, but past orders will remain.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/services/${item.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not archive this item.");
      setItems((current) => current.map((old) => old.id === item.id ? { ...old, is_active: false } : old));
      setMessage(`${item.name} archived. Past order records were preserved.`);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive this item.");
    } finally { setBusy(false); }
  }

  const previewImage = imagePreview || draft.image_url;

  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => beginCreate("Kitchen")} className="panel flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#f5efe3] text-[#92703c]"><ChefHat size={23} /></span>
        <span className="flex-1"><strong className="serif block text-xl">Add Kitchen item</strong><span className="mt-1 block text-xs text-[#6f7886]">Food, drinks and menu items customers can request.</span></span><Plus size={17} />
      </button>
      <button type="button" onClick={() => beginCreate("Deals")} className="panel flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#f5efe3] text-[#92703c]"><Tags size={22} /></span>
        <span className="flex-1"><strong className="serif block text-xl">Add a Deal</strong><span className="mt-1 block text-xs text-[#6f7886]">Packages, promotions and special offers.</span></span><Plus size={17} />
      </button>
    </div>

    {(error || message) && <p role={error ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{error || message}</p>}

    {showForm && <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className="eyebrow">CUSTOMER CATALOGUE</p><h2 className="serif mt-1 text-2xl">{editingId ? "Edit item" : draft.category === "Deals" ? "Create a deal" : "Create a kitchen item"}</h2><p className="mt-1 text-xs leading-5 text-[#6f7886]">Upload a JPG, PNG or WebP photo (maximum 5 MB). Published items appear in the customer website and mobile app.</p></div><button type="button" aria-label="Close form" onClick={resetForm} className="rounded border border-[#dce1e5] p-2"><X size={16}/></button></div>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">ITEM NAME *<input className="control" value={draft.name} onChange={(e) => setField("name", e.target.value)} placeholder={draft.category === "Deals" ? "e.g. Weekend Stay & Dining Deal" : "e.g. Myanmar Breakfast Set"} required minLength={2} maxLength={120}/></label>
        <label className="field">CATEGORY<select className="control" value={draft.category} onChange={(e) => setField("category", e.target.value as Draft["category"])}><option value="Kitchen">Kitchen / Menu</option><option value="Deals">Deals / Promotions</option></select></label>
        <label className="field">PRICE (MMK)<input className="control" type="number" min="0" max="1000000000" step="1" value={draft.price} onChange={(e) => setField("price", e.target.value)} required/></label>
        <label className="field sm:col-span-2">DESCRIPTION<textarea className="control min-h-24" value={draft.description} onChange={(e) => setField("description", e.target.value)} placeholder="Describe what the guest receives." maxLength={1200}/></label>
        <label className="field sm:col-span-2">AVAILABILITY / NOTE<input className="control" value={draft.availability_note} onChange={(e) => setField("availability_note", e.target.value)} placeholder="e.g. Available 7 AM–10 AM; subject to stock" required minLength={2} maxLength={240}/></label>
        <div className="field sm:col-span-2">
          <label htmlFor="service-photo" className="mb-2 block">KITCHEN / DEAL PHOTO (JPG, PNG OR WEBP · MAX 5 MB)</label>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
            <div className="rounded-md border border-dashed border-[#d5c8ad] bg-[#faf8f3] p-4">
              <label htmlFor="service-photo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[#d8cdb8] bg-white px-4 py-2 text-sm font-semibold text-[#172234] hover:bg-[#f7f3ea]"><Upload size={16}/>{imageFile ? "Choose a different photo" : "Choose photo file"}</label>
              <input id="service-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={chooseImage}/>
              <p className="mt-3 break-all text-sm text-[#6f7886]">{imageFile ? imageFile.name : draft.image_url ? "Current photo will be kept unless you choose a new file." : "No photo selected. Choose an image from your computer."}</p>
              <p className="mt-1 text-xs text-[#858c96]">The photo is stored under storage/services on your server.</p>
              {imageFile && <button type="button" className="mt-3 text-xs font-semibold text-[#8f3e35] underline" onClick={() => { setImageFile(null); clearPhotoInput(); }}>Cancel selected photo</button>}
              {draft.image_url && !imageFile && <button type="button" className="mt-3 block text-xs font-semibold text-[#8f3e35] underline" onClick={() => setField("image_url", "")}>Remove current photo</button>}
            </div>
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border border-[#e7e3da] bg-[#eeece5]">
              {previewImage ? <img src={previewImage} alt="Kitchen or deal photo preview" className="h-full w-full object-cover" /> : <div className="text-center text-[#b5a278]"><ImageIcon size={30} className="mx-auto"/><span className="mt-2 block text-xs">Photo preview</span></div>}
            </div>
          </div>
        </div>
        <label className="field">DISPLAY ORDER<input className="control" type="number" min="0" max="9999" value={draft.display_order} onChange={(e) => setField("display_order", e.target.value)} required/></label>
        <label className="flex items-center gap-3 self-end rounded border border-[#dfe2e5] p-3 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setField("is_active", e.target.checked)}/><span><strong className="block">Publish to customer site</strong><span className="text-xs text-[#6f7886]">Show while active</span></span></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn btn-primary" disabled={busy}>{busy ? <><LoaderCircle size={15} className="mr-1 inline animate-spin"/> {imageFile ? "Uploading & saving…" : "Saving…"}</> : editingId ? <><Check size={15} className="mr-1 inline"/> Save changes</> : <><Plus size={15} className="mr-1 inline"/> Add item</>}</button><button className="btn btn-outline" type="button" disabled={busy} onClick={resetForm}>Cancel</button></div>
      </form>
    </section>}

    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8ebee] p-5"><div><h2 className="serif text-2xl">Deals & Kitchen catalogue</h2><p className="mt-1 text-xs text-[#6f7886]">Manage photos, customer-facing prices, availability and publishing.</p></div><div className="flex flex-wrap gap-2">{(["all", "Kitchen", "Deals"] as const).map((value) => <button type="button" key={value} onClick={() => setFilter(value)} className={`rounded border px-3 py-2 text-xs font-bold ${filter === value ? "border-[#17263b] bg-[#17263b] text-white" : "border-[#dfe2e5] text-[#526075]"}`}>{value === "all" ? "All items" : value}</button>)}</div></div>
      {visibleItems.length ? <div className="divide-y divide-[#eeeae1]">{visibleItems.map((item) => <article key={item.id} className="grid gap-4 p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center md:p-5">
        <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-[#f5efe3] text-[#92703c]">{item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover"/> : item.category.toLowerCase() === "deals" ? <Tags size={26}/> : <ChefHat size={26}/>}</div>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{item.name}</strong><span className={`status ${item.is_active ? "confirmed" : "cancelled"}`}>{item.is_active ? "Published" : "Hidden"}</span></div><span className="mt-1 block text-xs text-[#92703c]">{item.category}</span><span className="mt-1 block text-xs leading-5 text-[#6f7886]">{item.description || "No description"}</span><span className="mt-1 block text-[10px] text-[#6f7886]">{item.availability_note}</span><span className="mt-2 block text-sm font-semibold">{Number(item.price).toLocaleString("en-US")} MMK</span></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="rounded border border-[#dfe2e5] px-2 py-2 text-[10px] font-bold" onClick={() => beginEdit(item)} disabled={busy}><Pencil size={12} className="mr-1 inline"/>Edit</button><button type="button" className="rounded border border-[#dfe2e5] px-2 py-2 text-[10px] font-bold" onClick={() => togglePublish(item)} disabled={busy}>{item.is_active ? <EyeOff size={12} className="mr-1 inline"/> : <Eye size={12} className="mr-1 inline"/>}{item.is_active ? "Hide" : "Publish"}</button><button type="button" className="rounded border border-[#edd8d5] px-2 py-2 text-[10px] font-bold text-[#963f32]" onClick={() => archive(item)} disabled={busy || !item.is_active}><Archive size={12} className="mr-1 inline"/>Archive</button></div>
      </article>)}</div> : <p className="p-10 text-center text-sm text-[#6f7886]">No items in this category yet. Use the Add buttons above.</p>}
    </section>
  </div>;
}
