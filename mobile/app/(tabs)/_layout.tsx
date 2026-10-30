import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.forest,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.line, backgroundColor: colors.white },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Stay', tabBarLabel: 'Stay', tabBarIcon: ({ color }) => <TabMark symbol="⌂" color={color} /> }} />
    <Tabs.Screen name="rooms" options={{ title: 'Rooms', tabBarLabel: 'Rooms', tabBarIcon: ({ color }) => <TabMark symbol="▤" color={color} /> }} />
    <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarLabel: 'Bookings', tabBarIcon: ({ color }) => <TabMark symbol="▣" color={color} /> }} />
    <Tabs.Screen name="services" options={{ title: 'Services', tabBarLabel: 'Services', tabBarIcon: ({ color }) => <TabMark symbol="✧" color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Account', tabBarLabel: 'Account', tabBarIcon: ({ color }) => <TabMark symbol="◉" color={color} /> }} />
  </Tabs>;
}

function TabMark({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ color, fontSize: 19, fontWeight: '600' }}>{symbol}</Text>;
}
