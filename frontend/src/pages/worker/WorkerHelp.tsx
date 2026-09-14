import { ArrowLeft, CircleHelp, PhoneCall, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkerHelp() {
  const navigate = useNavigate();

  return (
    <main style={{minHeight:"100vh",background:"#f4efe5",color:"#16394d"}}>
      <header style={{minHeight:72,display:"flex",alignItems:"center",gap:12,padding:"0 26px",background:"#103249",color:"#fff",borderBottom:"3px solid #d56a2d"}}>
        <button onClick={()=>navigate("/worker")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
        <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Help & Support</strong><div style={{color:"#b8cad5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>RAILSYNC WORKER ASSISTANCE</div></div>
      </header>

      <section style={{maxWidth:1000,margin:"0 auto",padding:"22px"}}>
        <article style={{padding:20,border:"1px solid #dfd2c1",borderRadius:10,background:"#fffdf9"}}>
          <CircleHelp size={28}/>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:28}}>Need assistance?</h1>
          <p style={{color:"#6d7d85",fontSize:11,lineHeight:1.6}}>For assignment or field-operational issues, contact your Maintenance Manager/Control authority. For a software issue, record what screen and action produced the problem.</p>

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:15}}>
            <div style={{padding:13,border:"1px solid #e7dccf",borderRadius:8,background:"#faf7f1"}}><PhoneCall size={17}/><strong style={{display:"block",marginTop:7,fontSize:11}}>Operational escalation</strong><span style={{display:"block",marginTop:4,color:"#6d7d85",fontSize:10}}>Contact your authorized Maintenance Control supervisor.</span></div>
            <div style={{padding:13,border:"1px solid #e7dccf",borderRadius:8,background:"#faf7f1"}}><Mail size={17}/><strong style={{display:"block",marginTop:7,fontSize:11}}>Application support</strong><span style={{display:"block",marginTop:4,color:"#6d7d85",fontSize:10}}>Capture the error message and share it with the RailSync demo/admin team.</span></div>
          </div>

          <div style={{marginTop:14,padding:11,borderRadius:7,background:"#edf3f5",fontSize:10,color:"#496774"}}><ShieldCheck size={14} style={{marginRight:5,verticalAlign:"middle"}}/>Emergency railway safety procedures always take priority over application instructions.</div>
        </article>
      </section>
    </main>
  );
}
