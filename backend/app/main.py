from typing import Optional
from datetime import date
import os

from fastapi import FastAPI, Depends, HTTPException, Header, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import get_session, init_db, settings, engine
from .models import User, Purchase, Payment
from .auth import hash_pin, verify_pin, create_token, decode_token
from .services import dashboard_for_month, pending_balance, purchase_monthly_amount

app = FastAPI(title="Gastos API")

# --- CORS ---
# settings.CORS_ORIGINS debe ser: "https://gastos-app.pages.dev,http://localhost:5173"
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
print("CORS_ORIGINS setting:", settings.CORS_ORIGINS)
print("Parsed origins:", origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https:\/\/.*\.pages\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Admin router ---
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

app.include_router(router)

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

    user = session.exec(select(User).where(User.name == sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return sub

# --- Startup ---
@app.on_event("startup")
def on_startup():
    init_db()
    with Session(engine) as s:
        for name in ["Juan", "Kenia"]:
            existing = s.exec(select(User).where(User.name == name)).first()
            if not existing:
                pin = "1111" if name == "Juan" else "2222"
                s.add(User(name=name, pin_hash=hash_pin(pin)))
        s.commit()

# --- Health ---
@app.get("/")
def root():
    return {"ok": True}

# --- API routes ---
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

    if split_50 and split_mode == "both":
        half = round(amount, 2)
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
