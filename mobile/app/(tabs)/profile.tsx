import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppText, EmptyState, LoadingState, PrimaryButton, Screen, SectionHeading } from '@/components/ui';
import { colors, hotelAddress, hotelName } from '@/lib/theme';
import { hotelApi } from '@/lib/api';
type User = { id: string; email?: string | null; phone?: string | null; user_metadata?: { full_name?: string } };

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [requests, setRequests] = useState<{id:string;subject:string;status:string;created_at:string}[]>([]);
  const load = useCallback(async () => { setLoading(true); const { data: { user: current } } = await hotelApi.auth.getUser(); setUser(current); if (current) { const { data } = await hotelApi.from('customer_requests').select('id,subject,status,created_at').order('created_at', { ascending: false }).limit(5); setRequests(data || []); } else { setRequests([]); } setLoading(false); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function signOut() { const { error } = await hotelApi.auth.signOut(); if (error) { Alert.alert('Sign out failed', error.message); return; } setUser(null); router.replace('/(tabs)'); }
  return <Screen><AppText style={styles.eyebrow}>YOUR ACCOUNT</AppText><AppText style={styles.title}>A stay, your way.</AppText>
    {loading ? <LoadingState label="Checking account..." /> : user ? <View style={styles.profileCard}><View style={styles.avatar}><AppText style={{ color: colors.gold, fontWeight: '800', fontSize: 24 }}>{(user.user_metadata?.full_name || user.phone || 'G').charAt(0).toUpperCase()}</AppText></View><View style={{ flex: 1, gap: 5 }}><AppText style={styles.name}>{user.user_metadata?.full_name || 'Hotel Guest'}</AppText><AppText style={styles.phone}>{user.phone || user.email || user.id}</AppText><AppText style={styles.member}>23 Hotel guest account</AppText></View></View> : <View style={{ gap: 13 }}><EmptyState title="Welcome, guest" body="Sign in with your phone number to see bookings, payment history and service requests."/><PrimaryButton title="Sign in with phone" onPress={() => router.push('/login')} /></View>}
    <SectionHeading title="Stay essentials" />
    <MenuRow icon="▣" title="My bookings & payments" subtitle="Reservations, status and payment records" onPress={() => router.push('/(tabs)/bookings')} />
    <MenuRow icon="✦" title="Hotel services" subtitle="Swimming, dining and special deals" onPress={() => router.push('/(tabs)/services')} />
    <MenuRow icon="✉" title="Contact & special requests" subtitle="Tell the hotel what you need" onPress={() => router.push('/request')} />
    <MenuRow icon="↗" title="Road directions" subtitle={hotelAddress} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelAddress)}`)} />
    {user ? <PrimaryButton title="Sign out" onPress={signOut} variant="outline" /> : null}
    <AppText style={styles.footer}>{hotelName}{'\n'}Your information is stored in the hotel's database server.</AppText>
  </Screen>;
}
function MenuRow({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.menu, pressed && { opacity: .8 }]}><View style={styles.menuIcon}><AppText style={styles.menuSymbol}>{icon}</AppText></View><View style={{ flex: 1, gap: 5 }}><AppText style={styles.menuTitle}>{title}</AppText><AppText style={styles.menuSubtitle} numberOfLines={2}>{subtitle}</AppText></View><AppText style={{ color: colors.goldDark, fontSize: 18 }}>›</AppText></Pressable>; }
const styles = StyleSheet.create({ eyebrow: { color: colors.goldDark, fontWeight: '800', fontSize: 10, letterSpacing: 2 }, title: { color: colors.forest, fontSize: 30, fontWeight: '800', marginTop: -8 }, profileCard: { backgroundColor: colors.forest, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 }, avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#314967', alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 17, color: colors.white, fontWeight: '800' }, phone: { color: '#D0D7E0', fontSize: 12 }, member: { color: colors.gold, fontSize: 10, marginTop: 2 }, menu: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, menuIcon: { width: 41, height: 41, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, menuSymbol: { color: colors.goldDark, fontSize: 18 }, menuTitle: { color: colors.forest, fontSize: 13, fontWeight: '800' }, menuSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15 }, footer: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 18, marginVertical: 10 } });
