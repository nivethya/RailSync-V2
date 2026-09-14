import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, History, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type Alt={id:number;alternative_code?:string;title?:string;status?:string;selected_at?:string|null;selected_by_user_id?:number|null;predicted_delay_minutes?:number|string|null;};
function read(data:unknown):Alt[]{if(Array.isArray(data))return data as Alt[];if(!data||typeof data!=="object")return[];const o=data as Record<string,unknown>;return Array.isArray(o.alternatives)?o.alternatives as Alt[]:[]}

export default function OperatorDecisionLog(){
  const navigate=useNavigate();
  const [items,setItems]=useState<Alt[]>([]);
  const load=useCallback(async()=>{const r=await api.get("/operator/alternatives");setItems(read(r.data).filter(x=>String(x.status??"").toUpperCase()==="SELECTED"));},[]);
  useEffect(()=>{void load();},[load]);

  return <main style={{minHeight:"100vh",background:"#f3eee4",color:"#18384a"}}>
    <header style={{minHeight:72,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 26px",background:"#0e2d43",color:"#fff",borderBottom:"3px solid #d4662b"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>navigate("/operator")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button><div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Decision Log</strong><div style={{color:"#b9cbd5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>OPERATOR ACTION AUDIT</div></div></div>
      <button onClick={()=>void load()} style={{height:38,display:"flex",alignItems:"center",gap:6,padding:"0 11px",border:0,borderRadius:6,background:"rgba(255,255,255,.08)",color:"#fff",cursor:"pointer"}}><RefreshCw size={14}/>Refresh</button>
    </header>
    <section style={{maxWidth:1000,margin:"0 auto",padding:22}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><History size={20}/><h1 style={{fontFamily:"Georgia,serif",fontSize:29}}>Selected Operational Decisions</h1></div>
      <div style={{display:"grid",gap:9}}>
        {items.length===0?<div style={{padding:30,textAlign:"center",border:"1px solid #ddd0bf",borderRadius:9,background:"#fffdf9",color:"#71818a"}}>No operator decisions selected yet.</div>:
        items.map(item=><article key={item.id} style={{display:"grid",gridTemplateColumns:"42px 1fr 140px",gap:11,alignItems:"center",padding:13,border:"1px solid #ddd0bf",borderRadius:8,background:"#fffdf9"}}>
          <div style={{width:38,height:38,display:"grid",placeItems:"center",borderRadius:99,background:"#e8f2eb",color:"#2c6d49"}}><CheckCircle2 size={17}/></div>
          <div><strong>{item.alternative_code ?? `ALT-${item.id}`}</strong><div style={{marginTop:3,color:"#6e7e86",fontSize:10}}>{item.title ?? "Selected operational action"}</div></div>
          <div style={{textAlign:"right",fontSize:9,color:"#5d7079"}}>Predicted delay<br/><strong style={{fontSize:13}}>{Math.round(Number(item.predicted_delay_minutes??0))} min</strong></div>
        </article>)}
      </div>
    </section>
  </main>
}
