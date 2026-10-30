/**
 * Mobile API client for 23 Hotel & Residence. It calls the local Next.js API;
 * PostgreSQL credentials and database access stay on the trusted server only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '23hotel_access_token';
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
type ApiError = { message: string };
type ApiResult<T = any> = { data: T | null; error: ApiError | null; count?: number | null };

async function token() { return AsyncStorage.getItem(TOKEN_KEY); }
async function api(path: string, init: RequestInit = {}) {
  const access = await token();
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (access) headers.set('authorization', `Bearer ${access}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

class ApiQuery implements PromiseLike<ApiResult> {
  private operation: 'select' | 'insert' = 'select';
  private values: any = null;
  private filters: Record<string, unknown> = {};
  private maxRows: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private cached: Promise<ApiResult> | null = null;
  constructor(private readonly table: string) {}
  select(_fields = '*') { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  order(_column: string, _options?: { ascending?: boolean }) { return this; }
  limit(count: number) { this.maxRows = count; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this.execute(); }
  single() { this.singleMode = 'single'; return this.execute(); }
  insert(values: any) { this.operation = 'insert'; this.values = values; return this; }
  then<TResult1 = ApiResult, TResult2 = never>(onfulfilled?: ((value: ApiResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> { return this.execute().then(onfulfilled, onrejected); }
  private execute() { if (!this.cached) this.cached = this.run(); return this.cached; }
  private async run(): Promise<ApiResult> {
    try {
      if (this.operation === 'insert') {
        if (this.table === 'customer_requests') {
          const body = await api('/api/requests', { method: 'POST', body: JSON.stringify({ subject: this.values.subject, message: this.values.message, bookingId: this.values.booking_id }) });
          return { data: body.request || body, error: null };
        }
        if (this.table === 'service_orders') {
          const body = await api('/api/customer/orders', { method: 'POST', body: JSON.stringify({ serviceId: this.values.service_id, quantity: this.values.quantity, note: this.values.customer_note, bookingId: this.values.booking_id || undefined }) });
          return { data: body.order || body, error: null };
        }
        throw new Error(`Mobile write access to ${this.table} is not available.`);
      }
      let rows: any[] = [];
      if (this.table === 'rooms') {
        const query = new URLSearchParams();
        if (typeof this.filters.slug === 'string') query.set('slug', this.filters.slug);
        if (typeof this.filters.id === 'string') query.set('id', this.filters.id);
        if (this.maxRows) query.set('limit', String(this.maxRows));
        const result = await api(`/api/public/rooms?${query.toString()}`);
        rows = (result.rooms || []).map((room: any) => ({
          ...room,
          image_url: typeof room.image_url === 'string' && room.image_url
            ? new URL(room.image_url, API_BASE).toString()
            : null,
        }));
      } else if (this.table === 'services') {
        const query = new URLSearchParams();
        if (typeof this.filters.id === 'string') query.set('id', this.filters.id);
        if (typeof this.filters.category === 'string') query.set('category', this.filters.category);
        const result = await api(`/api/public/services?${query.toString()}`); rows = (result.services || []).map((service: any) => ({ ...service, image_url: typeof service.image_url === 'string' && service.image_url ? new URL(service.image_url, API_BASE).toString() : null }));
      } else if (this.table === 'bookings' || this.table === 'payments') {
        const result = await api('/api/customer/bookings'); rows = this.table === 'bookings' ? (result.bookings || []) : (result.payments || []);
      } else if (this.table === 'service_orders') {
        const result = await api('/api/customer/orders'); rows = result.orders || [];
      } else if (this.table === 'customer_requests') {
        const result = await api('/api/customer/requests'); rows = result.requests || [];
      } else {
        throw new Error(`Mobile read access to ${this.table} is not available.`);
      }
      if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
      if (this.singleMode === 'single') {
        if (rows.length !== 1) throw new Error(`Expected one record but found ${rows.length}.`);
        return { data: rows[0], error: null };
      }
      if (this.singleMode === 'maybeSingle') {
        if (rows.length > 1) throw new Error(`Expected at most one record but found ${rows.length}.`);
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed.' } }; }
  }
}

export const hotelApi = {
  from(table: string) { return new ApiQuery(table); },
  createDepositCheckout: async (bookingId: string): Promise<ApiResult> => {
    try { return { data: await api('/api/payments/checkout', { method: 'POST', body: JSON.stringify({ bookingId }) }), error: null }; }
    catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Could not start deposit payment.' } }; }
  },
  rpc: async (name: string, params: Record<string, unknown>): Promise<ApiResult> => {
    try {
      if (name === 'create_booking_request') {
        const body = await api('/api/bookings', { method: 'POST', body: JSON.stringify({ roomId: params.p_room_id, checkIn: params.p_check_in, checkOut: params.p_check_out, guests: params.p_guests, note: params.p_note }) });
        return { data: body.booking || body, error: null };
      }
      throw new Error(`Mobile action ${name} is unsupported.`);
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed.' } }; }
  },
  auth: {
    signInWithOtp: async ({ email, phone, options }: { email: string; phone: string; options?: { data?: { full_name?: string } } }) => {
      try {
        const body = await api('/api/auth/otp/request', { method: 'POST', body: JSON.stringify({ email, phone, fullName: options?.data?.full_name || '' }) });
        return { data: { developmentCode: body.developmentCode }, error: null as ApiError | null };
      } catch (error) { return { data: { developmentCode: undefined }, error: { message: error instanceof Error ? error.message : 'Could not request code.' } as ApiError }; }
    },
    verifyOtp: async ({ email, phone, token: code }: { email: string; phone: string; token: string; type?: string }) => {
      try {
        const body = await api('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email, phone, code }) });
        if (body.token) await AsyncStorage.setItem(TOKEN_KEY, body.token);
        return { data: { user: body.user }, error: null as ApiError | null };
      } catch (error) { return { data: { user: null }, error: { message: error instanceof Error ? error.message : 'Verification failed.' } as ApiError }; }
    },
    getUser: async () => {
      try { const body = await api('/api/auth/me'); return { data: { user: body.user }, error: null as ApiError | null }; }
      catch { return { data: { user: null }, error: null as ApiError | null }; }
    },
    signOut: async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* clear the local token even if API is offline */ }
      await AsyncStorage.removeItem(TOKEN_KEY);
      return { error: null as ApiError | null };
    },
  },
};
