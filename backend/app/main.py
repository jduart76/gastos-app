from typing import Optional
from datetime import date
import os

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import get_session, init_db, settings
from .models import User, Purchase, Payment
from .auth import hash_pin, verify_pin, create_token, decode_token
from .services import dashboard_for_month, pending_balance, purchase_monthly_amount

from pydantic import BaseModel


app = FastAPI()

# CORS
origins = []
raw = os.getenv("CORS_ORIGINS", "")
if raw:
    origins = [x.strip() for x in raw.split(",") if x.strip()]
else:
    # fallback (puedes dejarlo así o poner tu Cloudflare Pages domain)
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


# --- Auth helpers ---
def require_user(
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sub = decode_token(token, settings.JWT_SECRET)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    return sub


@app.get("/")
def root():
    return {"ok": True, "service": "gastos-api"}


@app.post("/api/auth/login")
def login(name: str, pin: str, session: Session = Depends(get_session)):
    name = (name or "").strip()
    pin = (pin or "").strip()
    if not name or not pin:
        raise HTTPException(status_code=400, detail="Missing name/pin")

    user = session.exec(select(User).where(User.name == name)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_pin(pin, user.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(name, settings.JWT_SECRET)
    return {"access_token": token, "user": name}


@app.get("/api/me")
def me(user: str = Depends(require_user)):
    return {"user": user}


@app.get("/api/dashboard")
def dashboard(month: str, user: str = Depends(require_user), session: Session = Depends(get_session)):
    # dashboard_for_month ya lo tienes en services.py
    return dashboard_for_month(month, session)


def _validate_split(payload: dict) -> tuple[str, Optional[int], Optional[int]]:
    """
    split_mode:
      - full: individual
      - half: legacy 50/50
      - custom: pct personalizados
    """
    mode = (payload.get("split_mode") or "full").strip().lower()

    if mode not in ("full", "half", "custom"):
        raise HTTPException(status_code=400, detail="split_mode must be full|half|custom")

    if mode == "full":
        return "full", None, None

    if mode == "half":
        # compat: tratamos como 50/50 (sin guardar pct obligatoriamente)
        return "half", None, None

    # custom
    try:
        juan = int(payload.get("split_juan_pct"))
        kenia = int(payload.get("split_kenia_pct"))
    except Exception:
        raise HTTPException(status_code=400, detail="split_juan_pct and split_kenia_pct are required for custom split")

    if not (0 <= juan <= 100 and 0 <= kenia <= 100):
        raise HTTPException(status_code=400, detail="split percentages must be 0..100")
    if juan + kenia != 100:
        raise HTTPException(status_code=400, detail="split_juan_pct + split_kenia_pct must equal 100")

    return "custom", juan, kenia


@app.get("/api/purchases")
def list_purchases(user: str = Depends(require_user), session: Session = Depends(get_session)):
    purchases = session.exec(select(Purchase).order_by(Purchase.purchase_date.desc())).all()
    out = []
    for p in purchases:
        out.append({
            "id": p.id,
            "purchase_date": str(p.purchase_date),
            "description": p.description,
            "store": p.store,
            "amount_total": round(p.amount_total, 2),
            "is_msi": p.is_msi,
            "msi_months": p.msi_months,
            "start_month": p.start_month,

            "split_mode": p.split_mode,
            "split_juan_pct": p.split_juan_pct,
            "split_kenia_pct": p.split_kenia_pct,

            "created_by": p.created_by,
            "monthly_amount": purchase_monthly_amount(p),
            "paid": round(sum(x.amount for x in p.payments), 2),
            "pending": pending_balance(p),
        })
    return out


@app.post("/api/purchases")
def create_purchase(payload: dict, user: str = Depends(require_user), session: Session = Depends(get_session)):
    try:
        mode, juan_pct, kenia_pct = _validate_split(payload)

        p = Purchase(
            purchase_date=date.fromisoformat(payload["purchase_date"]),
            description=payload["description"].strip(),
            store=payload["store"].strip(),
            amount_total=float(payload["amount_total"]),
            is_msi=bool(payload.get("is_msi", False)),
            msi_months=int(payload["msi_months"]) if payload.get("msi_months") else None,
            start_month=payload["start_month"],

            split_mode=mode,
            split_juan_pct=juan_pct,
            split_kenia_pct=kenia_pct,

            created_by=user,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    if p.is_msi and (not p.msi_months or p.msi_months <= 0):
        raise HTTPException(status_code=400, detail="msi_months required for MSI")

    session.add(p)
    session.commit()
    session.refresh(p)
    return {"id": p.id}


class ChangePinPayload(BaseModel):
    old_pin: str
    new_pin: str


@app.post("/api/auth/change-pin")
def change_pin(
    payload: ChangePinPayload,
    user: str = Depends(require_user),
    session: Session = Depends(get_session),
):
    u = session.exec(select(User).where(User.name == user)).first()
    if not u or not verify_pin(payload.old_pin, u.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid current PIN")

    u.pin_hash = hash_pin(payload.new_pin)
    session.add(u)
    session.commit()
    return {"ok": True}
