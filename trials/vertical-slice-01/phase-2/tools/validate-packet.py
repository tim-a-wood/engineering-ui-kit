#!/usr/bin/env python3
"""Trial-specific Roadmap Phase 2 packet validator (stdlib only)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PHASE2_DIR = Path(__file__).resolve().parents[1]
PACKET_DIR = PHASE2_DIR / "packet"
EVIDENCE_DIR = PHASE2_DIR / "evidence"

REQUIRED_PACKET_FILES = [
    "repo-flatfile.txt",
    "task-and-standard-pack.md",
    "visual-reference-pack.pdf",
]

FLATFILE_MANIFEST = [
    "index.html",
    "package.json",
    "src/App.tsx",
    "src/main.tsx",
    "src/styles.css",
    "src/taskPacket.ts",
    "src/vite-env.d.ts",
    "tsconfig.app.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
]

REQUIRED_HEADINGS = [
    "# Task and Standards Pack",
    "## Package Metadata",
    "## Goal",
    "## Scope",
    "## Constraints",
    "## Protected Behavior",
    "## Acceptance Criteria",
    "## References",
    "## Expected Changed Files",
    "## Forbidden Changes",
    "## Required Output",
    "## Verification Expectations",
    "## Source Precedence",
    "## Applicable Rule IDs",
    "## Applicable Component IDs",
    "## Applicable Token Paths and Values",
    "## Approved Guidance",
    "## Rejected Guidance",
    "## Accessibility Requirements",
    "## Standards Excerpts",
    "## Copilot Response Requirements",
]

RULE_IDS = [
    "FND-VIS-001",
    "FND-VIS-002",
    "FND-VIS-003",
    "FND-VIS-004",
    "FND-VIS-005",
    "FND-VIS-006",
    "FND-VIS-009",
    "FND-VIS-010",
    "FND-TOK-001",
    "FND-TOK-003",
    "FND-TOK-004",
    "FND-TOK-006",
    "FND-TOK-007",
    "FND-TOK-008",
    "FND-TOK-009",
    "FND-TOK-010",
    "FND-TOK-011",
    "FND-TOK-012",
    "FND-TOK-013",
    "FND-TOK-014",
    "FND-A11Y-001",
    "FND-A11Y-002",
    "FND-A11Y-003",
    "FND-A11Y-004",
    "FND-A11Y-005",
    "FND-A11Y-006",
    "FND-A11Y-007",
    "FND-A11Y-009",
    "FND-A11Y-011",
    "FND-A11Y-012",
    "LAY-SHELL-001",
    "RCP-WORKFLOW-001",
] + [f"ARCH-FE-{i:03d}" for i in range(1, 8)] + [
    f"ARCH-THEME-{i:03d}" for i in range(1, 8)
] + [f"ARCH-STATE-{i:03d}" for i in range(1, 8)] + [
    f"ARCH-FILE-{i:03d}" for i in range(1, 7)
]

COMPONENT_IDS = [
    "CMP-SHELL-APP",
    "CMP-NAV-PRIMARY",
    "CMP-SHELL-PAGE-HEADER",
    "CMP-SURFACE-PANEL",
    "CMP-WORKFLOW-STEP-INDICATOR",
    "CMP-FORM-FIELD",
    "CMP-FORM-TEXTAREA",
    "CMP-OVERLAY-DIALOG",
    "CMP-FEEDBACK-VALIDATION-SUMMARY",
    "CMP-FEEDBACK-ALERT",
]

TOKEN_PATHS = [
    "semantic.surface.canvas",
    "semantic.surface.panel",
    "semantic.surface.panelRaised",
    "semantic.surface.inset",
    "semantic.surface.overlay",
    "semantic.surface.scrim",
    "semantic.text.primary",
    "semantic.text.secondary",
    "semantic.text.muted",
    "semantic.text.disabled",
    "semantic.text.inverse",
    "semantic.border.subtle",
    "semantic.border.strong",
    "semantic.border.focus",
    "semantic.border.danger",
    "semantic.focus.ring",
    "semantic.focus.ringOffset",
    "semantic.accent.primary",
    "semantic.accent.primaryHover",
    "semantic.accent.primaryActive",
    "semantic.accent.secondary",
    "semantic.accent.glow",
    "semantic.status.success",
    "semantic.status.warning",
    "semantic.status.danger",
    "semantic.status.info",
    "semantic.status.neutral",
    "semantic.spacing.1",
    "semantic.spacing.2",
    "semantic.spacing.3",
    "semantic.spacing.4",
    "semantic.spacing.5",
    "semantic.spacing.6",
    "semantic.spacing.8",
    "semantic.density.compact.controlHeight",
    "semantic.density.compact.panelPadding",
    "semantic.density.comfortable.controlHeight",
    "semantic.radius.sm",
    "semantic.radius.md",
    "semantic.radius.lg",
    "semantic.shadow.sm",
    "semantic.shadow.md",
    "semantic.shadow.overlay",
    "semantic.typography.family.sans",
    "semantic.typography.family.mono",
    "semantic.typography.size.sm",
    "semantic.typography.size.md",
    "semantic.typography.size.lg",
    "semantic.typography.weight.regular",
    "semantic.typography.weight.medium",
    "semantic.typography.weight.semibold",
    "semantic.motion.durationFast",
    "semantic.motion.durationNormal",
    "semantic.motion.easingStandard",
    "semantic.zIndex.overlay",
    "semantic.zIndex.modal",
]

FIXED_METADATA = [
    "packetId: `vertical-slice-01-phase-2`",
    "packetVersion: `0.1.1`",
    "standardsPackage: `engineering-ui-kit-standards`",
    "standardsVersion: `0.3.0`",
    "themePosture: `dark-first`",
    "variant: `visual/mockup`",
    "targetPackage: `vertical-slice-01-target-app`",
    "targetApplication: `UI Overlay`",
    "selectedProjectSample: `signal-analyzer-refresh`",
    "screen: `Create Task Packet`",
    "route: `/`",
    "primaryVisualReference: `1F2214C9-D849-41CA-9435-68F0A0032EEB.jpeg`",
    "expectedOutput: `ui-overlay.zip`",
]

FORBIDDEN_PATH_RE = re.compile(
    r"(^|/)\.\.(/|$)|^[A-Za-z]:|\\|^\.|/\.env|node_modules|package-lock\.json|/dist/|\.zip$|\.png$|\.jpg$|\.jpeg$|\.pdf$"
)


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def check_packet_inventory(errors: list[str]) -> None:
    if not PACKET_DIR.is_dir():
        fail(errors, "packet/ directory is missing")
        return
    names = sorted(p.name for p in PACKET_DIR.iterdir() if p.is_file())
    if names != REQUIRED_PACKET_FILES:
        fail(
            errors,
            f"packet/ must contain exactly {REQUIRED_PACKET_FILES}; found {names}",
        )


def check_flatfile(errors: list[str]) -> None:
    path = PACKET_DIR / "repo-flatfile.txt"
    if not path.is_file():
        fail(errors, "repo-flatfile.txt is missing")
        return
    text = path.read_text(encoding="utf-8")
    required_headers = [
        "# Engineering UI Kit Repo Flatfile",
        "# packet_id: vertical-slice-01-phase-2",
        "# source_repo: vertical-slice-01-target-app",
        "# source_root: trials/vertical-slice-01/target-app",
        "# baseline_commit: ",
        "# generated_at: ",
        "# included_files: 11",
        "# excluded_summary: ",
        "# secrets_guarantee: none — exclusions reduce risk but are not secret detection",
    ]
    for header in required_headers:
        if header not in text:
            fail(errors, f"flatfile missing header fragment: {header}")

    if re.search(r"baseline_commit: <[^>]+>|generated_at: <[^>]+>", text):
        fail(errors, "flatfile contains unresolved header placeholders")

    starts = re.findall(r"^===== FILE: (.+) =====$", text, re.M)
    ends = re.findall(r"^===== END FILE: (.+) =====$", text, re.M)
    if len(starts) != 11 or len(ends) != 11:
        fail(
            errors,
            f"flatfile delimiter count invalid: starts={len(starts)} ends={len(ends)}",
        )
    if starts != FLATFILE_MANIFEST:
        fail(errors, f"flatfile manifest/order mismatch: {starts}")
    if starts != ends:
        fail(errors, "flatfile start/end delimiter paths do not pair")

    for entry in starts:
        if FORBIDDEN_PATH_RE.search(entry) or entry.startswith("/"):
            fail(errors, f"flatfile has forbidden entry path: {entry}")

    for marker in ("{{", "TBD", "TODO", "FIXME", "Open Placeholder"):
        if marker in text:
            fail(errors, f"flatfile contains unresolved marker: {marker}")


def check_combined_pack(errors: list[str]) -> None:
    path = PACKET_DIR / "task-and-standard-pack.md"
    if not path.is_file():
        fail(errors, "task-and-standard-pack.md is missing")
        return
    text = path.read_text(encoding="utf-8")
    headings = [line for line in text.splitlines() if line.startswith("#")]
    top_level = [h for h in headings if h.startswith("# ") or h.startswith("## ")]
    # Keep only the required top-level set in order (ignore deeper headings)
    required_present = [h for h in top_level if h in REQUIRED_HEADINGS]
    if required_present != REQUIRED_HEADINGS:
        fail(
            errors,
            "combined pack heading order/set mismatch: "
            f"expected {REQUIRED_HEADINGS}, found {required_present}",
        )

    for item in FIXED_METADATA:
        if item not in text:
            fail(errors, f"combined pack missing fixed metadata: {item}")

    for marker in ("{{", "TBD", "TODO", "FIXME", "Open Placeholder"):
        if marker in text:
            fail(errors, f"combined pack contains unresolved marker: {marker}")

    for i in range(1, 14):
        ac = f"TRIAL-AC-{i:03d}"
        count = len(re.findall(rf"\| {ac} \|", text))
        if count != 1:
            fail(errors, f"acceptance ID {ac} occurs {count} times in table")

    for path_name in (
        "src/App.tsx",
        "src/styles.css",
        "src/tokens.css",
        "src/taskPacket.ts",
        "ui-overlay.zip",
    ):
        if path_name not in text:
            fail(errors, f"combined pack missing required path/name: {path_name}")

    for rule_id in RULE_IDS + COMPONENT_IDS:
        if f"### {rule_id} —" not in text and f"### {rule_id} -" not in text:
            fail(errors, f"missing standards excerpt heading for {rule_id}")
        if rule_id not in text:
            fail(errors, f"missing applicable ID mention: {rule_id}")

    for token_path in TOKEN_PATHS:
        count = text.count(f"`{token_path}`")
        if count < 1:
            fail(errors, f"missing token path: {token_path}")
        # token table should list each path once as a table cell
        table_count = len(re.findall(rf"\| `{re.escape(token_path)}` \|", text))
        if table_count != 1:
            fail(
                errors,
                f"token path {token_path} appears {table_count} times in token table",
            )

    excerpt_blocks = re.findall(
        r"^### (?:FND|LAY|RCP|ARCH|CMP)-[A-Z0-9-]+ — .+\n\n.+\n\nSource: `([^`]+)`",
        text,
        re.M,
    )
    if len(excerpt_blocks) < len(RULE_IDS) + len(COMPONENT_IDS):
        fail(
            errors,
            "not every standards excerpt includes a Source annotation "
            f"(found {len(excerpt_blocks)})",
        )

    if "targetApplication: `UI Overlay`" not in text:
        fail(errors, "combined pack does not identify UI Overlay as the target application")
    if "selected-project sample data" not in text.lower():
        fail(errors, "combined pack does not distinguish selected-project sample data")


def check_pdf(errors: list[str]) -> None:
    path = PACKET_DIR / "visual-reference-pack.pdf"
    if not path.is_file():
        fail(errors, "visual-reference-pack.pdf is missing")
        return
    data = path.read_bytes()
    if not data.startswith(b"%PDF"):
        fail(errors, "visual-reference-pack.pdf missing PDF signature")
    if len(data) == 0:
        fail(errors, "visual-reference-pack.pdf is empty")


def check_evidence(errors: list[str]) -> None:
    required = [
        "context-export-review.md",
        "packet-manifest.json",
        "packet-validation.md",
        "visual-reference-pack-page-1.png",
    ]
    for name in required:
        if not (EVIDENCE_DIR / name).is_file():
            fail(errors, f"evidence/{name} is missing")


def check_manifest(errors: list[str]) -> None:
    path = EVIDENCE_DIR / "packet-manifest.json"
    if not path.is_file():
        return
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(errors, f"packet-manifest.json is invalid JSON: {exc}")
        return
    files = manifest.get("files")
    if not isinstance(files, list) or len(files) != 3:
        fail(errors, "packet-manifest.json must list exactly three files")
        return
    names = [item.get("name") for item in files]
    if names != REQUIRED_PACKET_FILES:
        fail(errors, f"packet-manifest.json names mismatch: {names}")


def check_copy_paste_prompt(errors: list[str]) -> None:
    path = PHASE2_DIR / "copy-paste-implementation-prompt.md"
    if not path.is_file():
        fail(errors, "copy-paste-implementation-prompt.md is missing")
        return
    text = path.read_text(encoding="utf-8")
    for name in REQUIRED_PACKET_FILES:
        if name not in text:
            fail(errors, f"copy-paste prompt missing upload filename: {name}")
    if "ui-overlay.zip" not in text:
        fail(errors, "copy-paste prompt missing ui-overlay.zip")
    for i in range(1, 14):
        if f"TRIAL-AC-{i:03d}" not in text:
            fail(errors, f"copy-paste prompt missing {f'TRIAL-AC-{i:03d}'}")
    for marker in ("{{", "TBD", "TODO", "FIXME"):
        if marker in text:
            fail(errors, f"copy-paste prompt contains unresolved marker: {marker}")


def main() -> int:
    errors: list[str] = []
    check_packet_inventory(errors)
    check_flatfile(errors)
    check_combined_pack(errors)
    check_pdf(errors)
    check_evidence(errors)
    check_manifest(errors)
    check_copy_paste_prompt(errors)

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1

    print(
        "PASS packet=3 files flatfile=11-manifest combined-pack=headings+ids+tokens "
        "pdf=signature evidence=present prompt=marker-free"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
