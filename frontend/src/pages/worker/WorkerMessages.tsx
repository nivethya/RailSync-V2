import { ArrowLeft, MessageSquare, Radio, BellRing } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkerMessages() {
  const navigate = useNavigate();

  const msgs = [
    ["Maintenance Control", "Assignment queue updated. Check My Tasks for your latest authorized work.", "CONTROL"],
    ["RailSync Realtime", "Worker/Manager events are synchronized through the shared backend when your session is connected.", "SYSTEM"],
    ["Train Control", "Any approved extension that affects operations is forwarded to Train Control for review.", "OPERATIONS"],
  ];

  return (
    <main style={{minHeight:"100vh",background:"#f4efe5",color:"#16394d"}}>
      <header style={{minHeight:72,display:"flex",alignItems:"center",gap:12,padding:"0 26px",background:"#103249",color:"#fff",borderBottom:"3px solid #d56a2d"}}>
        <button onClick={()=>navigate("/worker")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
        <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Messages</strong><div style={{color:"#b8cad5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>WORKER COMMUNICATION CENTER</div></div>
      </header>

      <section style={{maxWidth:1050,margin:"0 auto",padding:"22px"}}>
        <article style={{border:"1px solid #dfd2c1",borderRadius:10,background:"#fffdf9",overflow:"hidden"}}>
          <div style={{padding:15,borderBottom:"1px solid #e7dccf",display:"flex",alignItems:"center",gap:9}}><MessageSquare size={18}/><strong>Operational Messages</strong></div>
          {msgs.map(([from,text,type],i)=>(
            <div key={from} style={{display:"grid",gridTemplateColumns:"44px 1fr 100px",gap:11,alignItems:"center",padding:14,borderTop:i?"1px solid #eee5d9":"none"}}>
              <div style={{width:38,height:38,display:"grid",placeItems:"center",borderRadius:99,background:"#edf2f3"}}>{i===0?<Radio size={16}/>:<BellRing size={16}/>}</div>
              <div><strong style={{fontSize:11}}>{from}</strong><div style={{marginTop:4,color:"#6d7d85",fontSize:10,lineHeight:1.5}}>{text}</div></div>
              <span style={{padding:"4px 6px",borderRadius:4,background:"#f3ede4",fontSize:8,fontWeight:900,textAlign:"center"}}>{type}</span>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
