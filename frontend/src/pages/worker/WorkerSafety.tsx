import { ArrowLeft, HardHat, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkerSafety() {
  const navigate = useNavigate();

  const items = [
    ["Track possession confirmation", "Do not enter a maintenance section until block/possession authority is confirmed."],
    ["PPE verification", "Helmet, reflective vest, safety footwear, gloves and task-specific PPE must be checked before work."],
    ["Signal and traction awareness", "Confirm isolation, OHE/traction status and signal protection when applicable."],
    ["Worksite communication", "Maintain contact with the authorized supervisor and report any changed field condition immediately."],
    ["Completion clearance", "Remove tools/materials and confirm track clearance before closing the job."],
  ];

  return (
    <main style={{minHeight:"100vh",background:"#f4efe5",color:"#16394d"}}>
      <header style={{minHeight:72,display:"flex",alignItems:"center",gap:12,padding:"0 26px",background:"#103249",color:"#fff",borderBottom:"3px solid #d56a2d"}}>
        <button onClick={()=>navigate("/worker")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
        <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Safety & Guidelines</strong><div style={{color:"#b8cad5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>FIELD SAFETY PROTOCOL</div></div>
      </header>

      <section style={{maxWidth:1200,margin:"0 auto",padding:"22px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:14}}>
          <article style={{padding:18,border:"1px solid #dfd2c1",borderRadius:10,background:"#fffdf9"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}><HardHat size={21}/><h1 style={{margin:0,fontFamily:"Georgia,serif",fontSize:27}}>Before You Start</h1></div>
            <p style={{color:"#6d7d85",fontSize:11}}>RailSync operational checklist for assigned maintenance work.</p>
            <div style={{display:"grid",gap:9,marginTop:14}}>
              {items.map(([title,text],i)=>(
                <div key={title} style={{display:"grid",gridTemplateColumns:"34px 1fr",gap:10,padding:11,border:"1px solid #e7dccf",borderRadius:7,background:"#faf7f1"}}>
                  <div style={{width:30,height:30,display:"grid",placeItems:"center",borderRadius:99,background:i===0?"#fff0e5":"#edf4ef",color:i===0?"#a65b20":"#34704d"}}>{i===0?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>}</div>
                  <div><strong style={{fontSize:11}}>{title}</strong><div style={{marginTop:4,color:"#6f7f87",fontSize:10,lineHeight:1.5}}>{text}</div></div>
                </div>
              ))}
            </div>
          </article>

          <article style={{padding:18,border:"1px solid #dfd2c1",borderRadius:10,background:"#fffdf9"}}>
            <ShieldCheck size={24}/>
            <h2 style={{fontFamily:"Georgia,serif"}}>Worker Responsibility</h2>
            <p style={{color:"#6d7d85",fontSize:11,lineHeight:1.6}}>If actual field conditions differ from the assigned work order, stop or pause the task and notify Maintenance Control. Do not continue based only on the application recommendation.</p>
            <div style={{marginTop:16,padding:12,borderRadius:7,background:"#edf3f5",fontSize:10,lineHeight:1.5,color:"#496774"}}>RailSync assists coordination and record keeping. Railway operating rules, authorized block procedures and supervisor instructions remain controlling.</div>
          </article>
        </div>
      </section>
    </main>
  );
}
