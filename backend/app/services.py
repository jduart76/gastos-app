from __future__ import annotations
from typing import Dict, List, Tuple, Optional
from datetime import date
from sqlmodel import Session, select
from .models import Purchase, Payment

def month_str(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"

def add_months(yyyy_mm: str, n: int) -> str:
    y, m = map(int, yyyy_mm.split("-"))
    m2 = m + n
    y += (m2 - 1) // 12
    m = ((m2 - 1) % 12) + 1
    return f"{y:04d}-{m:02d}"

def purchase_monthly_amount(p: Purchase) -> float:
    if p.is_msi and p.msi_months and p.msi_months > 0:
        return round(p.amount_total / p.msi_months, 2)
    return round(p.amount_total, 2)

def payments_sum(p: Purchase) -> float:
    return round(sum(pay.amount for pay in p.payments), 2)

def pending_balance(p: Purchase) -> float:
    return round(p.amount_total - payments_sum(p), 2)

def expected_months_for_purchase(p: Purchase) -> List[str]:
    if p.is_msi and p.msi_months and p.msi_months > 0:
        return [add_months(p.start_month, i) for i in range(p.msi_months)]
    return [p.start_month]

def expected_due_for_month(p: Purchase, yyyy_mm: str) -> float:
    # If purchase is not scheduled in that month, 0
    if yyyy_mm not in expected_months_for_purchase(p):
        return 0.0

    base = purchase_monthly_amount(p)
    # if split_mode=half, expectation for "you" is half, but we keep calculations global;
    # we'll show both (total & "my share") in dashboard later if needed.
    return base

def paid_in_month(session: Session, purchase_id: int, yyyy_mm: str) -> float:
    q = select(Payment).where(Payment.purchase_id == purchase_id)
    pays = session.exec(q).all()
    total = 0.0
    for pay in pays:
        if month_str(pay.payment_date) == yyyy_mm:
            total += float(pay.amount)
    return round(total, 2)

def dashboard_for_month(yyyy_mm: str, session: Session) -> Dict:
    purchases = session.exec(select(Purchase)).all()
    open_purchases = []
    total_pending = 0.0
    total_due_month = 0.0

    for p in purchases:
        pb = pending_balance(p)
        if pb > 0.005:
            open_purchases.append(p)
            total_pending += pb

        due = expected_due_for_month(p, yyyy_mm)
        if due > 0:
            paid = paid_in_month(session, p.id, yyyy_mm) if p.id else 0.0
            remaining_for_month = max(due - paid, 0.0)
            total_due_month += remaining_for_month

    next_month = add_months(yyyy_mm, 1)

    total_due_next = 0.0
    for p in purchases:
        due = expected_due_for_month(p, next_month)
        if due > 0:
            paid = paid_in_month(session, p.id, next_month) if p.id else 0.0
            total_due_next += max(due - paid, 0.0)

    return {
        "month": yyyy_mm,
        "next_month": next_month,
        "total_pending": round(total_pending, 2),
        "total_due_this_month": round(total_due_month, 2),
        "total_due_next_month": round(total_due_next, 2),
        "open_count": len([p for p in purchases if pending_balance(p) > 0.005]),
    }

