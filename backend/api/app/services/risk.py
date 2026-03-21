_DANGEROUS_TOOLS = {"rm", "sudo", "dd", "mkfs", "fdisk", "shred", "wipefs"}


def compute_risk_score(permission_level: str, tool_name: str, exit_code: int | None) -> float:
    """
    Compute a 0.0–1.0 risk score for an action.

    Weights:
    - permission_level == "dangerous"  → +0.7
    - tool_name in dangerous set        → +0.2
    - non-zero exit code                → +0.1
    """
    score = 0.0

    if permission_level == "dangerous":
        score += 0.7
    elif permission_level == "admin":
        score += 0.4
    elif permission_level == "write":
        score += 0.2

    if tool_name.lower() in _DANGEROUS_TOOLS:
        score += 0.2

    if exit_code is not None and exit_code != 0:
        score += 0.1

    return round(min(1.0, score), 4)
