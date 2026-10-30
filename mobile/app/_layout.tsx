import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.forest, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Guest sign in', presentation: 'modal' }} />
      <Stack.Screen name="room/[slug]" options={{ title: 'Room details' }} />
      <Stack.Screen name="book/[roomId]" options={{ title: 'Book your stay' }} />
      <Stack.Screen name="order/[serviceId]" options={{ title: 'Request a service' }} />
      <Stack.Screen name="request" options={{ title: 'Contact the hotel' }} />
    </Stack>
  </>;
}
