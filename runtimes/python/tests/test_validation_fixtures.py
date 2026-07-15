"""`dispatch` input validation against a canonical JSON Schema (Draft
2020-12), proved against the frozen Wave-1 canonical fixtures — never
modified here, only read.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from engineering_ui_capabilities_runtime.core import Context, Outcome, dispatch, is_rejected, is_success

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMAS_DIR = REPO_ROOT / "standards" / "schemas" / "capabilities"
FIXTURES_DIR = REPO_ROOT / "packages" / "core" / "test" / "capabilities" / "fixtures"


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


class PassthroughOperation:
    def execute(self, input: dict, context: Context) -> Any:
        return Outcome.success(input)


FIXTURE_NAMES = [
    "inbound-binding",
    "operation-contract",
    "composition-manifest",
]


@pytest.mark.parametrize("fixture_name", FIXTURE_NAMES)
def test_dispatch_accepts_the_canonical_valid_fixture(fixture_name: str) -> None:
    schema = _load_json(SCHEMAS_DIR / f"{fixture_name}.schema.json")
    valid_input = _load_json(FIXTURES_DIR / f"{fixture_name}-valid.json")

    outcome = dispatch(PassthroughOperation(), valid_input, Context(correlation_id="c1"), input_schema=schema)

    assert is_success(outcome), outcome


@pytest.mark.parametrize("fixture_name", FIXTURE_NAMES)
def test_dispatch_rejects_the_canonical_invalid_fixture(fixture_name: str) -> None:
    schema = _load_json(SCHEMAS_DIR / f"{fixture_name}.schema.json")
    invalid_input = _load_json(FIXTURES_DIR / f"{fixture_name}-invalid.json")

    outcome = dispatch(PassthroughOperation(), invalid_input, Context(correlation_id="c1"), input_schema=schema)

    assert is_rejected(outcome), outcome
    assert outcome.code == "invalid_input"
    assert outcome.details
