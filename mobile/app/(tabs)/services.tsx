import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppText, EmptyState, LoadingState, PageTitle, Screen } from '@/components/ui';
import { colors, money } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

type Service = { id: string; name: string; description: string; category: string; price: number; availability_note: string; image_url?: string | null };
const icons: Record<string, string> = { swimming: '≋', kitchen: '♨', dining: '♨', food: '♨', restaurant: '♨', deals: '✦', spa: '☼', service: '◇' };
export default function ServicesScreen() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await hotelApi.from('services').select('id,name,description,category,price,availability_note,image_url').eq('is_active', true).order('display_order');
    if (error) console.warn(error.message);
    setItems((data || []) as Service[]); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Screen><PageTitle eyebrow="A LITTLE EXTRA" title="Services & deals" subtitle="Add comfort to your visit with hotel services, dining and special offers." />
    {loading ? <LoadingState label="Loading hotel services..." /> : items.length ? items.map(item => <Pressable key={item.id} onPress={() => router.push({ pathname: '/order/[serviceId]', params: { serviceId: item.id } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>{item.image_url ? <Image source={{ uri: item.image_url }} accessibilityLabel={item.name} style={styles.image} resizeMode="cover" /> : <View style={styles.icon}><AppText style={styles.symbol}>{icons[item.category.toLowerCase()] || '✦'}</AppText></View>}<View style={{ flex: 1, gap: 6 }}><View style={styles.row}><AppText style={styles.title}>{item.name}</AppText><AppText style={styles.price}>{money(item.price)}</AppText></View><AppText style={styles.description}>{item.description}</AppText><AppText style={styles.availability}>{item.availability_note}</AppText><AppText style={styles.action}>{item.category.trim().toLowerCase() === 'deals' ? 'Order deal →' : 'Request service →'}</AppText></View></Pressable>) : <EmptyState title="Services will appear here" body="Hotel management can add swimming, restaurant, room-service and deal offerings in the admin system." />}
    <AppText style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>Service requests are sent to the hotel team for acceptance. Final price, opening hours and availability should be confirmed with reception.</AppText>
  </Screen>;
}
const styles = StyleSheet.create({ card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 12, gap: 13, marginBottom: 11 }, image: { width: 82, height: 92, borderRadius: 12, backgroundColor: colors.soft }, icon: { width: 48, height: 48, backgroundColor: colors.soft, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, symbol: { color: colors.goldDark, fontSize: 25 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, title: { color: colors.forest, fontSize: 15, fontWeight: '800', flex: 1 }, price: { color: colors.goldDark, fontSize: 11, fontWeight: '800', textAlign: 'right' }, description: { color: colors.muted, fontSize: 12, lineHeight: 19 }, availability: { color: colors.muted, fontSize: 10 }, action: { color: colors.forest, fontSize: 11, fontWeight: '800', marginTop: 3 } });
