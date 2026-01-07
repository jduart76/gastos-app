from typing import Optional, List
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import get_session, init_db, settings
from .models import User, Purchase, Payment
from .auth import hash_pin, verify_pin, create_token, decode_token
from .services import dashboard_for_month, pending_balance, purchase_monthly_amount, month_str

import os
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from .db import engine
from .models import User
from .auth import hash_pin

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_RESET_TOKEN = os.getenv("ADMIN_RESET_TOKEN", "")

@router.post("/reset-pin")
def reset_pin(name: str, new_pin: str, token: str):
    if not ADMIN_RESET_TOKEN or token != ADMIN_RESET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    with Session(engine) as s:
        user = s.exec(select(User).where(User.name == name)).first()
        if not user:
            user = User(name=name, pin_hash=hash_pin(new_pin))
            s.add(user)
        else:
            user.pin_hash = hash_pin(new_pin)
        s.commit()
    return {"ok": True}


app = FastAPI(title="Gastos API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def require_user(authorization: Optional[str] = Header(default=None), session: Session = Depends(get_session)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sub = decode_token(token, settings.JWT_SECRET)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = session.exec(select(User).where(User.name == sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return sub

@app.on_event("startup")
def on_startup():
    init_db()
    # seed default users if not exist
    from sqlmodel import Session as S
    from .db import engine
    with S(engine) as s:
        for name in ["Juan", "Kenia"]:
            existing = s.exec(select(User).where(User.name == name)).first()
            if not existing:
                # default PINs: 1111 and 2222 (cámbialos después)
                pin = "1111" if name == "Juan" else "2222"
                s.add(User(name=name, pin_hash=hash_pin(pin)))
        s.commit()

@app.post("/api/auth/login")
def login(name: str, pin: str, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.name == name)).first()
    if not user or not verify_pin(pin, user.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(name, settings.JWT_SECRET, settings.JWT_EXPIRE_MIN)
    return {"access_token": token, "user": name}

@app.get("/api/me")
def me(user: str = Depends(require_user)):
    return {"user": user}

@app.get("/api/dashboard")
def dashboard(month: str, user: str = Depends(require_user), session: Session = Depends(get_session)):
    return dashboard_for_month(session, month)

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
            "created_by": p.created_by,
            "monthly_amount": purchase_monthly_amount(p),
            "paid": round(sum(x.amount for x in p.payments), 2),
            "pending": pending_balance(p),
        })
    return out

@app.post("/api/purchases")
def create_purchase(payload: dict, user: str = Depends(require_user), session: Session = Depends(get_session)):
    try:
        p = Purchase(
            purchase_date=date.fromisoformat(payload["purchase_date"]),
            description=payload["description"].strip(),
            store=payload["store"].strip(),
            amount_total=float(payload["amount_total"]),
            is_msi=bool(payload.get("is_msi", False)),
            msi_months=int(payload["msi_months"]) if payload.get("msi_months") else None,
            start_month=payload["start_month"],
            split_mode=payload.get("split_mode", "full"),
            created_by=user,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    if p.is_msi and (not p.msi_months or p.msi_months <= 0):
        raise HTTPException(status_code=400, detail="msi_months required for MSI")

    session.add(p)
    session.commit()
    session.refresh(p)
    return {"id": p.id}

@app.put("/api/purchases/{purchase_id}")
def update_purchase(purchase_id: int, payload: dict, user: str = Depends(require_user), session: Session = Depends(get_session)):
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Not found")

    for k in ["description", "store", "start_month", "split_mode"]:
        if k in payload and payload[k] is not None:
            setattr(p, k, str(payload[k]).strip())

    if "purchase_date" in payload and payload["purchase_date"]:
        p.purchase_date = date.fromisoformat(payload["purchase_date"])

    if "amount_total" in payload and payload["amount_total"] is not None:
        p.amount_total = float(payload["amount_total"])

    if "is_msi" in payload and payload["is_msi"] is not None:
        p.is_msi = bool(payload["is_msi"])

    if "msi_months" in payload:
        p.msi_months = int(payload["msi_months"]) if payload["msi_months"] else None

    session.add(p)
    session.commit()
    return {"ok": True}

@app.get("/api/purchases/{purchase_id}")
def purchase_detail(purchase_id: int, user: str = Depends(require_user), session: Session = Depends(get_session)):
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Not found")

    payments = []
    for pay in sorted(p.payments, key=lambda x: x.payment_date, reverse=True):
        payments.append({
            "id": pay.id,
            "payment_date": str(pay.payment_date),
            "payer": pay.payer,
            "amount": round(pay.amount, 2),
            "note": pay.note,
            "split_50": pay.split_50,
        })

    return {
        "purchase": {
            "id": p.id,
            "purchase_date": str(p.purchase_date),
            "description": p.description,
            "store": p.store,
            "amount_total": round(p.amount_total, 2),
            "is_msi": p.is_msi,
            "msi_months": p.msi_months,
            "start_month": p.start_month,
            "split_mode": p.split_mode,
            "created_by": p.created_by,
            "monthly_amount": purchase_monthly_amount(p),
            "paid": round(sum(x.amount for x in p.payments), 2),
            "pending": pending_balance(p),
        },
        "payments": payments
    }

@app.post("/api/payments")
def add_payment(payload: dict, user: str = Depends(require_user), session: Session = Depends(get_session)):
    purchase_id = int(payload["purchase_id"])
    p = session.get(Purchase, purchase_id)
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")

    pay_date = date.fromisoformat(payload["payment_date"])
    payer = payload.get("payer") or user
    amount = float(payload["amount"])
    note = payload.get("note")
    split_50 = bool(payload.get("split_50", False))
    split_mode = payload.get("split_mode", "single")  # "single" | "both"

    # Option B: auto-register both halves (Juan + Kenia)
    if split_50 and split_mode == "both":
        half = round(amount, 2)  # amount sent should be half already
        for name in ["Juan", "Kenia"]:
            session.add(Payment(
                purchase_id=purchase_id,
                payment_date=pay_date,
                payer=name,
                amount=half,
                note=(note or "") + " (auto both)",
                split_50=True
            ))
        session.commit()
        return {"ok": True, "created": 2}

    session.add(Payment(
        purchase_id=purchase_id,
        payment_date=pay_date,
        payer=payer,
        amount=amount,
        note=note,
        split_50=split_50
    ))
    session.commit()
    return {"ok": True, "created": 1}

@app.put("/api/payments/{payment_id}")
def update_payment(payment_id: int, payload: dict, user: str = Depends(require_user), session: Session = Depends(get_session)):
    pay = session.get(Payment, payment_id)
    if not pay:
        raise HTTPException(status_code=404, detail="Not found")

    if "payment_date" in payload and payload["payment_date"]:
        pay.payment_date = date.fromisoformat(payload["payment_date"])
    if "payer" in payload and payload["payer"]:
        pay.payer = str(payload["payer"]).strip()
    if "amount" in payload and payload["amount"] is not None:
        pay.amount = float(payload["amount"])
    if "note" in payload:
        pay.note = payload["note"]
    if "split_50" in payload and payload["split_50"] is not None:
        pay.split_50 = bool(payload["split_50"])

    session.add(pay)
    session.commit()
    return {"ok": True}

@app.delete("/api/payments/{payment_id}")
def delete_payment(payment_id: int, user: str = Depends(require_user), session: Session = Depends(get_session)):
    pay = session.get(Payment, payment_id)
    if not pay:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(pay)
    session.commit()
    return {"ok": True}
