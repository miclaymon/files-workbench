import fnmatch
import logging
from pathlib import Path
from typing import Optional, FrozenSet

import yaml

log = logging.getLogger("server")

_RULES_FILE = Path(__file__).parent.parent / "blacklist.yaml"
_rules: list[dict] = []


def _load():
    global _rules
    try:
        with open(_RULES_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        _rules = data.get("rules", [])
        log.info("Loaded %d blacklist rules from %s", len(_rules), _RULES_FILE)
    except Exception as e:
        log.warning("Failed to load blacklist.yaml: %s", e)
        _rules = []


_load()

_DEFAULT_EXCLUDED: FrozenSet[str] = frozenset({"System"})


def get_all_categories() -> list[str]:
    """Return sorted list of all unique categories defined in blacklist.yaml."""
    return sorted({r["category"] for r in _rules if "category" in r})


def get_rules() -> list[dict]:
    """Return all rules (pattern, category, description)."""
    return list(_rules)


def is_excluded(path: Path, excluded_categories: Optional[FrozenSet[str]] = None) -> bool:
    """Return True if path's name matches a rule whose category is in excluded_categories.

    excluded_categories uses prefix matching: "System" excludes both "System:Windows"
    and "System:macOS". Pass frozenset() to exclude nothing.
    """
    cats = _DEFAULT_EXCLUDED if excluded_categories is None else excluded_categories
    if not cats:
        return False
    name = path.name
    for rule in _rules:
        pattern = rule.get("pattern", "")
        category = rule.get("category", "")
        if not fnmatch.fnmatch(name, pattern):
            continue
        for prefix in cats:
            if category == prefix or category.startswith(prefix + ":"):
                return True
    return False


def is_blacklisted(path: Path) -> bool:
    """Backwards-compatible alias — always applies System exclusion."""
    return is_excluded(path, _DEFAULT_EXCLUDED)


def parse_exclude_param(param: Optional[str]) -> FrozenSet[str]:
    """Parse a comma-separated excludeCategories query param into a frozenset.

    None  → default (System only)
    ""    → no exclusions
    "System,Developer:Libraries" → frozenset of those prefixes
    """
    if param is None:
        return _DEFAULT_EXCLUDED
    if not param.strip():
        return frozenset()
    return frozenset(c.strip() for c in param.split(",") if c.strip())
