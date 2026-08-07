from utils.storage import load, save

def get_paper_account(username):
    all_accounts = load("paper_trading", {})
    return all_accounts.get(username, {"cash": 1000000.0, "positions": [], "history": []})


def save_paper_account(username, account):
    all_accounts = load("paper_trading", {})
    all_accounts[username] = account
    save("paper_trading", all_accounts)


def paper_buy(username, symbol, qty, price):
    account = get_paper_account(username)
    cost = qty * price
    if cost > account["cash"]:
        return False, "Not enough paper cash for this trade."
    account["cash"] -= cost
    account["positions"].append({"symbol": symbol, "qty": qty, "buy_price": price})
    account["history"].append({"action": "BUY", "symbol": symbol, "qty": qty, "price": price})
    save_paper_account(username, account)
    return True, f"Bought {qty} x {symbol} @ {price}"


def paper_sell(username, symbol, qty, price):
    account = get_paper_account(username)
    matching = [p for p in account["positions"] if p["symbol"] == symbol]
    held_qty = sum(p["qty"] for p in matching)
    if qty > held_qty:
        return False, f"You only hold {held_qty} units of {symbol}."

    remaining_to_sell = qty
    new_positions = []
    for p in account["positions"]:
        if p["symbol"] != symbol or remaining_to_sell <= 0:
            new_positions.append(p)
            continue
        if p["qty"] <= remaining_to_sell:
            remaining_to_sell -= p["qty"]
        else:
            new_positions.append({"symbol": symbol, "qty": p["qty"] - remaining_to_sell, "buy_price": p["buy_price"]})
            remaining_to_sell = 0

    account["positions"] = new_positions
    account["cash"] += qty * price
    account["history"].append({"action": "SELL", "symbol": symbol, "qty": qty, "price": price})
    save_paper_account(username, account)
    return True, f"Sold {qty} x {symbol} @ {price}"


def reset_paper_account(username):
    save_paper_account(username, {"cash": 1000000.0, "positions": [], "history": []})
