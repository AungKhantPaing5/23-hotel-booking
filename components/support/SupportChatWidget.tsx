"use client";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {MessageCircle,X} from "lucide-react";
import ChatThread from "@/components/support/ChatThread";
export default function SupportChatWidget(){
  const pathname=usePathname();const hidden=/^\/(admin|staff|login|set-password)(\/|$)/.test(pathname || '');
  const [open,setOpen]=useState(false);const [access,setAccess]=useState<'loading'|'guest'|'customer'|'staff'|'error'>('loading');const [unread,setUnread]=useState(0);const [retry,setRetry]=useState(0);const close=useRef<HTMLButtonElement>(null);const launcher=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(hidden)return;const controller=new AbortController();let running=false;
    const poll=async()=>{if(document.hidden || running)return;running=true;try{const response=await fetch('/api/support/chat?summary=1',{cache:'no-store',signal:controller.signal});if(controller.signal.aborted)return;if(response.status===401){setAccess('guest');setUnread(0);return;}if(response.status===403){setAccess('staff');return;}const data=await response.json();if(!response.ok)throw new Error();setAccess('customer');setUnread(data.unreadCount || 0);}catch{if(!controller.signal.aborted)setAccess(previous=>previous==='customer' || previous==='guest'?previous:'error');}finally{running=false;}};
    void poll();const timer=setInterval(()=>void poll(),15000);document.addEventListener('visibilitychange',poll);return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
  },[hidden,pathname,retry]);
  useEffect(()=>{if(open)close.current?.focus();},[open]);
  function dismiss(){setOpen(false);launcher.current?.focus();}
  if(hidden || access==='staff')return null;
  return <div className="support-widget" onKeyDown={event=>{if(event.key==='Escape')dismiss();}}>
    {open && <section id="hotel-support-chat" className="support-panel" role="dialog" aria-modal="false" aria-label="Hotel support chat">
      <header className="support-panel__header"><div><strong>Hotel support</strong><span>Chat with our team</span></div><button ref={close} type="button" aria-label="Close support chat" onClick={dismiss}><X size={22}/></button></header>
      {access==='customer'?<ChatThread url="/api/support/chat"/>:access==='guest'?<div className="support-welcome"><MessageCircle size={34}/><h2>How can we help?</h2><p>Sign in to message our support team and keep your conversation private.</p><Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(pathname || '/my-bookings')}`}>Sign in to chat</Link></div>:access==='error'?<div className="support-welcome" role="alert"><p>Support chat could not connect. Please retry or contact reception.</p><button className="btn btn-outline" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:<p className="support-empty">Connecting…</p>}
    </section>}
    <button ref={launcher} type="button" className="support-launcher" aria-label={open?'Close support chat':`Open support chat${unread?`, ${unread} unread replies`:''}`} aria-expanded={open} aria-controls="hotel-support-chat" onClick={()=>open?dismiss():setOpen(true)}>
      {open?<X size={26}/>:<MessageCircle size={28}/>} {!open && unread>0 && <span className="support-badge">{unread>99?'99+':unread}</span>}
    </button>
  </div>;
}
