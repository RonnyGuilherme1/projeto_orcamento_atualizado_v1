from datetime import date, timedelta


def last_day_of_month(d: date) -> date:
    if d.month == 12:
        first_next = date(d.year + 1, 1, 1)
    else:
        first_next = date(d.year, d.month + 1, 1)
    return first_next - timedelta(days=1)
