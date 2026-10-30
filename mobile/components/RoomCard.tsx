import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, money } from '@/lib/theme';

export type Room = { id: string; name: string; slug: string; description: string; nightly_rate: number; capacity: number; features?: string[]; image_url?: string | null };

export function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
    {room.image_url ? <Image source={{ uri: room.image_url }} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, styles.imageFallback]}><AppText style={{ color: colors.goldDark }}>23</AppText></View>}
    <View style={styles.body}>
      <View style={styles.row}><AppText style={styles.name}>{room.name}</AppText><AppText style={styles.capacity}>Up to {room.capacity}</AppText></View>
      <AppText numberOfLines={2} style={styles.description}>{room.description}</AppText>
      <View style={styles.row}><AppText style={styles.price}>{money(room.nightly_rate)}<AppText style={styles.perNight}> / night</AppText></AppText><AppText style={styles.details}>View details  →</AppText></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, marginBottom: 14 },
  image: { width: '100%', height: 158, backgroundColor: colors.soft },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 15, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '700', color: colors.forest, flex: 1 },
  capacity: { fontSize: 10, color: colors.muted },
  description: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  price: { color: colors.goldDark, fontWeight: '800', fontSize: 13 },
  perNight: { color: colors.muted, fontSize: 10, fontWeight: '400' },
  details: { color: colors.forest, fontWeight: '700', fontSize: 11 },
});
