from app.services.risk import compute_risk_score


def test_read_action_low_risk():
    assert compute_risk_score("read", "read_file", 0) == 0.0


def test_dangerous_permission():
    score = compute_risk_score("dangerous", "some_tool", 0)
    assert score >= 0.7


def test_dangerous_tool_name():
    score = compute_risk_score("write", "sudo", 0)
    assert score >= 0.2


def test_nonzero_exit_code_adds_risk():
    base = compute_risk_score("read", "read_file", 0)
    with_err = compute_risk_score("read", "read_file", 1)
    assert with_err > base


def test_score_capped_at_one():
    score = compute_risk_score("dangerous", "sudo", 1)
    assert score <= 1.0


def test_admin_permission():
    score = compute_risk_score("admin", "chown", 0)
    assert 0.3 <= score <= 0.5
