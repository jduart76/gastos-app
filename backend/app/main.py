from typing import Optional
from datetime import date
import os

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import get_session, init_db, settings
from .models import User, Purchase, Payment
from .auth import hash_pin, verify_pin, create_token, decode_token
from .services import (
    dashboard_for_month,
    pending_balance,
    purchase_monthly_amount,
)

from pydantic import BaseModel


app = FastAPI()

# ------------------------
# CORS
# ------------------------
origins = []
raw = os.getenv("CORS_ORIGINS", "")
if raw:
    origins = [x.strip() for x in raw.split(",") if x.strip()]
else:
    # fallback
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


# ------------------------
# Auth helpers
# ------------------------
def require_user(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1].strip()
    sub = decode_token(token, settings.JWT_SECRET)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    return sub


# ------------------------
# Root / Health
# ------------------------
@app.get("/")
def root():
    return {"ok": True, "service": "gastos-api"}


# ------------------------
# Auth
# ------------------------
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

    token = create_token(name, settings.JWT_SECRET, settings.TOKEN_EXPIRE_MIN)
    return {"access_token": token, "user": name}


@app.get("/api/me")
def me(user: str = Depends(require_user)):
    return {"user": user}


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


# ------------------------
# Dashboard
# ------------------------
@app.get("/api/dashboard")
def dashboard(
    month: str,
    session: Session = Depends(get_session),
    user: str = Depends(require_user),
):
    # services.dashboard_for_month debe aceptar (month, session)
    return dashboard_for_month(month, session)


# ------------------------
# Purchases
# ------------------------
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

    if mode in ("full", "half"):
        return mode, None, None

    # custom
    try:
        juan = int(payload.get("split_juan_pct"))
        kenia = int(payload.get("split_kenia_pct"))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="split_juan_pct and split_kenia_pct are required for custom split",
        )

    if not (0 <= juan <= 100 and 0 <= kenia <= 100):
        raise HTTPException(status_code=400, detail="split percentages must be 0..100")
    if juan + kenia != 100:
        raise HTTPException(status_code=400, detail="split_juan_pct + split_kenia_pct must equal 100")

    return "custom", juan, kenia


def _sum_paid(session: Session, purchase_id: int) -> float:
    pays = session.exec(select(Payment).where(Payment.purchase_id == purchase_id)).all()
    return float(sum(p.amount for p in pays))


@app.get("/api/purchases")
def list_purchases(
    user: str = Depends(require_user),
    session: Session = Depends(get_session),
):
    purchases = session.exec(select(Purchase).order_by(Purchase.purchase_date.desc())).all()
    out = []
    for p in purchases:
        paid = _sum_paid(session, p.id) if p.id else 0.0
        out.append(
            {
                "id": p.id,
                "purchase_date": str(p.purchase_date),
                "description": p.description,
                "store": p.store,
                "amount_total": round(float(p.amount_total), 2),
                "is_msi": bool(p.is_msi),
                "msi_months": p.msi_months,
                "start_month": p.start_month,
                "split_mode": p.split_mode,
                "split_juan_pct": p.split_juan_pct,
                "split_kenia_pct": p.split_kenia_pct,
                "created_by": p.created_by,
                "monthly_amount": purchase_monthly_amount(p),
                "paid": round(paid, 2),
                "pending": pending_balance(p),
            }
        )
    return out


@app.post("/api/purchases")
def create_purchase(
    payload: dict,
    user: str = Depends(require_user),
    session: Session = Depends(get_session),
):
    try:
        mode, juan_pct, kenia_pct = _validate_split(payload)

        is_msi = bool(payload.get("is_msi", False))

        # start_month solo para MSI
        start_month = payload.get("start_month")
        if is_msi and not start_month:
            raise HTTPException(status_code=400, detail="start_month required for MSI")

        p = Purchase(
            purchase_date=date.fromisoformat(payload["purchase_date"]),
            description=str(payload["description"]).strip(),
            store=str(payload["store"]).strip(),
            amount_total=float(payload["amount_total"]),
            is_msi=is_msi,
            msi_months=int(payload["msi_months"]) if is_msi and payload.get("msi_months") else None,
            start_month=str(start_month).strip() if is_msi else None,
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


# ✅ NUEVO: detalle de compra (para PurchaseDetail)
@app.get("/api/purchases/{purchase_id}")
def purchase_detail(
    purchase_id: int,
    session: Session = Depends(get_session),
    user: str = Depends(require_user),
):
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")

    payments = session.exec(
        select(Payment)
        .where(Payment.purchase_id == purchase_id)
        .order_by(Payment.payment_date.desc())
    ).all()

    paid = float(sum(x.amount for x in payments))
    purchase_out = {
        "id": p.id,
        "purchase_date": str(p.purchase_date),
        "description": p.description,
        "store": p.store,
        "amount_total": round(float(p.amount_total), 2),
        "is_msi": bool(p.is_msi),
        "msi_months": p.msi_months,
        "start_month": p.start_month,
        "split_mode": p.split_mode,
        "split_juan_pct": p.split_juan_pct,
        "split_kenia_pct": p.split_kenia_pct,
        "created_by": p.created_by,
        "monthly_amount": purchase_monthly_amount(p),
        "paid": round(paid, 2),
        "pending": pending_balance(p),
    }

    payments_out = [
        {
            "id": pay.id,
            "purchase_id": pay.purchase_id,
            "payment_date": str(pay.payment_date),
            "payer": pay.payer,
            "amount": round(float(pay.amount), 2),
            "note": pay.note,
            "split_50": bool(pay.split_50),
        }
        for pay in payments
    ]

    return {"purchase": purchase_out, "payments": payments_out}


# ------------------------
# Payments
# ------------------------
class CreatePaymentPayload(BaseModel):
    purchase_id: int
    payment_date: str  # "YYYY-MM-DD"
    payer: Optional[str] = None  # "Juan" / "Kenia"
    amount: float
    note: Optional[str] = None
    split_50: Optional[bool] = False


@app.post("/api/payments")
def create_payment(
    payload: CreatePaymentPayload,
    session: Session = Depends(get_session),
    user: str = Depends(require_user),
):
    p = session.get(Purchase, payload.purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")

    try:
        d = date.fromisoformat(payload.payment_date)
    except Exception:
        raise HTTPException(status_code=400, detail="payment_date must be YYYY-MM-DD")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")

    pay = Payment(
        purchase_id=payload.purchase_id,
        payment_date=d,
        payer=(payload.payer or user),
        amount=float(payload.amount),
        note=(payload.note or "").strip() or None,
        split_50=bool(payload.split_50),
    )

    session.add(pay)
    session.commit()
    session.refresh(pay)
    return {"id": pay.id}
