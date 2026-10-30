import { roomNumberSchema } from "@/lib/room-inventory";
import { cookies } from "next/headers";
import { query, withTransaction } from "@/lib/db/pool";
import { getCurrentUser, type AppUser } from "@/lib/db/session";

export type DbError = { message: string; code?: string; details?: string };
type DbResult<T = any> = { data: T | null; error: DbError | null; count?: number | null };
type Filter = { column: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in"; value: unknown };
type RelationSpec = { table: string; foreignKey: string; targetKey: string };
type RelationSelection = { name: string; columns: string[]; relations: RelationSelection[]; all: boolean };

const TABLES = new Set([
  "users", "profiles", "staff_profiles", "rooms", "bookings", "services", "service_orders", "payments",
  "payment_webhook_events", "customer_requests", "notification_logs", "audit_logs", "auth_otps",
]);
const COLUMNS: Record<string, Set<string>> = {
  users: new Set(["id", "email", "phone", "password_hash", "full_name", "is_enabled", "created_at", "updated_at"]),
  profiles: new Set(["user_id", "phone", "full_name", "created_at", "updated_at"]),
  staff_profiles: new Set(["user_id", "display_name", "role", "is_active", "created_by", "created_at"]),
  rooms: new Set(["id", "name", "slug", "description", "nightly_rate", "capacity", "features", "image_url", "is_active", "display_order", "created_at"]),
  bookings: new Set(["id", "booking_code", "customer_id", "room_id", "check_in", "check_out", "guests", "status", "total_amount", "currency", "customer_note", "staff_note", "assigned_room_number", "reviewed_by", "reviewed_at", "created_at", "updated_at"]),
  services: new Set(["id", "name", "description", "category", "price", "availability_note", "image_url", "is_active", "display_order", "created_at"]),
  service_orders: new Set(["id", "customer_id", "service_id", "booking_id", "quantity", "status", "customer_note", "staff_note", "assigned_to", "created_at", "updated_at"]),
  payments: new Set(["id", "booking_id", "customer_id", "amount", "currency", "provider", "provider_reference", "payment_type", "status", "failure_reason", "paid_at", "refunded_at", "created_at"]),
  payment_webhook_events: new Set(["event_id", "payment_id", "event_status", "received_at"]),
  customer_requests: new Set(["id", "customer_id", "booking_id", "subject", "message", "status", "assigned_to", "created_at", "updated_at"]),
  notification_logs: new Set(["id", "user_id", "booking_id", "channel", "template_key", "recipient", "status", "provider_message_id", "error_message", "created_at"]),
  audit_logs: new Set(["id", "actor_id", "action", "entity_type", "entity_id", "metadata", "created_at"]),
  auth_otps: new Set(["id", "email", "phone", "code_hash", "full_name", "expires_at", "attempts", "used_at", "created_at"]),
};
const RELATIONS: Record<string, Record<string, RelationSpec>> = {
  bookings: { rooms: { table: "rooms", foreignKey: "room_id", targetKey: "id" }, profiles: { table: "profiles", foreignKey: "customer_id", targetKey: "user_id" } },
  service_orders: { services: { table: "services", foreignKey: "service_id", targetKey: "id" }, profiles: { table: "profiles", foreignKey: "customer_id", targetKey: "user_id" }, bookings: { table: "bookings", foreignKey: "booking_id", targetKey: "id" } },
  payments: { bookings: { table: "bookings", foreignKey: "booking_id", targetKey: "id" }, profiles: { table: "profiles", foreignKey: "customer_id", targetKey: "user_id" } },
  customer_requests: { profiles: { table: "profiles", foreignKey: "customer_id", targetKey: "user_id" } },
};
function identifier(name: string, table: string): string {
  if (!COLUMNS[table]?.has(name)) throw Object.assign(new Error(`Unknown column ${table}.${name}`), { code: "42703" });
  return `"${name}"`;
}
function splitSelect(select: string): { columns: string[]; relations: RelationSelection[]; all: boolean } {
  const splitTokens = (value: string): string[] => {
    const tokens: string[] = [];
    let current = "";
    let depth = 0;
    for (const ch of value) {
      if (ch === "," && depth === 0) {
        if (current.trim()) tokens.push(current.trim());
        current = "";
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      current += ch;
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  };
  const parse = (value: string) => {
    if (value.trim() === "*" || !value.trim()) return { columns: [] as string[], relations: [] as RelationSelection[], all: true };
    const columns: string[] = [];
    const relations: RelationSelection[] = [];
    for (const token of splitTokens(value)) {
      const open = token.indexOf("(");
      const relationName = open > 0 ? token.slice(0, open).trim() : "";
      if (open > 0 && token.endsWith(")") && /^[a-z_][a-z0-9_]*$/i.test(relationName)) {
        const inner = parse(token.slice(open + 1, -1));
        relations.push({ name: relationName, columns: inner.columns, relations: inner.relations, all: inner.all });
      } else if (token === "*") {
        columns.push("*");
      } else if (/^[a-z_][a-z0-9_]*$/i.test(token)) {
        columns.push(token);
      } else {
        throw Object.assign(new Error(`Unsupported select field: ${token}`), { code: "PGRST100" });
      }
    }
    return { columns, relations, all: columns.includes("*") };
  };
  return parse(select);
}

function dbError(error: unknown): DbError {
  const e = error as { message?: string; code?: string; detail?: string };
  return { message: e?.message || "Database query failed.", code: e?.code, details: e?.detail };
}

class QueryBuilder implements PromiseLike<DbResult<any>> {
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selection = "*";
  private selectOptions: { count?: "exact"; head?: boolean } = {};
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private conflict: string | null = null;
  private cached: Promise<DbResult<any>> | null = null;

  constructor(private readonly table: string, private readonly user: AppUser | null, private readonly staffRole: string | null, private readonly privileged = false, private readonly cookieStore?: Awaited<ReturnType<typeof cookies>>) {
    if (!TABLES.has(table)) throw new Error(`Unknown database table: ${table}`);
  }
  select(fields = "*", options?: { count?: "exact"; head?: boolean }) { if (this.operation === "select") this.selection = fields; else this.selection = fields; if (options) this.selectOptions = options; return this; }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) { this.operation = "insert"; this.payload = values; return this; }
  update(values: Record<string, unknown>) { this.operation = "update"; this.payload = values; return this; }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.operation = "upsert"; this.payload = values; this.conflict = options?.onConflict || null; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: "eq", value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, op: "neq", value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, op: "gt", value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, op: "gte", value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ column, op: "lt", value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ column, op: "lte", value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ column, op: "in", value: values }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(count: number) { this.maxRows = Math.max(0, Math.min(1000, Math.floor(count))); return this; }
  single() { this.singleMode = "single"; return this.execute(); }
  maybeSingle() { this.singleMode = "maybeSingle"; return this.execute(); }
  then<TResult1 = DbResult<any>, TResult2 = never>(onfulfilled?: ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
  private execute(): Promise<DbResult<any>> { if (!this.cached) this.cached = this.run(); return this.cached; }
  private async run(): Promise<DbResult<any>> {
    try {
      if (this.operation !== "select" && !this.canWrite()) {
        throw Object.assign(new Error("NOT_AUTHORIZED_FOR_DATABASE_WRITE"), { code: "42501" });
      }
      const projection = splitSelect(this.selection);
      if (this.selectOptions.count === "exact" && this.operation === "select") {
        const params: unknown[] = []; const where = this.whereSql(params);
        const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public."${this.table}"${where}`, params);
        if (this.selectOptions.head) return { data: null, error: null, count: Number(countResult.rows[0]?.count || 0) };
      }
      let rows: Record<string, any>[] = [];
      if (this.operation === "select") {
        const params: unknown[] = []; const where = this.whereSql(params);
        const orderSql = this.orders.length ? ` ORDER BY ${this.orders.map(o => `${identifier(o.column, this.table)} ${o.ascending ? "ASC" : "DESC"}`).join(", ")}` : "";
        const limitSql = this.maxRows === null ? "" : ` LIMIT ${this.maxRows}`;
        const result = await query<Record<string, any>>(`SELECT * FROM public."${this.table}"${where}${orderSql}${limitSql}`, params);
        rows = result.rows;
      } else if (this.operation === "insert" || this.operation === "upsert") {
        const inputs = Array.isArray(this.payload) ? this.payload : [this.payload || {}];
        if (!inputs.length) return { data: this.singleMode ? null : [], error: null };
        for (const input of inputs) {
          const keys = Object.keys(input);
          if (!keys.length) throw Object.assign(new Error("Cannot insert an empty record."), { code: "22023" });
          const cols = keys.map(k => identifier(k, this.table)); const vals = keys.map(k => input[k]);
          const conflicts = this.operation === "upsert" && this.conflict ? this.conflict.split(",").map(k => identifier(k.trim(), this.table)).join(", ") : null;
          const assignments = keys.filter(k => !this.conflict?.split(",").map(x => x.trim()).includes(k)).map(k => `${identifier(k, this.table)} = EXCLUDED.${identifier(k, this.table)}`);
          let sql = `INSERT INTO public."${this.table}" (${cols.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})`;
          if (conflicts) sql += ` ON CONFLICT (${conflicts}) ${assignments.length ? `DO UPDATE SET ${assignments.join(", ")}` : "DO NOTHING"}`;
          sql += " RETURNING *";
          const result = await query<Record<string, any>>(sql, vals);
          if (result.rows[0]) rows.push(result.rows[0]);
        }
      } else if (this.operation === "update") {
        const input = this.payload as Record<string, unknown> | null;
        if (!input || !Object.keys(input).length) throw Object.assign(new Error("No fields provided for update."), { code: "22023" });
        const params: unknown[] = [];
        const assignments = Object.entries(input).map(([key,value]) => { params.push(value); return `${identifier(key, this.table)} = $${params.length}`; });
        const where = this.whereSql(params);
        const result = await query<Record<string, any>>(`UPDATE public."${this.table}" SET ${assignments.join(", ")}${where} RETURNING *`, params);
        rows = result.rows;
      } else if (this.operation === "delete") {
        const params: unknown[] = []; const where = this.whereSql(params);
        const result = await query<Record<string, any>>(`DELETE FROM public."${this.table}"${where} RETURNING *`, params);
        rows = result.rows;
      }
      if (this.table === "rooms" && rows.length) {
        const units = await query<{room_id:string;room_number:string}>("SELECT room_id,room_number FROM room_units WHERE room_id=ANY($1::uuid[]) AND is_active ORDER BY room_number",[rows.map(row=>row.id)]);
        for (const row of rows) row.room_numbers=units.rows.filter(unit=>unit.room_id===row.id).map(unit=>unit.room_number);
      }
      rows = await attachRelations(this.table, rows, projection.relations);
      const output = rows.map(row => project(row, projection.columns, projection.all, projection.relations));
      let data: unknown = output;
      if (this.singleMode === "single") {
        if (output.length !== 1) throw Object.assign(new Error(`Expected one row from ${this.table}; received ${output.length}.`), { code: "PGRST116" });
        data = output[0];
      } else if (this.singleMode === "maybeSingle") {
        if (output.length > 1) throw Object.assign(new Error(`Expected at most one row from ${this.table}; received ${output.length}.`), { code: "PGRST116" });
        data = output[0] ?? null;
      }
      return { data, error: null, ...(this.selectOptions.count === "exact" ? { count: output.length } : {}) };
    } catch (error) {
      const e = dbError(error);
      return { data: null, error: e, ...(this.selectOptions.count === "exact" ? { count: null } : {}) };
    }
  }
  private whereSql(params: unknown[]) {
    const expressions = this.filters.map(f => {
      const col = identifier(f.column, this.table);
      if (f.op === "eq" && f.value === null) return `${col} IS NULL`;
      if (f.op === "neq" && f.value === null) return `${col} IS NOT NULL`;
      if (f.op === "in") {
        const list = Array.isArray(f.value) ? f.value : [];
        if (!list.length) return "FALSE";
        params.push(list);
        return `${col} = ANY($${params.length})`;
      }
      params.push(f.value);
      const op = ({ eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const)[f.op];
      return `${col} ${op} $${params.length}`;
    });
    expressions.push(...this.scopeExpressions(params));
    return expressions.length ? ` WHERE ${expressions.join(" AND ")}` : "";
  }

  /** Server-side row scoping replaces the per-user RLS that the hosted database used to provide. */
  private scopeExpressions(params: unknown[]): string[] {
    if (this.privileged) return [];
    const id = this.user?.id;
    const role = this.staffRole;
    const hasRole = Boolean(role);
    const admin = role === "super_admin" || role === "manager";
    const reception = role === "receptionist";
    const finance = role === "accountant";
    const staffOrders = role === "kitchen_staff" || role === "order_staff" || role === "deals_staff" || role === "service_staff";
    const addUser = () => { params.push(id); return `$${params.length}`; };
    switch (this.table) {
      case "rooms":
      case "services":
        return admin ? [] : [`is_active = TRUE`];
      case "bookings":
        if (admin || reception) return [];
        if (id && !hasRole) return [`customer_id = ${addUser()}`];
        return ["FALSE"];
      case "service_orders": {
        if (admin) return [];
        if (!id) return ["FALSE"];
        if (!hasRole) return [`customer_id = ${addUser()}`];
        if (!staffOrders) return ["FALSE"];
        const assignedParam = addUser();
        const assigned = `(assigned_to = ${assignedParam} OR (assigned_to IS NULL AND status IN ('pending','accepted','processing')))`;
        if (role === "deals_staff") {
          return [`EXISTS (SELECT 1 FROM public.services scope_s WHERE scope_s.id = public."service_orders".service_id AND lower(trim(scope_s.category)) = 'deals')`, assigned];
        }
        const kitchen = "('kitchen','food','dining','restaurant','room service','room_service')";
        if (role === "kitchen_staff" || role === "order_staff") {
          return [`EXISTS (SELECT 1 FROM public.services scope_s WHERE scope_s.id = public."service_orders".service_id AND lower(trim(scope_s.category)) IN ${kitchen})`, assigned];
        }
        return [`EXISTS (SELECT 1 FROM public.services scope_s WHERE scope_s.id = public."service_orders".service_id AND lower(trim(scope_s.category)) NOT IN ${kitchen} AND lower(trim(scope_s.category)) <> 'deals')`, assigned];
      }
      case "payments":
        if (admin || finance) return [];
        if (id && !hasRole) return [`customer_id = ${addUser()}`];
        return ["FALSE"];
      case "customer_requests":
        if (admin || reception) return [];
        if (id && !hasRole) return [`customer_id = ${addUser()}`];
        return ["FALSE"];
      case "staff_profiles":
        if (role === "super_admin") return [];
        if (id) return [`user_id = ${addUser()}`];
        return ["FALSE"];
      case "profiles":
        if (role === "super_admin" || role === "manager" || role === "receptionist") return [];
        if (id && !hasRole) return [`user_id = ${addUser()}`];
        return ["FALSE"];
      case "notification_logs":
        if (role === "super_admin" || role === "manager") return [];
        if (id && !hasRole) return [`user_id = ${addUser()}`];
        return ["FALSE"];
      case "audit_logs":
        return role === "super_admin" || role === "manager" ? [] : ["FALSE"];
      case "payment_webhook_events":
      case "auth_otps":
      case "users":
        return ["FALSE"];
      default:
        return [];
    }
  }

  private canWrite(): boolean {
    if (this.privileged) return true;
    const role = this.staffRole;
    const admin = role === "super_admin" || role === "manager";
    const userId = this.user?.id;
    const rows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    if (!userId) return false;
    if (this.operation === "insert" || this.operation === "upsert") {
      if (this.table === "rooms" || this.table === "services") return admin;
      if (this.table === "service_orders" || this.table === "customer_requests" || this.table === "payments") {
        return !role && rows.length > 0 && rows.every(row => row.customer_id === userId);
      }
      if (this.table === "notification_logs") return role === "super_admin" || role === "manager" || role === "receptionist";
      return false;
    }
    if (this.operation === "update" || this.operation === "delete") {
      if (this.table === "rooms" || this.table === "services") return admin;
      if (this.table === "customer_requests") return admin || role === "receptionist";
      if (this.table === "payments") return !role;
      return false;
    }
    return false;
  }
}

function project(row: Record<string, any>, columns: string[], all: boolean, relations: { name: string; columns: string[] }[]) {
  const result: Record<string, unknown> = {};
  if (all || columns.includes("*")) Object.assign(result, row);
  else for (const column of columns) result[column] = row[column];
  for (const relation of relations) result[relation.name] = row[relation.name] ?? null;
  return result;
}

async function attachRelations(table: string, rows: Record<string, any>[], relations: RelationSelection[]) {
  if (!rows.length || !relations.length) return rows;
  for (const relation of relations) {
    const spec = RELATIONS[table]?.[relation.name];
    if (!spec) throw Object.assign(new Error(`Unsupported relation ${table}.${relation.name}.`), { code: "PGRST200" });
    const targetColumns = COLUMNS[spec.table];
    if (!targetColumns) throw new Error("Invalid relation table.");
    if (!relation.all) {
      for (const column of relation.columns) {
        if (column !== "*" && !targetColumns.has(column)) throw Object.assign(new Error(`Unknown column ${spec.table}.${column}`), { code: "42703" });
      }
    }
    const keyValues = [...new Set(rows.map(row => row[spec.foreignKey]).filter(Boolean))];
    if (!keyValues.length) {
      for (const row of rows) row[relation.name] = null;
      continue;
    }
    const result = await query<Record<string, any>>(`SELECT * FROM public."${spec.table}" WHERE "${spec.targetKey}" = ANY($1)`, [keyValues]);
    await attachRelations(spec.table, result.rows, relation.relations);
    const byKey = new Map(result.rows.map(item => [String(item[spec.targetKey]), item]));
    for (const row of rows) {
      const related = row[spec.foreignKey] ? byKey.get(String(row[spec.foreignKey])) || null : null;
      row[relation.name] = related ? project(related, relation.columns, relation.all, relation.relations) : null;
    }
  }
  return rows;
}

class LocalClient {
  auth = {
    getUser: async () => {
      try { return { data: { user: await getCurrentUser() }, error: null }; }
      catch (error) { return { data: { user: null }, error: dbError(error) }; }
    },
    signOut: async () => {
      try { const store = await cookies(); store.delete("23hotel_session"); return { error: null }; }
      catch (error) { return { error: dbError(error) }; }
    },
  };
  constructor(
    private readonly user: AppUser | null = null,
    private readonly staffRole: string | null = null,
    private readonly privileged = false,
    private readonly cookieStore?: Awaited<ReturnType<typeof cookies>>,
  ) {}
  from(table: string) { return new QueryBuilder(table, this.user, this.staffRole, this.privileged, this.cookieStore); }
  async rpc(name: string, params: Record<string, unknown>): Promise<DbResult<any>> {
    try {
      if (!this.user) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "401" });
      if (name === "create_booking_request") return { data: await createBookingRequest(this.user.id, params), error: null };
      if (name === "transition_booking_status") return { data: await transitionBookingStatus(this.user.id, params), error: null };
      if (name === "transition_service_order_status") return { data: await transitionServiceOrderStatus(this.user.id, params), error: null };
      throw Object.assign(new Error(`Unknown local database function: ${name}`), { code: "42883" });
    } catch (error) { return { data: null, error: dbError(error) }; }
  }
}

export async function createClient() {
  const user = await getCurrentUser().catch(() => null);
  let staffRole: string | null = null;
  if (user) {
    try {
      const staffResult = await query<{ role: string }>(
        "SELECT role FROM staff_profiles WHERE user_id = $1 AND is_active = true LIMIT 1",
        [user.id],
      );
      staffRole = staffResult.rows[0]?.role || null;
    } catch (error) {
      console.error("Could not load staff permissions for local database client", error);
    }
  }
  let store: Awaited<ReturnType<typeof cookies>> | undefined;
  try { store = await cookies(); } catch { /* no request cookie context */ }
  return new LocalClient(user, staffRole, false, store);
}
export function createAdminClient() { return new LocalClient(null, null, true); }

async function createBookingRequest(userId: string, p: Record<string, unknown>) {
  const roomId = String(p.p_room_id || ""); const checkIn = String(p.p_check_in || ""); const checkOut = String(p.p_check_out || "");
  const roomNumber = roomNumberSchema.parse(p.p_room_number);
  const guests = Number(p.p_guests); const note = String(p.p_note || "").slice(0, 2000);
  return withTransaction(async client => {
    if (!roomId || !checkIn || !checkOut || !Number.isInteger(guests) || guests < 1 || guests > 20) throw new Error("INVALID_BOOKING_DETAILS");
    const room = await client.query<{ id: string; nightly_rate: string; capacity: number }>("SELECT id, nightly_rate, capacity FROM rooms WHERE id=$1 AND is_active=true FOR UPDATE", [roomId]);
    if (!room.rows[0]) throw new Error("ROOM_NOT_FOUND");
    const unit = await client.query("SELECT room_number FROM room_units WHERE room_id=$1 AND room_number=$2 AND is_active=true",[roomId,roomNumber]);
    if (!unit.rowCount) throw new Error("ROOM_NUMBER_NOT_AVAILABLE");
    if (guests > room.rows[0].capacity) throw new Error("GUEST_LIMIT_EXCEEDED");
    const dates = await client.query<{ nights: number; invalid: boolean }>("SELECT ($2::date - $1::date)::int AS nights, ($1::date < (now() AT TIME ZONE 'Asia/Yangon')::date OR $2::date <= $1::date) AS invalid", [checkIn, checkOut]);
    if (dates.rows[0]?.invalid || !dates.rows[0]?.nights) throw new Error("INVALID_BOOKING_DETAILS");
    const total = Number(room.rows[0].nightly_rate) * Number(dates.rows[0].nights);
    const inserted = await client.query<{ id: string; booking_code: string; status: string; total_amount: string }>("INSERT INTO bookings(customer_id,room_id,check_in,check_out,guests,total_amount,currency,customer_note,assigned_room_number) VALUES($1,$2,$3,$4,$5,$6,'MMK',$7,$8) RETURNING id,booking_code,status,total_amount,assigned_room_number", [userId, roomId, checkIn, checkOut, guests, total, note,roomNumber]);
    await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'booking.created','booking',$2,$3::jsonb)", [userId, inserted.rows[0].id, JSON.stringify({ booking_code: inserted.rows[0].booking_code })]);
    return inserted.rows[0];
  }).catch(error => { const e = error as { code?: string }; if (e.code === "23P01") throw new Error("SOLD_OUT"); throw error; });
}

async function transitionBookingStatus(userId: string, p: Record<string, unknown>) {
  return withTransaction(async client => {
    const staff = await client.query<{ role: string }>("SELECT role FROM staff_profiles WHERE user_id=$1 AND is_active=true", [userId]);
    if (!staff.rows[0] || !["super_admin", "manager", "receptionist"].includes(staff.rows[0].role)) throw new Error("NOT_AUTHORIZED");
    const bookingId = String(p.p_booking_id || ""); const expected = String(p.p_expected_status || ""); const next = String(p.p_new_status || "");
    const current = await client.query<{assigned_room_number:string|null}>("SELECT assigned_room_number FROM bookings WHERE id=$1",[bookingId]);
    const selected = current.rows[0]?.assigned_room_number;
    const roomNumber = String(p.p_room_number || selected || "").trim().toUpperCase();
    if (selected && roomNumber!==selected) throw new Error("ROOM_SELECTION_LOCKED");
    const transitions: Record<string, string[]> = { pending: ["confirmed", "rejected"], confirmed: ["cancelled", "checked_in"], checked_in: ["checked_out"] };
    if (!transitions[expected]?.includes(next)) throw new Error("INVALID_TRANSITION");
    if (next === "checked_in" && !/^[A-Za-z0-9][A-Za-z0-9 -]{0,14}$/.test(roomNumber)) throw new Error("ROOM_NUMBER_REQUIRED");
    let updated;
    try {
      updated = await client.query<Record<string, any>>("UPDATE bookings SET status=$3::booking_status, assigned_room_number=CASE WHEN $3::booking_status='checked_in'::booking_status THEN $5 ELSE assigned_room_number END, reviewed_by=$4, reviewed_at=now() WHERE id=$1 AND status=$2 RETURNING id,booking_code,status,check_in,check_out,total_amount,currency,assigned_room_number", [bookingId, expected, next, userId, roomNumber || null]);
    } catch (error) { const e = error as { code?: string }; if (e.code === "23505") throw new Error("ROOM_ALREADY_ASSIGNED"); throw error; }
    if (!updated.rows[0]) throw new Error("STATUS_CONFLICT");
    await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'booking.status_changed','booking',$2,$3::jsonb)", [userId, bookingId, JSON.stringify({ from: expected, to: next })]);
    return updated.rows[0];
  });
}

async function transitionServiceOrderStatus(userId: string, p: Record<string, unknown>) {
  return withTransaction(async client => {
    const staffResult = await client.query<{ role: string }>("SELECT role FROM staff_profiles WHERE user_id=$1 AND is_active=true", [userId]);
    const role = staffResult.rows[0]?.role;
    if (!role) throw new Error("NOT_AUTHORIZED");
    const orderId = String(p.p_order_id || ""); const expected = String(p.p_expected_status || ""); const next = String(p.p_new_status || "");
    const result = await client.query<Record<string, any>>("SELECT so.*, lower(trim(s.category)) AS service_category FROM service_orders so JOIN services s ON s.id=so.service_id WHERE so.id=$1 FOR UPDATE OF so", [orderId]);
    const order = result.rows[0];
    if (!order || order.status !== expected) throw new Error("STATUS_CONFLICT");
    const isAdmin = ["super_admin", "manager"].includes(role);
    const category = String(order.service_category || "");
    const kitchenCats = ["kitchen", "food", "dining", "restaurant", "room service", "room_service"];
    if (!isAdmin) {
      if (order.assigned_to && order.assigned_to !== userId) throw new Error("ORDER_ASSIGNED_TO_ANOTHER_STAFF");
      if (role === "deals_staff" && category !== "deals") throw new Error("NOT_AUTHORIZED_FOR_CATEGORY");
      if (["kitchen_staff", "order_staff"].includes(role) && !kitchenCats.includes(category)) throw new Error("NOT_AUTHORIZED_FOR_CATEGORY");
      if (role === "service_staff" && (category === "deals" || kitchenCats.includes(category))) throw new Error("NOT_AUTHORIZED_FOR_CATEGORY");
      if (!["deals_staff", "kitchen_staff", "order_staff", "service_staff"].includes(role)) throw new Error("NOT_AUTHORIZED");
    }
    const transitions: Record<string, string[]> = { pending: ["accepted", "rejected"], accepted: ["processing", "cancelled"], processing: ["completed"] };
    if (!transitions[expected]?.includes(next)) throw new Error("INVALID_TRANSITION");
    const assign = ["deals_staff", "kitchen_staff", "order_staff", "service_staff"].includes(role) && next !== "rejected";
    const updated = await client.query<{ id: string; status: string; assigned_to: string | null }>("UPDATE service_orders SET status=$2, assigned_to=CASE WHEN $3::boolean THEN coalesce(assigned_to,$4::uuid) ELSE assigned_to END WHERE id=$1 RETURNING id,status,assigned_to", [orderId, next, assign, userId]);
    await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'service_order.status_changed','service_order',$2,$3::jsonb)", [userId, orderId, JSON.stringify({ from: expected, to: next, assigned_to: updated.rows[0].assigned_to })]);
    return updated.rows[0];
  });
}
