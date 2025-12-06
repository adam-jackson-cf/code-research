#!/usr/bin/env python3

from pathlib import Path

from core.utils.architectural_pattern_detector import ArchitecturalPatternDetector


def test_detect_multiple_patterns_from_config(patterns_config_dir: Path):
    detector = ArchitecturalPatternDetector(config_dir=patterns_config_dir)

    content = (
        # Singleton indicators
        "class S:\n    _instance = None\n    def __new__(cls):\n        if cls._instance is None:\n            cls._instance = super().__new__(cls)\n        return cls._instance\n\n"
        # Factory indicators
        "class FooFactory:\n    def create(self):\n        return object()\n\n"
        "def create_bar():\n    return object()\n\n"
        # Observer indicators
        "observers = []\n"
        "def subscribe(cb):\n    observers.append(cb)\n\n"
        "def notify():\n    for o in observers:\n        o()\n\n"
        # Repository indicators
        "class UserRepository:\n    def find(self): pass\n    def save(self): pass\n    def delete(self): pass\n"
    )

    matches = detector.detect_patterns(content, "demo.py", "python")
    names = {m.pattern_name for m in matches}
    assert {"singleton", "factory", "observer", "repository"}.issubset(names)
