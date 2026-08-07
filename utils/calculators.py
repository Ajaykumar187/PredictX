from datetime import datetime

def emi(principal: float, annual_rate_pct: float, tenure_months: int) -> dict:
    r = annual_rate_pct / 12 / 100
    if r == 0:
        emi_amount = principal / tenure_months
    else:
        emi_amount = principal * r * (1 + r) ** tenure_months / ((1 + r) ** tenure_months - 1)
    total_payment = emi_amount * tenure_months
    total_interest = total_payment - principal
    return {"emi": round(emi_amount, 2), "total_payment": round(total_payment, 2),
            "total_interest": round(total_interest, 2)}


def cagr(begin_value: float, end_value: float, years: float) -> float:
    if begin_value <= 0 or years <= 0:
        return 0.0
    return round(((end_value / begin_value) ** (1 / years) - 1) * 100, 2)


def xirr(cashflows: list) -> float:
    if len(cashflows) < 2:
        return 0.0
    dates = [d for d, _ in cashflows]
    amounts = [a for _, a in cashflows]
    t0 = min(dates)
    years = [(d - t0).days / 365.0 for d in dates]

    def npv(rate):
        return sum(a / (1 + rate) ** y for a, y in zip(amounts, years))

    def npv_derivative(rate):
        return sum(-y * a / (1 + rate) ** (y + 1) for a, y in zip(amounts, years))

    rate = 0.1
    for _ in range(100):
        f = npv(rate)
        fprime = npv_derivative(rate)
        if abs(fprime) < 1e-10:
            break
        new_rate = rate - f / fprime
        if abs(new_rate - rate) < 1e-6:
            rate = new_rate
            break
        rate = new_rate

    if not (-0.9999 < rate < 10):
        lo, hi = -0.9999, 10.0
        for _ in range(200):
            mid = (lo + hi) / 2
            if npv(lo) * npv(mid) <= 0:
                hi = mid
            else:
                lo = mid
        rate = (lo + hi) / 2

    return round(rate * 100, 2)


def brokerage_calculator(buy_price: float, sell_price: float, qty: int,
                          brokerage_per_order: float = 20.0, is_intraday: bool = False) -> dict:
    turnover_buy = buy_price * qty
    turnover_sell = sell_price * qty
    total_turnover = turnover_buy + turnover_sell

    brokerage = min(brokerage_per_order, turnover_buy * 0.0003) + min(brokerage_per_order, turnover_sell * 0.0003)
    stt_rate = 0.00025 if is_intraday else 0.001
    stt = turnover_sell * stt_rate
    exchange_charges = total_turnover * 0.0000345
    sebi_charges = total_turnover * 0.000001
    stamp_duty = turnover_buy * 0.00015
    gst = (brokerage + exchange_charges) * 0.18

    total_charges = brokerage + stt + exchange_charges + sebi_charges + stamp_duty + gst
    gross_pnl = turnover_sell - turnover_buy
    net_pnl = gross_pnl - total_charges

    return {
        "turnover": round(total_turnover, 2), "brokerage": round(brokerage, 2),
        "stt": round(stt, 2), "exchange_charges": round(exchange_charges, 2),
        "sebi_charges": round(sebi_charges, 2), "stamp_duty": round(stamp_duty, 2),
        "gst": round(gst, 2), "total_charges": round(total_charges, 2),
        "gross_pnl": round(gross_pnl, 2), "net_pnl": round(net_pnl, 2)
    }


def equity_capital_gains_tax(buy_price: float, sell_price: float, qty: int, holding_days: int) -> dict:
    gain = (sell_price - buy_price) * qty
    is_long_term = holding_days > 365
    if gain <= 0:
        return {"gain": round(gain, 2), "term": "Long-term" if is_long_term else "Short-term",
                "taxable_gain": 0.0, "tax": 0.0, "rate_used": None}
    if is_long_term:
        exemption = 125000
        taxable = max(0.0, gain - exemption)
        tax = taxable * 0.125
        rate_used = "12.5% (LTCG, after Rs. 1.25L exemption)"
    else:
        taxable = gain
        tax = taxable * 0.20
        rate_used = "20% (STCG)"
    return {"gain": round(gain, 2), "term": "Long-term" if is_long_term else "Short-term",
            "taxable_gain": round(taxable, 2), "tax": round(tax, 2), "rate_used": rate_used}


def retirement_planner(current_age: int, retirement_age: int, monthly_expenses_today: float,
                        inflation_pct: float, pre_retirement_return_pct: float,
                        life_expectancy: int, post_retirement_return_pct: float) -> dict:
    years_to_retirement = max(1, retirement_age - current_age)
    years_in_retirement = max(1, life_expectancy - retirement_age)

    monthly_expenses_at_retirement = monthly_expenses_today * (1 + inflation_pct / 100) ** years_to_retirement
    annual_expenses_at_retirement = monthly_expenses_at_retirement * 12

    real_return = (1 + post_retirement_return_pct / 100) / (1 + inflation_pct / 100) - 1
    if abs(real_return) < 1e-6:
        corpus_needed = annual_expenses_at_retirement * years_in_retirement
    else:
        corpus_needed = annual_expenses_at_retirement * (1 - (1 + real_return) ** -years_in_retirement) / real_return

    monthly_rate = pre_retirement_return_pct / 100 / 12
    n = years_to_retirement * 12
    if monthly_rate == 0:
        required_sip = corpus_needed / n
    else:
        required_sip = corpus_needed * monthly_rate / (((1 + monthly_rate) ** n - 1) * (1 + monthly_rate))

    return {
        "monthly_expenses_at_retirement": round(monthly_expenses_at_retirement, 2),
        "corpus_needed": round(corpus_needed, 2),
        "required_monthly_sip": round(required_sip, 2),
        "years_to_retirement": years_to_retirement, "years_in_retirement": years_in_retirement
    }


def goal_planner(goal_amount: float, years: float, expected_return_pct: float) -> dict:
    n = max(1, round(years * 12))
    monthly_rate = expected_return_pct / 100 / 12
    if monthly_rate == 0:
        required_sip = goal_amount / n
    else:
        required_sip = goal_amount * monthly_rate / (((1 + monthly_rate) ** n - 1) * (1 + monthly_rate))
    total_invested = required_sip * n
    return {"required_monthly_sip": round(required_sip, 2), "months": n,
            "total_invested": round(total_invested, 2),
            "wealth_gain": round(goal_amount - total_invested, 2)}
