import React from "react";
import { api, setToken } from "../api";
import { Segmented } from "../components/Segmented";

export function Login(props: { onDone: (user: string)=>void }) {
  const [name, setName] = React.useState<"Juan"|"Kenia">("Juan");
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const res = await api.login(name, pin);
      setToken(res.access_token);
      localStorage.setItem("user", res.user);
      props.onDone(res.user);
    } catch(e:any) {
      setErr("PIN incorrecto o usuario inválido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div style={{maxWidth:520, margin:"60px auto 0"}}>
        <div className="card" style={{gridColumn:"span 12"}}>
          <div className="label">Acceso</div>
          <div className="value">Login con PIN</div>
          <div className="hint">Usuarios: Juan / Kenia</div>

          <div className="field">
            <label>Usuario</label>
            <Segmented
              value={name}
              options={[{key:"Juan", label:"Juan"},{key:"Kenia", label:"Kenia"}]}
              onChange={(v)=>setName(v as any)}
            />
          </div>

          <div className="field">
            <label htmlFor="pin">PIN</label>
            <input id="pin" inputMode="numeric" placeholder="••••" value={pin} onChange={(e)=>setPin(e.target.value)} />
          </div>

          {err ? <div className="chip bad" style={{marginTop:8}}>{err}</div> : null}

          <div className="actions">
            <button className="btn primary" onClick={submit} disabled={loading || pin.length<3}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
