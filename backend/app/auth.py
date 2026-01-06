from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext

# PBKDF2 is pure-python friendly and stable on Windows
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)

def hash_pin(pin: str) -> str:
    # basic input hardening
    pin = (pin or "").strip()
    if len(pin) < 3:
        raise ValueError("PIN too short")
    return pwd_context.hash(pin)

def verify_pin(pin: str, pin_hash: str) -> bool:
    pin = (pin or "").strip()
    return pwd_context.verify(pin, pin_hash)

def create_token(subject: str, secret: str, expire_min: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=expire_min)
    payload = {"sub": subject, "exp": exp}
    return jwt.encode(payload, secret, algorithm="HS256")

def decode_token(token: str, secret: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None
