import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Field, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import { colors, money } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

type Service = { id: string; name: string; description: string; category: string; price: number; availability_note: string };
type Booking = { id: string; booking_code: string; status: string; assigned_room_number?: string | null; rooms?: { name?: string } | null };
export default function OrderServiceScreen() {
  const params = useLocalSearchParams<{ serviceId: string }>(); const serviceId = Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId;
  const [item, setItem] = useState<Service | null>(null); const [bookings, setBookings] = useState<Booking[]>([]); const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true); const [quantity, setQuantity] = useState('1'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; (async () => {
    const { data: { user } } = await hotelApi.auth.getUser(); if (!user) { router.replace('/login'); return; }
    const [serviceResult, bookingsResult] = await Promise.all([
      hotelApi.from('services').select('id,name,description,category,price,availability_note').eq('id', serviceId || '').eq('is_active', true).maybeSingle(),
      hotelApi.from('bookings').select('id,booking_code,status,assigned_room_number,rooms(name)').order('created_at', { ascending: false }),
    ]);
    if (!active) return;
    if (serviceResult.error) console.warn(serviceResult.error.message); if (bookingsResult.error) console.warn(bookingsResult.error.message);
    setItem(serviceResult.data as Service | null);
    const eligible = ((bookingsResult.data || []) as unknown as Booking[]).filter(b => ['confirmed', 'checked_in'].includes(b.status));
    setBookings(eligible); if (eligible.length) setBookingId(eligible[0].id); setLoading(false);
  })(); return () => { active = false; }; }, [serviceId]);
  async function submit() {
    const { data: { user } } = await hotelApi.auth.getUser(); if (!user) { router.push('/login'); return; }
    if (!bookingId) { Alert.alert('Booking required', 'You need a confirmed booking before placing a service/deal request.'); return; }
    const q = Number(quantity); if (!Number.isInteger(q) || q < 1 || q > 20) { Alert.alert('Check quantity', 'Quantity must be from 1 to 20.'); return; }
    setBusy(true); const { error } = await hotelApi.from('service_orders').insert({ customer_id: user.id, service_id: serviceId, booking_id: bookingId, quantity: q, customer_note: note.trim(), status: 'pending' }); setBusy(false);
    if (error) { Alert.alert('Request failed', error.message); return; }
    Alert.alert('Request sent', 'The hotel team will review your request. Final availability and charges are confirmed by hotel staff.'); router.replace('/(tabs)/bookings');
  }
  if (loading) return <Screen><LoadingState label="Loading service and bookings..." /></Screen>;
  if (!item) return <Screen><AppText style={styles.title}>Service unavailable</AppText><AppText style={styles.body}>This service or deal may have been removed or is inactive.</AppText></Screen>;
  const isDeal = item.category.trim().toLowerCase() === 'deals';
  return <Screen><AppText style={styles.eyebrow}>{isDeal ? 'HOTEL DEAL' : 'SERVICE REQUEST'}</AppText><AppText style={styles.title}>{item.name}</AppText><AppText style={styles.body}>{item.description}</AppText><View style={styles.priceBox}><AppText style={styles.price}>{money(item.price)}</AppText><AppText style={styles.body}>{item.availability_note}</AppText></View>
    <View style={styles.panel}><AppText style={styles.label}>YOUR BOOKING (REQUIRED)</AppText>{bookings.length ? bookings.map(b => <Pressable key={b.id} onPress={() => setBookingId(b.id)} style={[styles.bookingChoice, bookingId === b.id && styles.bookingSelected]}><AppText style={styles.bookingCode}>{b.booking_code}</AppText><AppText style={styles.body}>{b.rooms?.name || 'Hotel room'}{b.assigned_room_number ? ` · Room ${b.assigned_room_number}` : ''}</AppText><AppText style={styles.tiny}>{b.status.replaceAll('_', ' ')}</AppText></Pressable>) : <AppText style={styles.body}>No confirmed bookings are available. Submit a room booking and wait for the hotel to confirm it.</AppText>}
      <Field label="QUANTITY" value={quantity} onChangeText={setQuantity} keyboardType="number-pad"/><Field label={isDeal ? 'DEAL NOTES (OPTIONAL)' : 'SPECIAL INSTRUCTIONS (OPTIONAL)'} value={note} onChangeText={setNote} placeholder="Preferred time, room number, preferences..." multiline style={{ minHeight: 90, textAlignVertical: 'top' }}/></View>
    <PrimaryButton title={busy ? 'Submitting…' : isDeal ? 'Place deal order' : 'Send service request'} onPress={submit} loading={busy} disabled={!bookings.length}/><AppText style={styles.disclaimer}>Only your own confirmed booking can be used. Requests remain pending until hotel staff accepts them. Service/deal charges are not collected by this request form.</AppText></Screen>;
}
const styles = StyleSheet.create({ eyebrow: { color: colors.goldDark, fontWeight: '800', letterSpacing: 2, fontSize: 10 }, title: { color: colors.forest, fontSize: 29, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 21, fontSize: 13 }, priceBox: { backgroundColor: colors.soft, borderRadius: 15, padding: 17, gap: 8 }, price: { color: colors.goldDark, fontWeight: '800', fontSize: 22 }, panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 16, gap: 10 }, label: { color: colors.forest, fontSize: 12, fontWeight: '800' }, bookingChoice: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 5 }, bookingSelected: { borderColor: colors.goldDark, backgroundColor: '#fbf6e9' }, bookingCode: { color: colors.forest, fontWeight: '800' }, tiny: { color: colors.muted, fontSize: 10 }, disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18 } });
