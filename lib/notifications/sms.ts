/**
 * Generic SMS adapter. Configure SMS_API_URL/API_KEY/SENDER_ID only after obtaining a provider account.
 * Adapt the request body and response parsing to the chosen provider's official API specification.
 */
export async function sendSms(phone: string, message: string): Promise<{sent:boolean; providerMessageId?:string; reason?:string}> {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  if (!url || !key) return { sent:false, reason:"SMS provider is not configured" };
  try {
    const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json","authorization":`Bearer ${key}`}, body:JSON.stringify({ to:phone, message, sender_id:process.env.SMS_SENDER_ID }), cache:"no-store", signal:AbortSignal.timeout(10000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { sent:false, reason:`SMS provider returned HTTP ${response.status}` };
    return { sent:true, providerMessageId:typeof body.message_id === "string" ? body.message_id : undefined };
  } catch { return { sent:false, reason:"Could not reach SMS provider" }; }
}
