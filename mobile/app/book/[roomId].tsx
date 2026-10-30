import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Field, PrimaryButton, Screen } from '@/components/ui';
import { colors, money, readableDate } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

function addDays(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export default function BookRoomScreen() {
  const params = useLocalSearchParams<{ roomId: string }>();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
  const [checkIn, setCheckIn] = useState(addDays(7));
  const [checkOut, setCheckOut] = useState(addDays(8));
  const [guests, setGuests] = useState('2');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const nights = useMemo(() => Math.max(0, Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86400000)), [checkIn, checkOut]);

  async function submit() {
    const { data: { user } } = await hotelApi.auth.getUser();
    if (!user) { router.push('/login'); return; }
    if (!roomId || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || nights < 1 || !Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > 20) {
      Alert.alert('Check your details', 'Use valid dates, check-out after check-in, and a guest count from 1 to 20.'); return;
    }
    setBusy(true);
    const { data, error } = await hotelApi.rpc('create_booking_request', { p_room_id: roomId, p_check_in: checkIn, p_check_out: checkOut, p_guests: Number(guests), p_note: note.trim() });
    setBusy(false);
    if (error) { Alert.alert('Booking request not created', error.message.includes('SOLD_OUT') ? 'This room overlaps with an existing reservation. Choose another date.' : error.message); return; }
    const result = data as { booking_code?: string; total_amount?: number; status?: string } | null;
    Alert.alert('Request submitted', `Your request${result?.booking_code ? ` (${result.booking_code})` : ''} is pending hotel confirmation.`);
    router.replace('/(tabs)/bookings');
  }

  return <Screen><AppText style={styles.title}>Plan your stay</AppText><AppText style={styles.subtitle}>Choose your dates and guest count. The hotel will review availability before confirming.</AppText>
    <View style={styles.panel}>
      <Field label="CHECK-IN (YYYY-MM-DD)" value={checkIn} onChangeText={setCheckIn} placeholder="2026-11-10" autoCapitalize="none" />
      <Field label="CHECK-OUT (YYYY-MM-DD)" value={checkOut} onChangeText={setCheckOut} placeholder="2026-11-12" autoCapitalize="none" />
      <Field label="NUMBER OF GUESTS" value={guests} onChangeText={setGuests} keyboardType="number-pad" />
      <Field label="SPECIAL REQUEST (OPTIONAL)" value={note} onChangeText={setNote} placeholder="Arrival time, accessibility needs..." multiline style={{ minHeight: 88, textAlignVertical: 'top' }} />
    </View>
    <View style={styles.summary}><AppText style={{ color: colors.forest, fontWeight: '800', fontSize: 16 }}>Stay summary</AppText><SummaryRow label="Check-in" value={readableDate(checkIn)} /><SummaryRow label="Check-out" value={readableDate(checkOut)} /><SummaryRow label="Nights" value={String(nights)} /><AppText style={{ color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 4 }}>Final pricing and room availability are subject to hotel confirmation. Payment is not collected on this screen.</AppText></View>
    <PrimaryButton title="Submit booking request" onPress={submit} loading={busy} />
  </Screen>;
}
function SummaryRow({ label, value }: { label: string; value: string }) { return <View style={styles.row}><AppText style={{ color: colors.muted }}>{label}</AppText><AppText style={{ color: colors.forest, fontWeight: '700' }}>{value}</AppText></View>; }
const styles = StyleSheet.create({ title: { color: colors.forest, fontSize: 30, fontWeight: '800' }, subtitle: { color: colors.muted, lineHeight: 22, fontSize: 13, marginTop: -7 }, panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 17 }, summary: { backgroundColor: colors.soft, borderRadius: 15, padding: 17, gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
