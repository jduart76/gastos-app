from sqlmodel import Session, select
from .models import User
from .auth import hash_pin
from .db import engine

def ensure_user(name: str, pin: str):
    with Session(engine) as s:
        u = s.exec(select(User).where(User.name == name)).first()
        if not u:
            s.add(User(name=name, pin_hash=hash_pin(pin)))
            s.commit()

ensure_user("Juan", "1234")
ensure_user("Kenia", "1234")
