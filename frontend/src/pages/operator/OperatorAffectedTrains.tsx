import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, RefreshCw, TrainFront } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type Train = {
  id:number; train_number?:string; train_name?:string; disruption_id?:number;
  predicted_delay_minutes?:number|string|null; priority_class?:string|null; scheduled_passage?:string|null;
};

function read(data:unknown):Train[] {
  if(Array.isArray(data)) return data as Train[];
  if(!data || typeof data!=="object") return [];
  const obj=data as Record<string,unknown>;
  return Array.isArray(obj.trains)?obj.trains as Train[]:[];
}

export default function OperatorAffectedTrains(){
  const navigate=useNavigate();
  const [items,setItems]=useState<Train[]>([]);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get("/operator/affected-trains");setItems(read(r.data));}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  return <main style={{minHeight:"100vh",background:"#f3eee4",color:"#18384a"}}>
    <header style={{minHeight:72,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 26px",background:"#0e2d43",color:"#fff",borderBottom:"3px solid #d4662b"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>navigate("/operator")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
        <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Affected Trains</strong><div style={{color:"#b9cbd5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>PREDICTED DELAY IMPACT</div></div>
      </div>
      <button onClick={()=>void load()} style={{height:38,display:"flex",alignItems:"center",gap:6,padding:"0 11px",border:0,borderRadius:6,background:"rgba(255,255,255,.08)",color:"#fff",cursor:"pointer"}}><RefreshCw size={14}/>Refresh</button>
    </header>

    <section style={{maxWidth:1150,margin:"0 auto",padding:22}}>
      <h1 style={{fontFamily:"Georgia,serif",fontSize:29,marginBottom:5}}>Train Impact Board</h1>
      <p style={{marginTop:0,color:"#6b7d86",fontSize:11}}>Services currently linked to maintenance disruption events.</p>

      {loading?<div style={{padding:35,textAlign:"center"}}>Loading...</div>:
      <div style={{display:"grid",gap:9,marginTop:14}}>
        {items.map(train=>{
          const delay=Number(train.predicted_delay_minutes ?? 0);
          return <article key={train.id} style={{display:"grid",gridTemplateColumns:"46px 1fr 110px 120px",gap:12,alignItems:"center",padding:13,border:"1px solid #ddd0bf",borderRadius:8,background:"#fffdf9"}}>
            <div style={{width:40,height:40,display:"grid",placeItems:"center",borderRadius:8,background:"#edf2f3"}}><TrainFront size={18}/></div>
            <div><strong>{train.train_number ?? `TRAIN-${train.id}`}</strong><div style={{marginTop:3,color:"#6e7e86",fontSize:10}}>{train.train_name ?? "Scheduled service"}</div></div>
            <div><small style={{display:"block",color:"#71818a"}}>Priority</small><strong>{train.priority_class ?? "NORMAL"}</strong></div>
            <div style={{textAlign:"right",color:delay>=30?"#b23b2e":delay>=15?"#9a6a21":"#34704d"}}><Clock3 size={13} style={{marginRight:4,verticalAlign:"middle"}}/><strong>+{Math.round(delay)} min</strong></div>
          </article>
        })}
      </div>}
    </section>
  </main>
}
