import re


def _only_digits(value: str | None) -> str:
    return re.sub(r"\D+", "", value or "")


def validate_cpf(cpf: str | None) -> bool:
    digits = _only_digits(cpf)
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:
        return False

    def _calc_digit(digs: str, factor: int) -> str:
        total = 0
        for idx, char in enumerate(digs):
            total += int(char) * (factor - idx)
        remainder = total % 11
        return "0" if remainder < 2 else str(11 - remainder)

    first = _calc_digit(digits[:9], 10)
    second = _calc_digit(digits[:9] + first, 11)
    return digits[-2:] == first + second


def validate_phone(phone: str | None) -> bool:
    digits = _only_digits(phone)
    if len(digits) not in {10, 11}:
        return False
    if len(digits) == 11 and digits[2] != "9":
        return False
    return True


def normalize_cpf(cpf: str | None) -> str:
    return _only_digits(cpf)


def normalize_phone(phone: str | None) -> str:
    return _only_digits(phone)
