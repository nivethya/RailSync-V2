import { ArrowLeft, BookOpen, FileText, Map, Wrench, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkerResources() {
  const navigate = useNavigate();

  const cards = [
    ["Maintenance SOP", "Standard task execution and closure checklist.", FileText],
    ["Railway Map Layer", "Use the Live Map to locate your assigned maintenance point.", Map],
    ["Work Log", "Review your recorded task activity and progress history.", Wrench],
    ["Safety Guide", "Field safety checklist before starting any work.", BookOpen],
  ];

  return (
    <main style={{minHeight:"100vh",background:"#f4efe5",color:"#16394d"}}>
      <header style={{minHeight:72,display:"flex",alignItems:"center",gap:12,padding:"0 26px",background:"#103249",color:"#fff",borderBottom:"3px solid #d56a2d"}}>
        <button onClick={()=>navigate("/worker")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
        <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Resources</strong><div style={{color:"#b8cad5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>WORKER REFERENCE CENTER</div></div>
      </header>

      <section style={{maxWidth:1150,margin:"0 auto",padding:"22px"}}>
        <h1 style={{fontFamily:"Georgia,serif",fontSize:29,marginBottom:5}}>Field Resources</h1>
        <p style={{color:"#6d7d85",fontSize:11}}>Quick access to RailSync worker tools and reference material.</p>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:15}}>
          {cards.map(([title,text,Icon],i)=>{
            const CardIcon = Icon as typeof FileText;
            const path = i===1?"/worker/map":i===2?"/worker/work-log":i===3?"/worker/safety":"/worker/tasks";
            return (
              <button key={String(title)} onClick={()=>navigate(path)} style={{display:"grid",gridTemplateColumns:"46px 1fr 24px",gap:11,alignItems:"center",padding:15,border:"1px solid #dfd2c1",borderRadius:9,background:"#fffdf9",color:"#16394d",textAlign:"left",cursor:"pointer"}}>
                <div style={{width:42,height:42,display:"grid",placeItems:"center",borderRadius:8,background:"#edf2f3"}}><CardIcon size={18}/></div>
                <div><strong style={{fontSize:12}}>{String(title)}</strong><div style={{marginTop:4,color:"#6d7d85",fontSize:10}}>{String(text)}</div></div>
                <ExternalLink size={14}/>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  );
}
