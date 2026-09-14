import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, TrainFront, Route as RouteIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type Disruption = {
  id: number;
  disruption_code?: string;
  status?: string;
  reason?: string;
  severity?: string;
  estimated_delay_minutes?: number | string | null;
  expected_start?: string | null;
  expected_end?: string | null;
  affected_train_count?: number;
  alternative_count?: number;
  job?: { job_code?: string; title?: string; } | null;
};

function read(data: unknown): Disruption[] {
  if (Array.isArray(data)) return data as Disruption[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.disruptions) ? obj.disruptions as Disruption[] : [];
}

function pretty(v?: string) {
  return String(v ?? "UNKNOWN").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function OperatorDisruptions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Disruption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await api.get("/operator/disruptions");
      setItems(read(r.data));
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Unable to load disruptions.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main style={{minHeight:"100vh",background:"#f3eee4",color:"#18384a"}}>
      <header style={{minHeight:72,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 26px",background:"#0e2d43",color:"#fff",borderBottom:"3px solid #d4662b"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>navigate("/operator")} style={{width:38,height:38,border:"1px solid rgba(255,255,255,.18)",borderRadius:8,background:"rgba(255,255,255,.06)",color:"#fff",cursor:"pointer"}}><ArrowLeft size={18}/></button>
          <div><strong style={{fontFamily:"Georgia,serif",fontSize:25}}>Disruptions</strong><div style={{color:"#b9cbd5",fontSize:9,fontWeight:900,letterSpacing:".15em"}}>TRAIN CONTROL EVENT QUEUE</div></div>
        </div>
        <button onClick={()=>void load()} style={{height:38,display:"flex",alignItems:"center",gap:6,padding:"0 11px",border:0,borderRadius:6,background:"rgba(255,255,255,.08)",color:"#fff",cursor:"pointer"}}><RefreshCw size={14}/>Refresh</button>
      </header>

      <section style={{maxWidth:1250,margin:"0 auto",padding:22}}>
        {error && <div style={{padding:10,background:"#fff0eb",color:"#98432d",borderRadius:7,marginBottom:12}}>{error}</div>}
        <h1 style={{fontFamily:"Georgia,serif",fontSize:29,marginBottom:5}}>Operational Disruption Queue</h1>
        <p style={{marginTop:0,color:"#6b7d86",fontSize:11}}>Maintenance extensions and active infrastructure constraints requiring Train Control review.</p>

        {loading ? <div style={{padding:35,textAlign:"center"}}>Loading...</div> :
        <div style={{display:"grid",gap:10,marginTop:14}}>
          {items.map(item => (
            <article key={item.id} style={{display:"grid",gridTemplateColumns:"48px 1fr 230px",gap:12,alignItems:"center",padding:14,border:"1px solid #ddd0bf",borderRadius:9,background:"#fffdf9"}}>
              <div style={{width:42,height:42,display:"grid",placeItems:"center",borderRadius:8,background:"#fff0e8",color:"#ad4c2d"}}><AlertTriangle size={18}/></div>
              <div>
                <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong>{item.disruption_code ?? `DSP-${item.id}`}</strong><span style={{fontSize:8,fontWeight:900,padding:"3px 6px",background:"#edf2f3",borderRadius:4}}>{pretty(item.status)}</span></div>
                <div style={{marginTop:5,fontSize:12,fontWeight:700}}>{item.job?.title ?? item.reason ?? "Railway disruption"}</div>
                <div style={{marginTop:4,color:"#6e7e86",fontSize:9}}>{item.reason}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <div style={{padding:8,borderRadius:6,background:"#f7f3ed"}}><TrainFront size={13}/><small style={{display:"block",marginTop:3}}>Affected</small><strong>{item.affected_train_count ?? 0}</strong></div>
                <div style={{padding:8,borderRadius:6,background:"#f7f3ed"}}><RouteIcon size={13}/><small style={{display:"block",marginTop:3}}>Alternatives</small><strong>{item.alternative_count ?? 0}</strong></div>
              </div>
            </article>
          ))}
        </div>}
      </section>
    </main>
  );
}
