import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Field, PrimaryButton, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { hotelApi } from '@/lib/api';

export default function RequestScreen() {
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    const { data: { user } } = await hotelApi.auth.getUser(); if (!user) { router.push('/login'); return; }
    if (subject.trim().length < 3 || message.trim().length < 5) { Alert.alert('Please add details', 'Enter a subject and a message for the hotel team.'); return; }
    setBusy(true); const { error } = await hotelApi.from('customer_requests').insert({ customer_id: user.id, subject: subject.trim(), message: message.trim(), status: 'open' }); setBusy(false);
    if (error) { Alert.alert('Request not sent', error.message); return; }
    Alert.alert('Request sent', 'The hotel team has received your message.'); router.replace('/(tabs)/profile');
  }
  return <Screen><AppText style={styles.title}>How can we help?</AppText><AppText style={styles.subtitle}>Send a special request, ask a question or contact the hotel team about your stay.</AppText><View style={styles.panel}><Field label="SUBJECT" value={subject} onChangeText={setSubject} placeholder="e.g. Late check-in request"/><Field label="MESSAGE" value={message} onChangeText={setMessage} placeholder="Write your request here..." multiline style={{ minHeight: 150, textAlignVertical: 'top' }}/></View><PrimaryButton title="Send request to hotel" onPress={submit} loading={busy}/><AppText style={styles.note}>You need to sign in before submitting a request. The admin team will update the request status.</AppText></Screen>;
}
const styles = StyleSheet.create({ title: { color: colors.forest, fontSize: 30, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 22, marginTop: -7 }, panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 17 }, note: { color: colors.muted, fontSize: 11, lineHeight: 18 } });
