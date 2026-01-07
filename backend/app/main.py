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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
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

# ... el resto de tus endpoints igual ...
