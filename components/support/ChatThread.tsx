"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { Send,LoaderCircle } from "lucide-react";
type Message={id:string;body:string;sender_is_staff:boolean;is_own:boolean;sender_name:string;created_at:string};
type Result={conversation:{id:string;status:string}|null;messages:Message[];hasMore:boolean};
function mergeMessages(old:Message[],incoming:Message[]){return [...new Map([...old,...incoming].map(message=>[message.id,message])).values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);}
export default function ChatThread({url,staff=false}:{url:string;staff?:boolean}){
  const [messages,setMessages]=useState<Message[]>([]);const [status,setStatus]=useState("open");
  const [text,setText]=useState("");const [error,setError]=useState("");const [sending,setSending]=useState(false);const [loading,setLoading]=useState(true);const [hasMore,setHasMore]=useState(false);const [olderBusy,setOlderBusy]=useState(false);
  const loadedOlder=useRef(false);
  const retry=useRef<{body:string;id:string}|null>(null);const bottom=useRef<HTMLDivElement>(null);const mounted=useRef(true);const lastId=messages.at(-1)?.id;
  const load=useCallback(async(signal?:AbortSignal)=>{
    const response=await fetch(url,{cache:"no-store",signal});const data=await response.json();
    if(!response.ok)throw new Error(data.error || "Could not load messages.");
    if(!mounted.current || signal?.aborted)return;
    const result=data as Result;setMessages(old=>mergeMessages(old,result.messages));setStatus(result.conversation?.status || "open");
    setHasMore(old=>loadedOlder.current?old:result.hasMore);setLoading(false);
    const last=result.messages.at(-1);
    if(last)await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({readThrough:last.id}),signal});
  },[url]);
  useEffect(()=>{
    mounted.current=true;const controller=new AbortController();let running=false;
    const poll=async()=>{if(document.hidden || running)return;running=true;try{await load(controller.signal);}catch(failure){if(!controller.signal.aborted && mounted.current){setError(failure instanceof Error?failure.message:"Could not load chat.");setLoading(false);}}finally{running=false;}};
    void poll();const interval=setInterval(()=>void poll(),5000);document.addEventListener('visibilitychange',poll);
    return()=>{mounted.current=false;controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',poll);};
  },[load]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest"});},[lastId]);
  async function send(event:React.FormEvent){
    event.preventDefault();const body=text.trim();if(!body || sending)return;setSending(true);setError("");
    if(retry.current?.body!==body)retry.current={body,id:crypto.randomUUID()};
    try{
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body,clientMessageId:retry.current.id})});const data=await response.json();
      if(!response.ok)throw new Error(data.error || "Could not send message.");
      if(!mounted.current)return;setText("");retry.current=null;await load();
    }catch(failure){if(mounted.current)setError(failure instanceof Error?failure.message:"Message not sent. Retry to send it.");}finally{if(mounted.current)setSending(false);}
  }
  async function older(){
    const first=messages[0];if(!first)return;loadedOlder.current=true;setOlderBusy(true);setError("");
    try{const response=await fetch(`${url}?before=${first.id}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error || "Could not load older messages.");if(mounted.current){setMessages(old=>mergeMessages(old,data.messages));setHasMore(data.hasMore);}}
    catch(failure){if(mounted.current)setError(failure instanceof Error?failure.message:"Please retry.");}finally{if(mounted.current)setOlderBusy(false);}
  }
  async function changeStatus(){
    setError("");try{const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:status==='open'?'resolved':'open'})});const data=await response.json();if(!response.ok)throw new Error(data.error || "Could not update status.");await load();}catch(failure){setError(failure instanceof Error?failure.message:"Please retry.");}
  }
  return <div className="support-thread">
    <div className="support-thread__status"><span>{status==='resolved'?"Resolved · send a message to reopen":"Hotel support · replies from our team"}</span>{staff && <button type="button" onClick={changeStatus}>{status==='open'?"Mark resolved":"Reopen"}</button>}</div>
    <div className="support-messages" role="log" aria-label="Support conversation" aria-live="polite" aria-relevant="additions text">
      {hasMore && <button type="button" className="support-older" disabled={olderBusy} onClick={older}>{olderBusy?"Loading…":"Load older messages"}</button>}
      {loading ? <p className="support-empty">Loading messages…</p> : !messages.length && <p className="support-empty">Send a message about your stay or booking. Our team will reply here.</p>}
      {messages.map(message=>{const own=message.is_own;return <article key={message.id} className={`support-message ${own?'support-message--own':''}`}>
        <span className="support-message__name">{own?"You":message.sender_is_staff?message.sender_name:"Customer"}</span><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>
      </article>;})}<div ref={bottom}/>
    </div>
    {error && <div className="support-error" role="alert">{error} <button type="button" onClick={()=>void load().then(()=>setError('')).catch(()=>{})}>Retry</button></div>}
    <form className="support-compose" onSubmit={send}><textarea aria-label="Message to support" placeholder={staff?"Reply to customer…":"Type your message…"} rows={2} maxLength={2000} value={text} disabled={sending} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter' && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/><button type="submit" aria-label="Send message" title="Send message" disabled={sending || !text.trim()}>{sending?<LoaderCircle size={19} className="animate-spin"/>:<Send size={19}/>}</button></form>
  </div>;
}
