import { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppText, EmptyState, LoadingState, PageTitle, PrimaryButton, Screen, StatusPill } from '@/components/ui';
import { colors, money, readableDate } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

type Booking = { id: string; booking_code: string; check_in: string; check_out: string; guests: number; status: string; total_amount: number; assigned_room_number?: string | null; created_at: string; rooms?: { name?: string } | null };
type Payment = { id: string; amount: number; currency: string; status: string; provider: string; provider_reference: string | null; payment_type?: string; created_at: string; bookings?: { booking_code?: string } | null };
const DEPOSIT_PERCENT = Math.min(100, Math.max(1, Number(process.env.EXPO_PUBLIC_BOOKING_DEPOSIT_PERCENT || 30)));
const depositAmount = (total: number) => Math.ceil(Number(total) * DEPOSIT_PERCENT / 100);
export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]); const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true); const [signedIn, setSignedIn] = useState(false);
  const [qrPaymentId, setQrPaymentId] = useState(''); const [qrDataUrl, setQrDataUrl] = useState(''); const [qrStatus, setQrStatus] = useState(''); const [qrAmount, setQrAmount] = useState(0); const [paymentBusy, setPaymentBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); const { data: { user } } = await hotelApi.auth.getUser(); setSignedIn(Boolean(user));
    if (!user) { setBookings([]); setPayments([]); setLoading(false); return; }
    const [b, p] = await Promise.all([
      hotelApi.from('bookings').select('id,booking_code,check_in,check_out,guests,status,total_amount,assigned_room_number,created_at,rooms(name)').order('created_at', { ascending: false }),
      hotelApi.from('payments').select('id,amount,currency,status,provider,provider_reference,payment_type,created_at,bookings(booking_code)').order('created_at', { ascending: false }).limit(20),
    ]);
    if (b.error) console.warn(b.error.message); if (p.error) console.warn(p.error.message);
    setBookings((b.data || []) as unknown as Booking[]); setPayments((p.data || []) as unknown as Payment[]); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function beginDeposit(bookingId: string, method: 'mmqr' | 'wallets_cards') {
    setPaymentBusy(true); setQrDataUrl(''); setQrPaymentId(''); setQrStatus('');
    const result = await hotelApi.createDepositCheckout(bookingId, method); setPaymentBusy(false);
    if (result.error) { Alert.alert('Deposit payment', result.error.message); return; }
    const data = result.data || {};
    if (typeof data.checkoutUrl === 'string') { await Linking.openURL(data.checkoutUrl); return; }
    if (typeof data.qrDataUrl === 'string' && typeof data.paymentId === 'string') { setQrDataUrl(data.qrDataUrl); setQrPaymentId(data.paymentId); setQrAmount(Number(data.depositAmount || 0)); setQrStatus('pending'); return; }
    Alert.alert('Deposit payment', 'The payment provider did not return a usable QR or checkout link. Please contact reception.');
  }
  async function chooseDepositMethod(bookingId: string) {
    Alert.alert('Choose payment method', 'Your deposit is due after the hotel confirms your booking.', [
      { text: 'MMQR', onPress: () => { void beginDeposit(bookingId, 'mmqr'); } },
      { text: 'Wallets / bank / cards', onPress: () => { void beginDeposit(bookingId, 'wallets_cards'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  async function checkQrStatus() {
    if (!qrPaymentId) return; setPaymentBusy(true);
    const result = await hotelApi.getPaymentStatus(qrPaymentId); setPaymentBusy(false);
    if (result.error) { Alert.alert('Payment status', result.error.message); return; }
    const status = String(result.data?.payment?.status || 'pending'); setQrStatus(status);
    if (status === 'paid') { Alert.alert('Deposit verified', 'Your payment has been verified by the payment provider. Refreshing your booking history.'); setQrDataUrl(''); await load(); }
    else if (status === 'pending') Alert.alert('Payment pending', 'Complete the QR payment, then check status again.');
    else Alert.alert('Payment status', `Current status: ${status.replaceAll('_', ' ')}. You can create another payment attempt if necessary.`);
  }
  const paidDepositCodes = new Set(payments.filter(p => p.payment_type === 'booking_deposit' && p.status === 'paid').map(p => p.bookings?.booking_code).filter(Boolean));
  return <Screen><PageTitle eyebrow="YOUR RESERVATIONS" title="My bookings" subtitle="Keep your stay details, check-in room and payment records close at hand." />
    {!loading && !signedIn ? <View style={styles.panel}><EmptyState title="Sign in to view your stay" body="Use your phone number to see reservations, payment history and booking status."/><PrimaryButton title="Sign in with phone" onPress={() => router.push('/login')} /></View> : null}
    {loading ? <LoadingState label="Loading your bookings..." /> : signedIn && bookings.length === 0 ? <EmptyState title="No bookings yet" body="Once you submit a room request, it will appear here with its confirmation status." /> : null}
    {bookings.map(item => <View key={item.id} style={styles.card}><View style={styles.row}><AppText style={styles.code}>{item.booking_code}</AppText><StatusPill status={item.status} /></View><AppText style={styles.room}>{item.rooms?.name || 'Hotel room'}</AppText><AppText style={styles.meta}>{readableDate(item.check_in)} — {readableDate(item.check_out)}</AppText><AppText style={styles.meta}>{item.guests} guest(s)</AppText>{item.assigned_room_number ? <AppText style={styles.roomAssigned}>Assigned room: {item.assigned_room_number}</AppText> : null}<View style={[styles.row, { marginTop: 5 }]}><AppText style={styles.price}>{money(item.total_amount)}</AppText><AppText style={styles.tiny}>Room total</AppText></View>{item.status === 'confirmed' && !paidDepositCodes.has(item.booking_code) ? <View style={{ gap: 7, marginTop: 5 }}><AppText style={styles.meta}>Deposit required ({DEPOSIT_PERCENT}%): {money(depositAmount(item.total_amount))}</AppText><PrimaryButton title={`Choose payment · ${money(depositAmount(item.total_amount))}`} onPress={() => chooseDepositMethod(item.id)} loading={paymentBusy} /></View> : null}{item.status === 'confirmed' && paidDepositCodes.has(item.booking_code) ? <AppText style={{ color: colors.forest, fontWeight: '800', fontSize: 12 }}>Deposit paid</AppText> : null}</View>)}
    {qrDataUrl ? <View style={styles.qrCard}><AppText style={styles.room}>Scan MMQR to pay deposit</AppText><AppText style={styles.meta}>Pay exactly {money(qrAmount)} using an MMQR-compatible bank or wallet.</AppText><Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" accessibilityLabel="MMQR payment QR code"/><StatusPill status={qrStatus || 'pending'} /><PrimaryButton title="Check payment status" onPress={checkQrStatus} loading={paymentBusy}/><PrimaryButton title="Close QR" variant="outline" onPress={() => { setQrDataUrl(''); setQrPaymentId(''); }} /></View> : null}
    {signedIn ? <><AppText style={styles.sectionTitle}>Payment history</AppText>{payments.length ? payments.map(p => <View style={styles.paymentCard} key={p.id}><View style={styles.row}><AppText style={styles.code}>{p.bookings?.booking_code || 'Payment'}</AppText><StatusPill status={p.status} /></View><AppText style={{ fontWeight: '800', color: colors.forest }}>{p.payment_type === 'booking_deposit' ? 'Booking deposit · ' : ''}{money(p.amount)} {p.currency !== 'MMK' ? p.currency : ''}</AppText><AppText style={styles.tiny}>{p.provider} {p.provider_reference ? `· Ref ${p.provider_reference}` : ''}</AppText><AppText style={styles.tiny}>{new Date(p.created_at).toLocaleString()}</AppText></View>) : <AppText style={styles.meta}>No payment records are available yet.</AppText>}</> : null}
    <Pressable onPress={() => router.push('/request')} style={styles.help}><AppText style={{ color: colors.forest, fontWeight: '800' }}>Need to change a reservation? Contact the hotel →</AppText></Pressable>
  </Screen>;
}
const styles = StyleSheet.create({ panel: { gap: 14 }, card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 8, marginBottom: 12 }, paymentCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, gap: 8, marginBottom: 9 }, qrCard: { alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 }, qrImage: { width: 260, height: 260, backgroundColor: '#fff' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, code: { color: colors.goldDark, fontWeight: '800', fontSize: 12 }, room: { color: colors.forest, fontWeight: '800', fontSize: 17 }, roomAssigned: { color: colors.goldDark, fontSize: 13, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 12 }, price: { color: colors.forest, fontWeight: '800', fontSize: 15 }, tiny: { color: colors.muted, fontSize: 10 }, sectionTitle: { color: colors.forest, fontWeight: '800', fontSize: 20, marginTop: 8, marginBottom: 3 }, help: { backgroundColor: colors.soft, borderRadius: 13, padding: 16, marginTop: 8 } });
