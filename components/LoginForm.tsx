"use client";
import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

type AuthResponse={error?:string;message?:string;developmentCode?:string};
export default function LoginForm({staffOnly=false}:{staffOnly?:boolean}) {
  const params=useSearchParams();
  const [flow,setFlow]=useState<"login"|"register"|"reset">("login");
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");
  const [phone,setPhone]=useState("");const [otp,setOtp]=useState("");const [fullName,setFullName]=useState("");
  const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  const passwordLogin=staffOnly || flow==="login";
  function changeFlow(value:typeof flow){setFlow(value);setSent(false);setOtp("");setPassword("");setConfirm("");setError("");setMessage("");}
  function finish(){
    const requested=params.get("next");
    const destination=staffOnly
      ? requested && /^\/admin(?:\/|\?|$)/.test(requested)?requested:"/admin"
      : requested?.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/admin")?requested:"/my-bookings";
    window.location.replace(destination);
  }
  async function submit(event:React.FormEvent){
    event.preventDefault();setError("");setMessage("");setBusy(true);
    try{
      let endpoint:string;let payload:Record<string,string>;
      if(passwordLogin){endpoint=staffOnly?"/api/auth/staff-login":"/api/auth/customer-login";payload={email:email.trim().toLowerCase(),password};}
      else if(!sent){
        const normalized=phone.replace(/[\s()-]/g,"");
        if(!/^09\d{9}$/.test(normalized))throw new Error("Enter an 11-digit phone number starting with 09.");
        endpoint="/api/auth/otp/request";payload={email:email.trim().toLowerCase(),phone:normalized,fullName:flow==="register"?fullName:""};
      }else{
        if(password.length<10 || password.length>256)throw new Error("Set a password with 10 to 256 characters.");
        if(password!==confirm)throw new Error("Passwords do not match.");
        endpoint="/api/auth/otp/verify";payload={email:email.trim().toLowerCase(),phone,code:otp.trim(),password};
      }
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json() as AuthResponse;
      if(!response.ok)throw new Error(body.error || "Could not complete sign in.");
      if(!passwordLogin && !sent){setSent(true);setMessage(body.developmentCode?`Local testing OTP: ${body.developmentCode}`:"A verification code was sent to your phone.");}
      else finish();
    }catch(failure){setError(failure instanceof Error?failure.message:"Could not sign in.");}finally{setBusy(false);}
  }
  return <main className="grid min-h-screen bg-white md:grid-cols-2">
    <section className="relative hidden bg-[#142238] p-12 text-white md:flex md:flex-col md:justify-between"><Link href="/" className="serif flex items-center gap-3 text-2xl"><BrandLogo size={56}/>23 Hotel & Residence</Link><div><p className="eyebrow mb-5">YOUR NEXT STAY STARTS HERE</p><h1 className="serif text-5xl leading-tight">A little more<br/>room to relax.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-[#d0d7e0]">Sign in securely to manage reservations and hotel operations.</p></div><p className="text-xs text-[#a9b5c2]">A refined city stay.</p></section>
    <section className="flex items-center justify-center p-6"><div className="w-full max-w-md"><Link href="/" className="serif mb-12 flex items-center gap-3 text-xl md:hidden"><BrandLogo size={44}/>23 Hotel & Residence</Link><p className="eyebrow mb-3">ACCOUNT ACCESS</p><h2 className="serif text-4xl">{passwordLogin?"Welcome back.":flow==="register"?"Create your account.":"Set or reset password."}</h2>
      <p className="mt-3 text-sm leading-6 text-[#6f7886]">{passwordLogin?"Sign in with your email and password.":"Verify your registered 09 phone number, then set a password for future sign-ins."}</p>
      {!staffOnly && <div className="mt-6 flex gap-3"><button type="button" disabled={busy} className={`btn ${flow==="login"?"btn-primary":"btn-outline"}`} onClick={()=>changeFlow("login")}>Sign in</button><button type="button" disabled={busy} className={`btn ${flow==="register"?"btn-primary":"btn-outline"}`} onClick={()=>changeFlow("register")}>Create account</button></div>}
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="field">{staffOnly?"WORK EMAIL":"EMAIL ADDRESS"}<input className="control" type="email" autoComplete="username" required maxLength={254} value={email} disabled={sent || busy} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label>
        {!passwordLogin && <>
          {!sent && flow==="register" && <label className="field">YOUR NAME (OPTIONAL)<input className="control" maxLength={100} value={fullName} onChange={event=>setFullName(event.target.value)}/></label>}
          <label className="field">PHONE NUMBER<input className="control" type="tel" autoComplete="tel" required placeholder="09xxxxxxxxx" pattern="09[0-9]{9}" maxLength={11} value={phone} disabled={sent || busy} onChange={event=>setPhone(event.target.value)}/></label>
          {sent && <label className="field">SMS VERIFICATION CODE<input className="control" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event=>setOtp(event.target.value)}/></label>}
        </>}
        {(passwordLogin || sent) && <label className="field">{passwordLogin?"PASSWORD":"NEW PASSWORD"}<input className="control" type="password" autoComplete={passwordLogin?"current-password":"new-password"} required minLength={passwordLogin?undefined:10} maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/></label>}
        {!passwordLogin && sent && <label className="field">CONFIRM PASSWORD<input className="control" type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={confirm} onChange={event=>setConfirm(event.target.value)}/></label>}
        {message && <p role="status" className="rounded bg-[#f6f3ec] p-3 text-xs text-[#526057]">{message}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy?"Please wait…":passwordLogin?staffOnly?"Sign in to staff portal":"Sign in to your account":sent?"Verify & save password":"Send verification code"}</button>
        {!staffOnly && passwordLogin && <button type="button" disabled={busy} className="text-xs underline" onClick={()=>changeFlow("reset")}>Set or reset password</button>}
        {!passwordLogin && sent && <button type="button" disabled={busy} className="text-xs underline" onClick={()=>{setSent(false);setOtp("");setMessage("");}}>Change email or phone number</button>}
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {params.get("reason") && <p className="mt-4 text-sm text-[#6f7886]">Please sign in with an active {staffOnly?"staff":"customer"} account to continue.</p>}
      <p className="mt-7 text-xs leading-5 text-[#6f7886]">{staffOnly?"Use the account created by your hotel administrator.":"Phone verification is needed when creating an account or setting/resetting a password. Returning guests use email and password."}</p><Link href="/" className="mt-8 inline-block text-xs text-[#526057]">← Back to hotel</Link>
    </div></section>
  </main>;
}
