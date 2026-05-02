"""Classifier tier parsing (no network)."""

import pytest

from hooks.classifier import parse_tier_response


@pytest.mark.parametrize(
    "text,expected",
    [
        ("PREMIUM", "PREMIUM"),
        ("basic", "BASIC"),
        ("The answer is: PREMIUM", "PREMIUM"),
        ("BASIC tasks only", "BASIC"),
        ("maybe later", "BASIC"),
    ],
)
def test_parse_tier_response(text: str, expected: str) -> None:
    assert parse_tier_response(text) == expected
