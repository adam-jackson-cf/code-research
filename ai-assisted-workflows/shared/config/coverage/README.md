# Coverage Configuration

- `languages.json` – per-language coverage settings. Keys:
  - `schema_version`: format version (currently `1`).
  - `languages`: map of language name → configuration (`extensions`, `test_patterns`, `source_patterns`, `coverage_tools`, `coverage_files`, `exclude_dirs`).
- `indicators.json` – generic heuristics applied across languages. Keys:
  - `schema_version`: format version.
  - `indicators`: array of string indicators scanned in source files.

Any structural change must increment the `schema_version` and update the loader validations inside `coverage_analysis.py`.
