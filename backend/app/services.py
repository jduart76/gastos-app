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


def ym_le(a: str, b: str) -> bool:
    # "YYYY-MM" lexicographic works
    return a <= b


def ym_lt(a: str, b: str) -> bool:
    return a < b


def purchase_monthly_amount(p: Purchase) -> float:
    if p.is_msi and p.msi_months and p.msi_months > 0:
        return round(float(p.amount_total) / int(p.msi_months), 2)
    return round(float(p.amount_total), 2)


def _payments_for_purchase(session: Session, purchase_id: int) -> List[Payment]:
    return session.exec(select(Payment).where(Payment.purchase_id == purchase_id)).all()


def payments_sum(p: Purchase, session: Optional[Session] = None) -> float:
    if session is not None and p.id is not None:
        pays = _payments_for_purchase(session, p.id)
        return round(sum(float(pay.amount) for pay in pays), 2)
    # fallback si relationship está cargada
    pays = getattr(p, "payments", []) or []
    return round(sum(float(pay.amount) for pay in pays), 2)


def pending_balance(p: Purchase, session: Optional[Session] = None) -> float:
    return round(float(p.amount_total) - payments_sum(p, session), 2)


def expected_months_for_purchase(p: Purchase) -> List[str]:
    """
    MSI: start_month + (0..msi_months-1)
    No MSI: mes de compra (YYYY-MM)
    """
    if p.is_msi and p.msi_months and p.msi_months > 0 and p.start_month:
        return [add_months(p.start_month, i) for i in range(int(p.msi_months))]
    return [p.purchase_date.strftime("%Y-%m")]


def _installment_amounts(p: Purchase) -> List[float]:
    """
    Genera importes por mensualidad que SUMAN exactamente amount_total.
    (Para evitar desajustes por redondeo.)
    """
    total = round(float(p.amount_total), 2)

    if not (p.is_msi and p.msi_months and int(p.msi_months) > 0):
        return [total]

    n = int(p.msi_months)
    base = round(total / n, 2)
    amounts = [base] * n
    # Ajuste final para cuadrar exactamente
    amounts[-1] = round(total - base * (n - 1), 2)
    return amounts


def _paid_up_to_month(session: Session, p: Purchase, yyyy_mm: str) -> float:
    pays = session.exec(
        select(Payment).where(Payment.purchase_id == p.id)
    ).all()

    total = 0.0
    for pay in pays:
        pay_ym = month_str(pay.payment_date)

        # ✔ Solo cuenta pagos hasta el mes consultado
        # ✔ Y solo desde el inicio del plan MSI
        if ym_le(pay_ym, yyyy_mm) and (
            not p.start_month or ym_le(p.start_month, pay_ym)
        ):
            total += float(pay.amount)

    return round(total, 2)



def _remaining_for_msi_month(session: Session, p: Purchase, yyyy_mm: str) -> float:
    """
    Para MSI: calcula cuánto falta pagar EN ESE MES (yyyy_mm),
    asignando pagos acumulados a mensualidades en orden (FIFO).
    """
    if not p.id:
        return 0.0

    # Si ya está cerrada al día de hoy (o por acumulado), no debe nada
    if pending_balance(p, session) <= 0.005:
        return 0.0

    months = expected_months_for_purchase(p)  # lista de meses del plan
    if yyyy_mm not in months:
        return 0.0

    # Solo cuenta si ya inició (start_month <= yyyy_mm)
    if p.start_month and ym_lt(yyyy_mm, p.start_month):
        return 0.0

    amounts = _installment_amounts(p)
    paid_total = _paid_up_to_month(session, p, yyyy_mm)


    # Consume el pago acumulado desde la primera mensualidad
    remaining_paid = paid_total
    for m, amt in zip(months, amounts):
        if remaining_paid <= 0:
            # no hay pago para este mes, queda todo el amt
            if m == yyyy_mm:
                return round(amt, 2)
            continue

        used = min(amt, remaining_paid)
        remaining_paid -= used
        if m == yyyy_mm:
            return round(max(amt - used, 0.0), 2)

    return 0.0


def expected_due_for_month(p: Purchase, yyyy_mm: str, session: Session) -> float:
    """
    Devuelve cuánto "toca pagar" en el mes yyyy_mm, considerando:
    - Compras cerradas => 0
    - MSI => mensualidad del mes (si aplica), considerando pagos anticipados (acumulados)
    - No MSI => pago único SOLO en el mes de compra, menos lo pagado acumulado hasta ese mes
    """
    if pending_balance(p, session) <= 0.005:
        return 0.0

    if p.is_msi:
        return _remaining_for_msi_month(session, p, yyyy_mm)

    # No MSI (pago único): solo cuenta en el mes de compra
    purchase_ym = p.purchase_date.strftime("%Y-%m")
    if purchase_ym != yyyy_mm:
        return 0.0

    paid_total = _paid_up_to_month(session, p.id, yyyy_mm) if p.id else 0.0
    return round(max(float(p.amount_total) - paid_total, 0.0), 2)


def dashboard_for_month(yyyy_mm: str, session: Session) -> Dict:
    purchases = session.exec(select(Purchase)).all()

    total_pending = 0.0
    total_due_month = 0.0

    for p in purchases:
        pb = pending_balance(p, session)
        if pb > 0.005:
            total_pending += pb

        due = expected_due_for_month(p, yyyy_mm, session)
        total_due_month += due

    next_month = add_months(yyyy_mm, 1)

    total_due_next = 0.0
    for p in purchases:
        due2 = expected_due_for_month(p, next_month, session)
        total_due_next += due2

    open_count = len([p for p in purchases if pending_balance(p, session) > 0.005])

    return {
        "month": yyyy_mm,
        "next_month": next_month,
        "total_pending": round(total_pending, 2),
        "total_due_this_month": round(total_due_month, 2),
        "total_due_next_month": round(total_due_next, 2),
        "open_count": open_count,
    }
