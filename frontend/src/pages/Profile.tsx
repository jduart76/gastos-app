import React from "react";
import { api, clearToken } from "../api";
import { Card } from "../components/Card";

type Props = {
  user: string;
  onBack: () => void;
  onLogout: () => void;
  onUserUpdated: (user: string) => void;
};

export function ProfilePage({ user, onBack, onLogout }: Props) {
  const [oldPin, setOldPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    setSuccess(null);

    if (!oldPin || !newPin || !confirmPin) {
      setError("Completa todos los campos.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("El nuevo PIN no coincide.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError("El PIN debe ser de 4 dígitos numéricos.");
      return;
    }

    setLoading(true);
    try {
      await api.changePin(oldPin, newPin); // <-- AQUÍ está el fix (no es export suelto)

      setSuccess("PIN actualizado ✅");
      setOldPin("");
      setNewPin("");
      setConfirmPin("");

      // (Opcional) por seguridad: forzar logout después de cambiar PIN
      // setTimeout(forceLogout, 700);
    } catch (e: any) {
      setError(String(e?.message ?? e ?? "Error al cambiar PIN"));
    } finally {
      setLoading(false);
    }
  }

  function forceLogout() {
    clearToken();
    onLogout();
  }

  return (
    <div className="profilePage">
      <div className="profileHeader">
        <div className="profileTitle">Perfil</div>
        <button className="btn" onClick={onBack}>
          Volver
        </button>
      </div>

      <div className="profileCards">
        <Card label="Usuario" value={user} hint="Usuario autenticado" />
      </div>

      <div className="profilePanel">
        <div className="profileSectionTitle">Cambiar PIN</div>

        <div className="field">
          <label>PIN actual</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Nuevo PIN (4 dígitos)</label>
          <input
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Confirmar nuevo PIN</label>
          <input
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
          />
        </div>

        {error ? <div className="profileMsg errorBox">{error}</div> : null}
        {success ? <div className="profileMsg okBox">{success}</div> : null}

        <div className="actions">
          <button className="btn primary" onClick={submit} disabled={loading}>
            {loading ? "Guardando..." : "Actualizar PIN"}
          </button>
          <button className="btn danger" onClick={forceLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
