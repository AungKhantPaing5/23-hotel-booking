import { constants, createHmac, createPublicKey, publicEncrypt } from "node:crypto";
import QRCode from "qrcode";
import { MMPaySDK } from "mmpay-node-sdk";

export type PaymentMethod = "mmqr" | "wallets_cards";
export type CheckoutInput = {
  paymentId: string; bookingId: string; amount: number; currency: string;
  customerPhone: string; customerName: string; description: string; customerEmail?: string;
};
export type CheckoutResult =
  | { method: "mmqr"; provider: "myanmyanpay_mmqr"; providerReference: string; qrDataUrl: string; qrText: string }
  | { method: "wallets_cards"; provider: "dinger"; providerReference: string; checkoutUrl: string };

function requiredEnv(...names: string[]) {
  const missing = names.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Payment gateway is not configured. Missing: ${missing.join(", ")}. Add the approved merchant credentials to .env.local.`);
}
export function paymentMethodConfigured(method: PaymentMethod) {
  if (method === "mmqr") return Boolean(process.env.MMPAY_APP_ID && process.env.MMPAY_PUBLISHABLE_KEY && process.env.MMPAY_SECRET_KEY && process.env.MMPAY_API_BASE_URL);
  return Boolean(process.env.DINGER_CLIENT_ID && process.env.DINGER_PUBLIC_KEY && process.env.DINGER_KEY_FOR_ENCRYPTION && process.env.DINGER_MERCHANT_KEY && process.env.DINGER_PROJECT_NAME && process.env.DINGER_MERCHANT_NAME && process.env.DINGER_HMAC_SECRET && process.env.DINGER_CALLBACK_KEY && process.env.NEXT_PUBLIC_APP_URL);
}

function mmPay() {
  requiredEnv("MMPAY_APP_ID", "MMPAY_PUBLISHABLE_KEY", "MMPAY_SECRET_KEY", "MMPAY_API_BASE_URL");
  return MMPaySDK({
    appId: process.env.MMPAY_APP_ID!,
    publishableKey: process.env.MMPAY_PUBLISHABLE_KEY!,
    secretKey: process.env.MMPAY_SECRET_KEY!,
    apiBaseUrl: process.env.MMPAY_API_BASE_URL!,
  });
}

export async function createMmqrCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const sdk = mmPay();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!baseUrl || !baseUrl.startsWith("https://") && process.env.NODE_ENV === "production") {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the public HTTPS website URL before enabling live MMQR payment.");
  }
  const result = await sdk.pay({
    orderId: input.paymentId,
    amount: input.amount,
    currency: "MMK",
    callbackUrl: `${baseUrl}/api/payments/webhook`,
    customMessage: input.description.slice(0, 150),
    items: [{ name: input.description.slice(0, 80), amount: input.amount, quantity: 1 }],
  });
  if (!result?.qr || typeof result.qr !== "string") throw new Error("MMQR provider did not return a QR payload.");
  const qrDataUrl = await QRCode.toDataURL(result.qr, { errorCorrectionLevel: "M", margin: 2, width: 320 });
  return { method: "mmqr", provider: "myanmyanpay_mmqr", providerReference: String(result.vendorQrRefId || input.paymentId), qrDataUrl, qrText: result.qr };
}

function normalizePublicKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;
  return `-----BEGIN PUBLIC KEY-----\n${trimmed.replace(/\s/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

export async function createDingerCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  requiredEnv("DINGER_CLIENT_ID", "DINGER_PUBLIC_KEY", "DINGER_KEY_FOR_ENCRYPTION", "DINGER_MERCHANT_KEY", "DINGER_PROJECT_NAME", "DINGER_MERCHANT_NAME", "DINGER_HMAC_SECRET", "DINGER_CALLBACK_KEY", "NEXT_PUBLIC_APP_URL");
  const payload = {
    clientId: process.env.DINGER_CLIENT_ID!,
    publicKey: process.env.DINGER_PUBLIC_KEY!,
    items: JSON.stringify([{ name: input.description.slice(0, 80), amount: input.amount, quantity: 1 }]),
    customerName: input.customerName.slice(0, 100) || "Hotel Guest",
    totalAmount: input.amount,
    merchantOrderId: input.paymentId,
    merchantKey: process.env.DINGER_MERCHANT_KEY!,
    projectName: process.env.DINGER_PROJECT_NAME!,
    merchantName: process.env.DINGER_MERCHANT_NAME!,
  };
  const plaintext = JSON.stringify(payload);
  let encrypted: Buffer;
  try {
    // Dinger's official prebuilt-checkout example encrypts the JSON payload in
    // 64-byte chunks with RSA/ECB/PKCS1Padding. Node's publicEncrypt accepts
    // one RSA-sized block at a time, so chunk the UTF-8 bytes explicitly.
    const publicKey = createPublicKey(normalizePublicKey(process.env.DINGER_KEY_FOR_ENCRYPTION!));
    const modulusBytes = Math.ceil((publicKey.asymmetricKeyDetails?.modulusLength || 1024) / 8);
    const maxChunkBytes = Math.min(64, modulusBytes - 11);
    if (maxChunkBytes < 1) throw new Error("Unsupported Dinger RSA key size.");
    const bytes = Buffer.from(plaintext, "utf8");
    const encryptedChunks: Buffer[] = [];
    for (let offset = 0; offset < bytes.length; offset += maxChunkBytes) {
      encryptedChunks.push(publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
        bytes.subarray(offset, Math.min(offset + maxChunkBytes, bytes.length)),
      ));
    }
    encrypted = Buffer.concat(encryptedChunks);
  } catch (error) {
    throw new Error(`Dinger request encryption failed. Verify DINGER_KEY_FOR_ENCRYPTION matches the provider's request-encryption key. ${error instanceof Error ? error.message : ""}`.trim());
  }
  const hashValue = createHmac("sha256", process.env.DINGER_HMAC_SECRET!).update(plaintext).digest("hex");
  const mode = (process.env.DINGER_MODE || "staging").toLowerCase();
  const base = mode === "production" ? "https://form.dinger.asia/" : "https://prebuilt.dinger.asia/";
  const checkoutUrl = `${base}?payload=${encodeURIComponent(encrypted.toString("base64"))}&hashValue=${encodeURIComponent(hashValue)}`;
  return { method: "wallets_cards", provider: "dinger", providerReference: input.paymentId, checkoutUrl };
}

export async function createCheckout(input: CheckoutInput, method: PaymentMethod): Promise<CheckoutResult> {
  if (method === "mmqr") return createMmqrCheckout(input);
  return createDingerCheckout(input);
}

export function createMMPayWebhookVerifier() {
  requiredEnv("MMPAY_APP_ID", "MMPAY_PUBLISHABLE_KEY", "MMPAY_SECRET_KEY", "MMPAY_API_BASE_URL");
  return mmPay();
}
