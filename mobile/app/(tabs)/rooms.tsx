import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { RoomCard, Room } from '@/components/RoomCard';
import { AppText, EmptyState, LoadingState, PageTitle, Screen } from '@/components/ui';
import { hotelApi } from '@/lib/api';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await hotelApi.from('rooms').select('id,name,slug,description,nightly_rate,capacity,features,image_url').eq('is_active', true).order('display_order');
    if (error) console.warn(error.message);
    setRooms((data || []) as Room[]);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Screen><PageTitle eyebrow="YOUR NEXT STAY" title="Rooms & suites" subtitle="Find the right space to slow down, settle in and feel at home." />
    {loading ? <LoadingState label="Loading available rooms..." /> : rooms.length ? rooms.map(room => <RoomCard key={room.id} room={room} onPress={() => router.push({ pathname: '/room/[slug]', params: { slug: room.slug } })} />) : <EmptyState title="No rooms available yet" body="The hotel team needs to add active room listings to the admin dashboard before guests can make reservations." />}
    <AppText style={{ fontSize: 11, color: '#6F7886', lineHeight: 18 }}>Prices shown are per night. Availability is confirmed when the hotel team reviews your booking request.</AppText>
  </Screen>;
}
