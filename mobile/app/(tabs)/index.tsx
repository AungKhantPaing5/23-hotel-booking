import { useCallback, useState } from 'react';
import { ImageBackground, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { RoomCard, Room } from '@/components/RoomCard';
import { AppText, EmptyState, LoadingState, Screen, SectionHeading } from '@/components/ui';
import { colors, hotelAddress, hotelName } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

const heroImage = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=85';
export default function HomeScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    hotelApi.from('rooms').select('id,name,slug,description,nightly_rate,capacity,features,image_url').eq('is_active', true).order('display_order').limit(3)
      .then(({ data, error }) => { if (!active) return; if (error) console.warn(error.message); setRooms((data || []) as Room[]); setLoading(false); });
    return () => { active = false; };
  }, []));
  return <Screen>
    <View style={styles.brandRow}><View style={styles.logo}><AppText style={styles.logoText}>23</AppText></View><View style={{ flex: 1 }}><AppText style={styles.brand}>{hotelName}</AppText><AppText style={styles.brandSub}>A refined city stay</AppText></View><Pressable onPress={() => router.push('/login')} style={styles.signIn}><AppText style={{ color: colors.forest, fontWeight: '700', fontSize: 12 }}>Sign in</AppText></Pressable></View>
    <ImageBackground source={{ uri: heroImage }} imageStyle={styles.heroImage} style={styles.hero}>
      <View style={styles.heroShade} />
      <View style={{ position: 'relative', gap: 15 }}>
        <AppText style={styles.kicker}>A STAY THAT FEELS DIFFERENT</AppText>
        <AppText style={styles.heroTitle}>Your city escape, beautifully considered.</AppText>
        <AppText style={styles.heroBody}>Thoughtful rooms, welcoming service and little moments worth remembering.</AppText>
        <Pressable style={styles.heroButton} onPress={() => router.push('/rooms')}><AppText style={{ color: colors.forestDeep, fontWeight: '800' }}>Explore rooms  ↗</AppText></Pressable>
      </View>
    </ImageBackground>
    <View style={styles.perks}><Perk icon="✦" title="Thoughtful comfort"/><Perk icon="⌁" title="Easy reservations"/><Perk icon="♡" title="Personal service"/></View>
    <SectionHeading title="Rooms & suites" action="View all →" onPress={() => router.push('/rooms')} />
    {loading ? <LoadingState label="Finding your room..." /> : rooms.length ? rooms.map((room) => <RoomCard key={room.id} room={room} onPress={() => router.push({ pathname: '/room/[slug]', params: { slug: room.slug } })} />) : <EmptyState title="Rooms coming soon" body="Room listings will appear once the hotel has added active rooms to its booking database." />}
    <View style={styles.serviceFeature}><AppText style={styles.kickerDark}>MAKE YOUR STAY YOURS</AppText><AppText style={styles.serviceTitle}>More than a room.</AppText><AppText style={styles.serviceBody}>Explore swimming, dining, room service and special deals in one place.</AppText><Pressable onPress={() => router.push('/services')} style={styles.serviceButton}><AppText style={{ color: colors.white, fontWeight: '700' }}>Explore hotel services  →</AppText></Pressable></View>
    <View style={styles.location}><AppText style={styles.sectionHeader}>Find your way</AppText><AppText style={styles.locationText}>{hotelAddress}</AppText><Pressable style={styles.directionsButton} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelAddress)}`)}><AppText style={{ color: colors.forest, fontWeight: '700' }}>Open road directions  ↗</AppText></Pressable></View>
    <AppText style={styles.footer}>© {new Date().getFullYear()} {hotelName}</AppText>
  </Screen>;
}
function Perk({ icon, title }: { icon: string; title: string }) { return <View style={styles.perk}><AppText style={{ color: colors.goldDark, fontSize: 17 }}>{icon}</AppText><AppText style={styles.perkText}>{title}</AppText></View>; }
const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 3 }, logo: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest }, logoText: { color: colors.gold, fontSize: 23, fontWeight: '800' }, brand: { fontWeight: '800', fontSize: 15, color: colors.forest }, brandSub: { color: colors.muted, fontSize: 10, marginTop: 3 }, signIn: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12 },
  hero: { minHeight: 365, backgroundColor: colors.forest, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end', padding: 24, marginTop: 2 }, heroImage: { borderRadius: 22 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,20,36,0.78)' }, kicker: { color: colors.gold, fontWeight: '800', fontSize: 9, letterSpacing: 2 }, heroTitle: { color: colors.white, fontSize: 35, lineHeight: 40, fontWeight: '800', letterSpacing: -1 }, heroBody: { color: '#D0D7E0', lineHeight: 22, fontSize: 13, maxWidth: 285 }, heroButton: { backgroundColor: colors.gold, alignSelf: 'flex-start', paddingHorizontal: 17, paddingVertical: 13, borderRadius: 12, marginTop: 3 },
  perks: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', padding: 14, gap: 6 }, perk: { flex: 1, alignItems: 'center', gap: 6 }, perkText: { color: colors.forest, fontSize: 10, fontWeight: '700', textAlign: 'center' }, serviceFeature: { backgroundColor: colors.forest, borderRadius: 19, padding: 22, gap: 11, marginTop: 8 }, kickerDark: { color: colors.gold, fontWeight: '800', fontSize: 9, letterSpacing: 2 }, serviceTitle: { color: colors.white, fontSize: 27, fontWeight: '800' }, serviceBody: { color: '#D0D7E0', fontSize: 13, lineHeight: 21 }, serviceButton: { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 15, backgroundColor: '#314967', borderRadius: 11, marginTop: 4 }, location: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 10 }, sectionHeader: { color: colors.forest, fontSize: 19, fontWeight: '800' }, locationText: { color: colors.muted, fontSize: 12, lineHeight: 20 }, directionsButton: { alignSelf: 'flex-start', backgroundColor: colors.soft, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 13 }, footer: { textAlign: 'center', color: colors.muted, fontSize: 10, marginTop: 4 }
});
