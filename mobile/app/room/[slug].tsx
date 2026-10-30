import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, EmptyState, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import { Room } from '@/components/RoomCard';
import { colors, money, hotelAddress } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

export default function RoomDetailsScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    hotelApi.from('rooms').select('id,name,slug,description,nightly_rate,capacity,features,image_url').eq('slug', slug || '').eq('is_active', true).maybeSingle()
      .then(({ data, error }) => { if (!active) return; if (error) console.warn(error.message); setRoom(data as Room | null); setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  if (loading) return <Screen><LoadingState label="Loading room details..." /></Screen>;
  if (!room) return <Screen><EmptyState title="Room not found" body="This room may have been removed or is not currently available." /><PrimaryButton title="Browse rooms" onPress={() => router.replace('/(tabs)/rooms')} /></Screen>;
  return <Screen>
    {room.image_url ? <Image source={{ uri: room.image_url }} style={styles.image} /> : null}
    <AppText style={styles.eyebrow}>23 HOTEL & RESIDENCE</AppText>
    <AppText style={styles.title}>{room.name}</AppText>
    <AppText style={styles.description}>{room.description}</AppText>
    <View style={styles.priceBox}><AppText style={styles.price}>{money(room.nightly_rate)}</AppText><AppText style={{ color: colors.muted, fontSize: 11 }}>per night · Maximum {room.capacity} guests</AppText></View>
    <AppText style={styles.sectionTitle}>Room highlights</AppText>
    {(room.features || []).map((feature, index) => <View style={styles.feature} key={`${feature}-${index}`}><AppText style={{ color: colors.goldDark }}>✦</AppText><AppText>{feature}</AppText></View>)}
    <PrimaryButton title="Request this room" onPress={() => router.push({ pathname: '/book/[roomId]', params: { roomId: room.id } })} />
    <Pressable style={styles.linkButton} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotelAddress)}`)}><AppText style={{ color: colors.forest, fontWeight: '700' }}>Get directions to the hotel ↗</AppText></Pressable>
    <AppText style={styles.note}>Your reservation remains pending until the hotel team confirms it. Availability and final charges are subject to hotel review.</AppText>
  </Screen>;
}
const styles = StyleSheet.create({ image: { height: 230, width: '100%', borderRadius: 18, backgroundColor: colors.soft }, eyebrow: { color: colors.goldDark, fontWeight: '800', fontSize: 10, letterSpacing: 2, marginTop: 4 }, title: { color: colors.forest, fontSize: 31, fontWeight: '800', lineHeight: 37 }, description: { color: colors.muted, fontSize: 13, lineHeight: 22 }, priceBox: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 16, gap: 5 }, price: { color: colors.goldDark, fontWeight: '800', fontSize: 20 }, sectionTitle: { color: colors.forest, fontSize: 18, fontWeight: '800', marginTop: 5 }, feature: { flexDirection: 'row', gap: 10, paddingVertical: 5, alignItems: 'center' }, linkButton: { alignItems: 'center', padding: 10 }, note: { color: colors.muted, fontSize: 11, lineHeight: 18 } });
