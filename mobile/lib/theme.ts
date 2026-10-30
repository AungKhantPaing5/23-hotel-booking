export const colors = {
  forest: '#142238',
  forestDeep: '#0C1728',
  gold: '#CFAD72',
  goldDark: '#977444',
  paper: '#F7F5F0',
  white: '#FFFFFF',
  ink: '#172234',
  muted: '#6F7886',
  line: '#E7E3DA',
  soft: '#E8ECE7',
  danger: '#B93832',
  success: '#236346',
};

export const hotelName = process.env.EXPO_PUBLIC_HOTEL_NAME || '23 Hotel & Residence';
export const hotelAddress = process.env.EXPO_PUBLIC_HOTEL_ADDRESS || 'Set the hotel address in mobile/.env';
export const hotelLat = Number(process.env.EXPO_PUBLIC_HOTEL_LAT || '16.8661');
export const hotelLng = Number(process.env.EXPO_PUBLIC_HOTEL_LNG || '96.1951');

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} MMK`;
}

export function readableDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
