import React from "react";
import { api } from "../api";

export function ChangePin() {
  const [oldPin, setOldPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      await api.changePin(oldPin, newPin);
      setMsg("PIN actualizado correctamente ✅");
      setOldPin("");
      setNewPin("");
    } catch (e: any) {
      setErr("PIN actual incorrecto o sesión inválida.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="label">Seguridad</div>
      <div className="value">Cambiar PIN</div>

      <div className="field">
        <label htmlFor="oldPin">PIN actual</label>
        <input
          id="oldPin"
          inputMode="numeric"
          placeholder="••••"
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="newPin">Nuevo PIN</label>
        <input
          id="newPin"
          inputMode="numeric"
          placeholder="••••"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
        />
      </div>

      {err ? <div className="chip bad" style={{ marginTop: 8 }}>{err}</div> : null}
      {msg ? <div className="chip good" style={{ marginTop: 8 }}>{msg}</div> : null}

      <div className="actions">
        <button
          className="btn primary"
          onClick={submit}
          disabled={loading || oldPin.length < 3 || newPin.length < 3}
        >
          {loading ? "Actualizando..." : "Actualizar PIN"}
        </button>
      </div>
    </div>
  );
}
