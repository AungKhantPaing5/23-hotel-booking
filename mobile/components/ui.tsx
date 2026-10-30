import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';
import { colors } from '@/lib/theme';

export function Screen({ children, scroll = true, style, ...props }: ViewProps & { children: React.ReactNode; scroll?: boolean }) {
  if (scroll) {
    return <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent, style]} keyboardShouldPersistTaps="handled" {...props}>{children}</ScrollView>;
  }
  return <View style={[styles.screen, styles.screenContent, style]} {...props}>{children}</View>;
}

export function AppText({ children, style, ...props }: React.ComponentProps<typeof Text>) {
  return <Text {...props} style={[styles.text, style]}>{children}</Text>;
}

export function PageTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={{ marginBottom: 20 }}>
    {eyebrow ? <AppText style={styles.eyebrow}>{eyebrow}</AppText> : null}
    <AppText style={styles.title}>{title}</AppText>
    {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
  </View>;
}

export function PrimaryButton({ title, onPress, disabled, loading, variant = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'outline' | 'light' }) {
  const buttonStyle = variant === 'outline' ? styles.outlineButton : variant === 'light' ? styles.lightButton : styles.primaryButton;
  const textStyle = variant === 'outline' ? styles.outlineButtonText : variant === 'light' ? styles.lightButtonText : styles.primaryButtonText;
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, buttonStyle, (disabled || loading) && { opacity: 0.55 }, pressed && { opacity: 0.82 }]}>
    {loading ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.forest} /> : <Text style={textStyle}>{title}</Text>}
  </Pressable>;
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7, marginBottom: 14 }}>
    <AppText style={styles.fieldLabel}>{label}</AppText>
    <TextInput placeholderTextColor="#9AA49D" {...props} style={[styles.input, style]} />
  </View>;
}

export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeading}>
    <AppText style={styles.sectionTitle}>{title}</AppText>
    {action && onPress ? <Pressable onPress={onPress}><AppText style={{ color: colors.goldDark, fontWeight: '700', fontSize: 12 }}>{action}</AppText></Pressable> : null}
  </View>;
}

export function StatusPill({ status }: { status: string }) {
  const ok = ['confirmed', 'paid', 'completed', 'checked_in', 'checked_out', 'resolved'].includes(status);
  const bad = ['rejected', 'failed', 'cancelled'].includes(status);
  return <View style={[styles.pill, { backgroundColor: ok ? '#E2F3E8' : bad ? '#FBE7E5' : '#F4EEDC' }]}><AppText style={{ fontSize: 11, color: ok ? colors.success : bad ? colors.danger : colors.goldDark, fontWeight: '700', textTransform: 'capitalize' }}>{status.replaceAll('_', ' ')}</AppText></View>;
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <View style={{ padding: 32, alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.goldDark} size="large"/><AppText style={{ color: colors.muted }}>{label}</AppText></View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><AppText style={{ fontSize: 17, fontWeight: '700', color: colors.forest }}>{title}</AppText><AppText style={{ color: colors.muted, textAlign: 'center', lineHeight: 21 }}>{body}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { padding: 20, paddingBottom: 36, gap: 16 },
  text: { color: colors.ink, fontSize: 14 },
  eyebrow: { color: colors.goldDark, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 36, color: colors.forest, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { marginTop: 9, color: colors.muted, lineHeight: 22, fontSize: 13 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 13 },
  primaryButton: { backgroundColor: colors.forest },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  outlineButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  outlineButtonText: { color: colors.forest, fontWeight: '700', fontSize: 14 },
  lightButton: { backgroundColor: colors.gold },
  lightButtonText: { color: colors.forestDeep, fontWeight: '800', fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.forest },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, backgroundColor: colors.white, fontSize: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 3 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.forest },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  empty: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 22, alignItems: 'center', gap: 8 },
});
