# 23 Hotel & Residence — Windows + Docker Setup (မြန်မာလို)

ဒီ project က hosted database account မလိုပါ။ PostgreSQL ကို Docker Desktop ထဲမှာ run ပါမယ်။ Website/Admin က Next.js API ကိုသုံးပြီး အဲဒီ server ကသာ PostgreSQL ကိုချိတ်ဆက်ပါတယ်။ Android/iOS app ကလည်း Next.js API ကိုပဲ ချိတ်ဆက်ပါတယ်။

> **လိုအပ်ချက်**
> - Windows 10/11
> - Docker Desktop install လုပ်ထားပြီး Running ဖြစ်နေခြင်း
> - Node.js 22 LTS သို့မဟုတ် အသစ်
> - PowerShell

## A. ပထမဆုံး စတင်ခြင်း

1. ZIP ကို project folder တစ်ခုထဲ Extract လုပ်ပါ။ ဥပမာ `D:\Projects\23-hotel-residence`။
2. Docker Desktop ကိုဖွင့်ပြီး Engine စတင် Run သည်အထိ စောင့်ပါ။
3. PowerShell ဖွင့်ပြီး project root folder ထဲဝင်ပါ။ `package.json` နဲ့ `docker-compose.yml` တို့ကို အဲဒီမှာ တွေ့ရပါမယ်။

```powershell
Set-Location "D:\Projects\23-hotel-residence"

# Environment files ကို ပထမဆုံးအကြိမ်သာ ဖန်တီးပါ
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }

# Docker PostgreSQL စတင်ရန်
docker compose up -d db

# Database container ကျန်းမာစွာ run သလား စစ်ရန်
docker compose ps
docker compose logs --tail 80 db

# Website dependencies install လုပ်ရန်
npm install
```

`db` service ရဲ့ State က `Up` / `healthy` ဖြစ်ရပါမယ်။ `docker compose` မအလုပ်လုပ်ရင် Docker Desktop ကို အရင် Run ပါ။

## B. ပထမဆုံး Super Admin ဖန်တီးရန်

```powershell
npm run create-admin
```

Script က email, display name, password နဲ့ confirmation ကို မေးပါလိမ့်မယ်။

- Email default: `admin@23hotel.com` (Enter နှိပ်လို့ရပါတယ်)
- Password ကို သင်ကိုယ်တိုင် ဖန်တီးပါ။ အနည်းဆုံး 10 လုံး ဖြစ်ရပါမယ်။
- Password ကို ChatGPT၊ Screenshot၊ source code သို့မဟုတ် `.env` ဖိုင်ထဲ မထည့်ပါနဲ့။

Script က password ကို salted `scrypt` hash အဖြစ် database ထဲသိမ်းပါတယ်။ နောက်ပိုင်း password မေ့သွားရင် `npm run create-admin` ကို ပြန် run ပြီး အဲဒီ email ကိုထည့်ကာ password အသစ်သတ်မှတ်နိုင်ပါတယ်။

## C. Website နဲ့ Admin ကို Run ပါ

```powershell
npm run dev
```

- Customer Website: `http://localhost:3000`
- Admin Login: `http://localhost:3000/login?next=/admin`
- Rooms Management: `http://localhost:3000/admin/rooms`
- Deals/Kitchen: `http://localhost:3000/admin/deals-kitchen`
- Staff & Roles: `http://localhost:3000/admin/staff`

Admin Login မှာ **Staff · Email** ကိုရွေးပြီး `npm run create-admin` မှာ ဖန်တီးခဲ့တဲ့ email/password ကို အသုံးပြုပါ။

Customer phone OTP က local development mode မှာ `123456` ဖြစ်ပါတယ်။ ဒါက local testing အတွက်ပဲ ဖြစ်ပြီး real SMS မပို့ပါ။ Production မှာ SMS provider/API နဲ့ OTP delivery ကို configure လုပ်ဖို့ လိုပါတယ်။

## D. Android/iPhone မှာ စမ်းရန်

Docker DB နဲ့ `npm run dev` တို့ run နေပါစေ။ PowerShell window အသစ်တစ်ခုဖွင့်ပြီး:

```powershell
Set-Location "D:\Projects\23-hotel-residence\mobile"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

`.env` ထဲက `EXPO_PUBLIC_API_URL` ကို ပြင်ပါ။

- **Android Emulator:** `http://10.0.2.2:3000`
- **ကိုယ်ပိုင် Android/iPhone:** PC နဲ့ ဖုန်းကို Wi-Fi network တစ်ခုတည်းချိတ်ပြီး PC ရဲ့ IPv4 address ကို `ipconfig` နဲ့ရှာပါ။ ဥပမာ `http://192.168.1.25:3000`။ `192.168.1.25` က ဥပမာသာ ဖြစ်ပြီး ကိုယ့် PC address နဲ့ အစားထိုးပါ။

ပြီးရင်:

```powershell
npm install
npx expo install --fix
npx expo start --lan
```

ဖုန်းမှာ Expo Go install လုပ်ပြီး QR code scan လုပ်ပါ။ မချိတ်နိုင်ရင် Windows Firewall မှာ Node.js/port 3000 ကို **Private network** အတွက်သာ allow လုပ်ပါ။ Database port 55432 ကို ဖုန်းအတွက် ဖွင့်စရာမလိုပါ။

## E. Database နဲ့ လုံခြုံရေး

- PostgreSQL database ကို Docker volume `23hotel_pgdata` ထဲ သိမ်းပါတယ်။ PC restart ဖြစ်ပြီးနောက်လည်း data ကျန်ပါမယ်။
- SQL initialization ဖိုင်က **database volume အသစ် ပထမဆုံးဖန်တီးချိန်မှာသာ** အလိုအလျောက် run ပါမယ်။
- အစကနေ စတင်တာဖြစ်ပြီး ဒီ local database ထဲမှာ မလိုအပ်တဲ့ data မရှိသေးမှသာ `docker compose down -v` သုံးပါ။ ဒီ command က local database data ကို အပြီးဖျက်နိုင်ပါတယ်။
- Supabase/cloud database ထဲရှိ အရင် data ကို ဒီ Docker database ထဲ အလိုအလျောက် မကူးပါ။ Rooms, bookings, customers နဲ့ payments တွေကို လိုအပ်ရင် သီးခြား export/import လုပ်ရပါမယ်။
- PostgreSQL ကို `127.0.0.1:55432` မှာပဲ bind လုပ်ထားပြီး phone က Next.js port 3000 ကိုသာ သုံးပါတယ်။
- `DATABASE_URL`, DB password, `SESSION_SECRET`, SMS/payment secrets တွေကို mobile app ထဲ မထည့်ပါနဲ့။
- Payment adapter တွေက MyanMyanPay MMQR နဲ့ Dinger hosted wallet/bank/card checkout ကို support လုပ်ထားပါတယ်။ Live အသုံးပြုဖို့ merchant approval, real credentials, portal ထဲမှာ payment methods enable လုပ်ခြင်း၊ public HTTPS callback/return URL နဲ့ provider sandbox စမ်းသပ်မှု လိုအပ်ပါတယ်။ SMS အတွက်လည်း သီးခြား SMS gateway လိုအပ်ပါတယ်။ Credential မထည့်ရသေးတဲ့ setup ကို live payment အဖြစ် မယူဆပါနဲ့။

## F. အဖြစ်များတဲ့ Error များ

### `Cannot connect to the Docker daemon`
Docker Desktop ကိုဖွင့်ပြီး Engine started ဖြစ်တာ စစ်ပါ။ ပြီးမှ `docker compose up -d db` ပြန် run ပါ။

### `port is already allocated`
Port 55432 ကို အခြား service အသုံးပြုနေတာ ဖြစ်နိုင်ပါတယ်။ Root `.env` နဲ့ `.env.local` နှစ်ခုလုံးမှာ `POSTGRES_PORT=55433` ပြောင်းပါ။ `DATABASE_URL` ကိုလည်း `localhost:55433` ဖြစ်အောင် ပြောင်းပြီး `docker compose up -d db` ပြန် run ပါ။

### Database password ပြောင်းပြီး connection မရတော့ခြင်း
`.env` ထဲက `POSTGRES_PASSWORD` နဲ့ `.env.local` ထဲက `DATABASE_URL` password အတူတူ ဖြစ်ရပါမယ်။ Existing PostgreSQL volume ရှိပြီးသားဆိုရင် environment password ပြောင်းခြင်းက database user password ကို အလိုအလျောက် မပြောင်းပေးနိုင်ပါ။ Data မဖျက်ပါနှင့်။ Database password ကို migration/SQL နဲ့ သီးခြားပြောင်းပါ။

### Admin Login မအောင်မြင်ခြင်း
`npm run create-admin` ကို root folder မှာ run လုပ်ထားကြောင်း၊ `docker compose ps` မှာ database run နေကြောင်း စစ်ပါ။ `npm run create-admin` က account အတွက် local password ကို အသစ်ပြန်သတ်မှတ်ပေးနိုင်ပါတယ်။


## Room photo uploads (local file storage)

In Admin → Rooms, select a JPG, PNG, or WebP image (maximum 5 MB) from your computer instead of pasting an image URL. The server checks the image's binary signature and stores it at `storage/rooms/`; the room's `image_url` column stores a relative URL such as `/uploads/rooms/<generated-id>.jpg`. A Next.js route serves each uploaded file, so images added after the app starts work in both development and production. The mobile app resolves the relative path against `EXPO_PUBLIC_API_URL`.

Keep `storage/rooms/` when backing up or moving the project. Database backups do not contain image files. In this Docker PostgreSQL setup, the web app runs with `npm run dev` on the host, so the upload folder is stored in the project directory. If you later move the Next.js app into a container, mount a persistent volume for `/app/storage/rooms`. Uploaded files require the web server's local filesystem to be writable.

## G. Kitchen နဲ့ Deals ပုံ Upload လုပ်ရန်

Admin → Deals & Kitchen မှာ **Add Kitchen item** သို့မဟုတ် **Add a Deal** ကိုနှိပ်ပြီး Photo ကို `Choose photo file` နဲ့ ရွေးနိုင်ပါတယ်။ JPG, PNG, WebP ဖြစ်ရပြီး 5 MB အထိ support လုပ်ပါတယ်။ Preview ကိုစစ်ပြီး Add item / Save changes ကိုနှိပ်ပါ။ Active/Published ထားတဲ့ item ဓာတ်ပုံတွေကို Customer Website ရဲ့ `/services` စာမျက်နှာနဲ့ Mobile App ရဲ့ Services & deals tab မှာ ပြသပါမယ်။

ဓာတ်ပုံတွေကို `storage/services/` အောက်မှာ သိမ်းထားပြီး PostgreSQL ရဲ့ `services.image_url` column မှာ `/uploads/services/<generated-id>.jpg` လို path ကို သိမ်းပါတယ်။ Database backup တစ်ခုတည်းက ဓာတ်ပုံဖိုင်တွေကို မပါဝင်တဲ့အတွက် project ပြောင်းရွှေ့/backup လုပ်တဲ့အခါ `storage/services/` folder ကိုပါ ကူးယူပါ။

**ရှိပြီးသား Docker Database အတွက် အရေးကြီးသည်:** အရင်က database volume ကို ဖန်တီးပြီးသားဆိုရင် `001_schema.sql` အသစ်ပြောင်းထားတာက column အသစ်ကို အလိုအလျောက် ထပ်မထည့်ပေးပါ။ Project root မှာရှိနေပြီး Docker database run နေချိန်၊ အောက်ပါ migration ကို တစ်ကြိမ် Run ပါ။

```powershell
Get-Content .\\docker\\postgres\\migrations\\002_services_image_url.sql | docker compose exec -T db psql -U hotel_app -d 23hotel
```

Query result မှာ `ALTER TABLE` အောင်မြင်ကြောင်း ပြရပါမယ်။ Production/backup လိုအပ်ချက်အတွက် `storage/services/` ကို database backup နဲ့အတူ သိမ်းဆည်းပါ။

## Booking deposit payment update

After replacing the project files, run this once against an existing Docker database from the project root:

```powershell
Get-Content .\docker\postgres\migrations\003_booking_deposit_payment_type.sql -Raw | docker compose exec -T db psql -U hotel_app -d 23hotel
Get-Content .\docker\postgres\migrations\004_room_assignment.sql -Raw |
  docker compose exec -T db psql -U hotel_app -d 23hotel
```

If your `.env` uses a different `POSTGRES_USER` or `POSTGRES_DB`, substitute those values in the command. Set `BOOKING_DEPOSIT_PERCENT=30` in both `.env` and `.env.local` (or your chosen percentage from 1 to 100); keep `NEXT_PUBLIC_BOOKING_DEPOSIT_PERCENT` equal to it for the web label. In `mobile/.env`, set `EXPO_PUBLIC_BOOKING_DEPOSIT_PERCENT=30` to match. The API calculates the authoritative amount server-side.

The customer sees deposit-payment choices after the hotel confirms the booking: **MMQR** through MyanMyanPay, or a **wallets/banks/cards hosted checkout** through Dinger. Add approved merchant credentials to `.env.local`, configure callback/return URLs on the provider dashboard, expose the site over public HTTPS, and test with the provider sandbox. MMQR callbacks are verified through the MyanMyanPay SDK; Dinger callbacks are decrypted and checksum-verified. A browser redirect alone never marks a payment as paid. Available bank/wallet/card options depend on methods approved and enabled for the hotel merchant account.

Reception can assign the physical room number while checking a confirmed reservation in. Guests can only order Kitchen/Deals or request hotel services against their own confirmed or checked-in booking.
