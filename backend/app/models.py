from typing import Optional, List
from datetime import date, datetime
from sqlmodel import SQLModel, Field, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    pin_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Purchase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    purchase_date: date
    description: str
    store: str
    amount_total: float

    is_msi: bool = False
    msi_months: Optional[int] = None

    start_month: str  # "YYYY-MM" (mes del primer pago)

    # split mode for expectations (not mandatory)
    split_mode: str = "full"  # "full" | "half"

    created_by: str  # "Juan" | "Kenia"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    payments: List["Payment"] = Relationship(back_populates="purchase")

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    purchase_id: int = Field(foreign_key="purchase.id", index=True)
    payment_date: date
    payer: str  # "Juan" | "Kenia"
    amount: float
    note: Optional[str] = None

    split_50: bool = False  # this payment was a half-share payment
    created_at: datetime = Field(default_factory=datetime.utcnow)

    purchase: Optional[Purchase] = Relationship(back_populates="payments")
