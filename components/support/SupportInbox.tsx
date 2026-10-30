"use client";
import {useEffect,useState} from "react";
import ChatThread from "@/components/support/ChatThread";
type Conversation={id:string;status:string;full_name:string;email:string|null;phone:string|null;last_message:string;unread_count:number};
export default function SupportInbox(){
  const [rows,setRows]=useState<Conversation[]>([]);const [selected,setSelected]=useState<Conversation|null>(null);const [search,setSearch]=useState('');const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let running=false;const poll=async()=>{if(document.hidden || running)return;running=true;try{const response=await fetch(`/api/admin/support?${new URLSearchParams({q:search.trim()})}`,{cache:'no-store',signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error || 'Could not load support inbox.');if(!controller.signal.aborted){setRows(data.conversations);setError('');}}catch(failure){if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Could not load inbox.');}finally{running=false;}};
    const first=setTimeout(()=>void poll(),250);const timer=setInterval(()=>void poll(),5000);return()=>{controller.abort();clearTimeout(first);clearInterval(timer);};
  },[search]);
  return <div className="support-inbox"><aside className="support-inbox__list"><label className="field">FIND CUSTOMER<input className="control" type="search" maxLength={100} placeholder="Name, email or phone" value={search} onChange={event=>setSearch(event.target.value)}/></label>{error && <p role="alert" className="support-error">{error}</p>}
    {!rows.length && !error && <p className="support-empty">No conversations yet. Customer messages will appear here.</p>}
    {rows.map(row=><button type="button" key={row.id} className={`support-contact ${selected?.id===row.id?'support-contact--active':''}`} onClick={()=>setSelected(row)}><strong>{row.full_name || row.email || 'Guest'}</strong>{row.unread_count>0 && <span className="support-contact__count">{row.unread_count}</span>}<small>{row.email || row.phone}</small><p>{row.last_message || 'No messages'}</p><small>{row.status==='resolved'?'Resolved':'Open'}</small></button>)}
    </aside><section className="support-inbox__thread">{selected?<><header className="support-inbox__customer"><strong>{selected.full_name || 'Guest'}</strong><span>{selected.email} {selected.phone?` · ${selected.phone}`:''}</span></header><ChatThread key={selected.id} url={`/api/admin/support/${selected.id}`} staff/></>:<div className="support-welcome"><h2>Customer support</h2><p>Select a conversation to read messages and reply.</p></div>}</section></div>;
}
