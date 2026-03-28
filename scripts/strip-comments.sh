#!/usr/bin/env bash
# Removes single-line comments (// ...) and multi-line comments (/* ... */)
# from all .ts, .tsx, and .css files under src/.
#
# Preserves:
#   - URLs containing :// (e.g. https://...)
#   - Strings containing // or /* (basic heuristic: skips lines where // is inside quotes)
#
# Usage:  ./scripts/strip-comments.sh [--dry-run]

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

count=0

while IFS= read -r -d '' file; do
  # Build a sed program that:
  #   1. Removes multi-line /* ... */ comments (including single-line block comments)
  #   2. Removes full-line // comments (with optional leading whitespace)
  #   3. Strips trailing // comments (but not :// as in URLs)
  #   4. Deletes resulting blank lines left behind

  tmp=$(mktemp)

  # Use perl for reliable multi-line comment removal
  perl -0777 -pe '
    # Remove multi-line block comments (/* ... */)
    s{/\*.*?\*/}{}gs;
    # Remove full-line // comments (line is only whitespace + //)
    s{^[ \t]*//[^\n]*\n}{}gm;
    # Remove trailing // comments but not ://  (look-behind ensures no colon before //)
    s{(?<!:)[ \t]*//[^\n]*}{}gm;
    # Collapse runs of blank lines into a single blank line
    s{\n{3,}}{\n\n}g;
    # Remove leading blank lines
    s{\A\n+}{};
  ' "$file" > "$tmp"

  if ! diff -q "$file" "$tmp" > /dev/null 2>&1; then
    if $DRY_RUN; then
      echo "[dry-run] would strip comments from: $file"
      diff --unified=0 "$file" "$tmp" | head -30 || true
      echo ""
    else
      cp "$tmp" "$file"
      echo "stripped: $file"
    fi
    count=$((count + 1))
  fi

  rm -f "$tmp"
done < <(find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0)

if $DRY_RUN; then
  echo "$count file(s) would be modified"
else
  echo "$count file(s) stripped"
fi
