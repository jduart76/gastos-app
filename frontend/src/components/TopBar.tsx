import React from "react";

type NavKey = "profile" | "dashboard" | "purchases";

function IconHamburger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 7h16v2H4V7zm0 6h16v2H4v-2zm0 6h16v2H4v-2z" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42z"
      />
    </svg>
  );
}

export function TopBar(props: {
  user: string | null;
  onNav: (p: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  // Bloquear scroll del body cuando el drawer está abierto (muy iOS)
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(key: NavKey) {
    setOpen(false);
    props.onNav(key);
  }

  const initials = (props.user ?? "U").slice(0, 1).toUpperCase();

  return (
    <>
      <div className="topbar iosTopbar">
        <div className="topbar-inner iosTopbarInner">
          {/* Left: Hamburger */}
          <button className="iconBtn" onClick={() => setOpen(true)} aria-label="Open menu">
            <IconHamburger />
          </button>

          {/* Center: Title */}
          <div className="iosTitle">KJ Expenses</div>

          {/* Right: small user chip (optional) */}
          <div className="iosRight">
            <span className="chip">{props.user ? `👤 ${props.user}` : "—"}</span>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {open ? <div className="drawerOverlay" onClick={() => setOpen(false)} /> : null}

      {/* Drawer */}
      <aside
  className={`drawer ${open ? "open" : ""}`}
  {...(!open ? { "aria-hidden": "true" } : {})}
>

        <div className="drawerHeader">
          <div className="drawerProfile">
            <div className="avatar">{initials}</div>
            <div>
              <div className="profileName">{props.user ?? "User"}</div>
              <div className="profileSub">Perfil y seguridad</div>
            </div>
          </div>

          <button className="iconBtn" onClick={() => setOpen(false)} aria-label="Close menu">
            <IconClose />
          </button>
        </div>

        <div className="drawerNav">
          <button className="drawerItem" onClick={() => go("profile")}>
            Perfil <span className="drawerHint">Cambiar PIN</span>
          </button>

          <button className="drawerItem" onClick={() => go("dashboard")}>
            Dashboard
          </button>

          <button className="drawerItem" onClick={() => go("purchases")}>
            Compras
          </button>

          <div className="drawerDivider" />

          <button className="drawerItem danger" onClick={props.onLogout}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
