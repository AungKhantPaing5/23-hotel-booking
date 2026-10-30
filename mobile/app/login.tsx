import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Field, PrimaryButton, Screen } from '@/components/ui';
import { colors, hotelName } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'email' | 'phone' | 'otp'>('email');
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState('');

  async function sendCode() {
    const normalized = phone.replace(/[\s()-]/g, '');
    if (!/^09\d{9}$/.test(normalized)) {
      Alert.alert('Check phone number', 'Enter an 11-digit Myanmar phone number starting with 09.');
      return;
    }
    setBusy(true);
    const { data, error } = await hotelApi.auth.signInWithOtp({ email: email.trim().toLowerCase(), phone: normalized, options: { data: { full_name: fullName.trim() } } });
    setBusy(false);
    if (error) { Alert.alert('Could not send OTP', error.message); return; }
    setPhone(normalized);
    setStage('otp');
    Alert.alert(data?.developmentCode ? 'Local development code' : 'Code sent', data?.developmentCode ? `Use ${data.developmentCode} to verify. This test code is only available in development.` : 'Enter the verification code sent to your phone. Delivery depends on your configured SMS provider.');
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(otp.trim())) { Alert.alert('Invalid code', 'Enter the SMS verification code.'); return; }
    setBusy(true);
    const { error } = await hotelApi.auth.verifyOtp({ email: email.trim().toLowerCase(), phone: phone.replace(/[\s()-]/g, ''), token: otp.trim(), type: 'sms' });
    setBusy(false);
    if (error) { Alert.alert('Verification failed', error.message); return; }
    router.back();
  }

  return <Screen>
    <View style={styles.logo}><AppText style={styles.logoNum}>23</AppText></View>
    <AppText style={styles.eyebrow}>WELCOME TO</AppText>
    <AppText style={styles.title}>{hotelName}</AppText>
    <AppText style={styles.subtitle}>Enter your email, then verify your 09 phone number to request a stay, track reservations and order hotel services.</AppText>
    <View style={styles.form}>
      {stage === 'email' ? <>
        <Field label="EMAIL ADDRESS" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <PrimaryButton title="Continue" onPress={() => { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert('Invalid email', 'Enter a valid email address.'); return; } setStage('phone'); }} loading={busy} />
      </> : stage === 'phone' ? <>
        <Field label="YOUR NAME (OPTIONAL)" value={fullName} onChangeText={setFullName} placeholder="Enter your name" autoCapitalize="words" />
        <Field label="PHONE NUMBER" value={phone} onChangeText={setPhone} placeholder="09xxxxxxxxx" maxLength={11} keyboardType="phone-pad" autoComplete="tel" />
        <PrimaryButton title="Send verification code" onPress={sendCode} loading={busy} />
      </> : <>
        <AppText style={{ color: colors.muted, lineHeight: 21, marginBottom: 8 }}>Enter the code sent to {phone}. Make sure the number is correct and reachable.</AppText>
        <Field label="SMS VERIFICATION CODE" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" maxLength={8} autoComplete="sms-otp" />
        <PrimaryButton title="Verify & continue" onPress={verifyCode} loading={busy} />
        <Pressable onPress={() => { setStage('email'); setOtp(''); }} style={{ padding: 12, alignItems: 'center' }}><AppText style={{ fontWeight: '700', color: colors.goldDark }}>Change email or phone number</AppText></Pressable>
      </>}
    </View>
    <View style={styles.note}><AppText style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>By continuing, you agree that the hotel may use your phone number to manage reservations and send essential booking updates. Configure consent and privacy terms before launch.</AppText></View>
  </Screen>;
}
const styles = StyleSheet.create({ logo: { width: 66, height: 66, backgroundColor: colors.forest, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 24 }, logoNum: { color: colors.gold, fontSize: 35, fontWeight: '800' }, eyebrow: { color: colors.goldDark, fontWeight: '800', letterSpacing: 2, fontSize: 10 }, title: { color: colors.forest, fontWeight: '800', fontSize: 33, lineHeight: 39, marginTop: 8 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: 12 }, form: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 18, marginTop: 27, gap: 4 }, note: { padding: 15, marginTop: 9 }, });
