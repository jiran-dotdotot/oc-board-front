#!/bin/bash
# i18n key-sync check across locale JSON files.
# SOURCE_LANG is the source of truth; every TARGET_LANGS file must have the same top-level keys.
# Wired to PostToolUse:Edit|Write. Runs only when you edit a locale file UNDER a locales/ dir.
# On mismatch: exit 2 (feedback to Claude; the edit itself is NOT reverted).
#
# ASSUMPTIONS (adapt for your project):
#   - ONE flat-key JSON file per language, named "<lang>.json" (ko.json, en.json, ...),
#   - all locale files in the SAME directory whose path contains "/<LOCALES_DIR_NAME>/".
#   - NOT supported (M5): folder-per-language layouts like locales/en/common.json (namespaced
#     i18next) — those have basenames like "common.json" and are intentionally ignored here.
#   - nested keys: replace `keys[]` with `paths` in the jq calls below.

SOURCE_LANG="ko"
TARGET_LANGS="en ja"
LOCALES_DIR_NAME="locales"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# M6: scope to files under a .../<LOCALES_DIR_NAME>/ directory, so stray {ko,en,ja}.json fixtures
# elsewhere in the repo don't trigger the check.
case "$FILE_PATH" in
  */"$LOCALES_DIR_NAME"/*) ;;
  *) exit 0 ;;
esac

ALL_LANGS="$SOURCE_LANG $TARGET_LANGS"
BASENAME=$(basename "$FILE_PATH")
IS_LOCALE=0
for lang in $ALL_LANGS; do
  [[ "$BASENAME" == "$lang.json" ]] && IS_LOCALE=1
done
[[ "$IS_LOCALE" -eq 0 ]] && exit 0

LOCALE_DIR=$(dirname "$FILE_PATH")
SRC="$LOCALE_DIR/$SOURCE_LANG.json"

# All files present + valid JSON, else pass quietly (mid-edit broken state).
for lang in $ALL_LANGS; do
  f="$LOCALE_DIR/$lang.json"
  [[ -f "$f" ]] || exit 0
  jq empty "$f" 2>/dev/null || exit 0
done

src_keys=$(jq -r 'keys[]' "$SRC" | sort)

REPORT=""
for lang in $TARGET_LANGS; do
  f="$LOCALE_DIR/$lang.json"
  tgt_keys=$(jq -r 'keys[]' "$f" | sort)
  missing=$(comm -23 <(echo "$src_keys") <(echo "$tgt_keys"))
  extra=$(comm -13 <(echo "$src_keys") <(echo "$tgt_keys"))
  [[ -n "$missing" ]] && REPORT+="  · $lang.json missing: $(echo "$missing" | tr '\n' ' ')"$'\n'
  [[ -n "$extra" ]] && REPORT+="  · $lang.json extra (not in $SOURCE_LANG): $(echo "$extra" | tr '\n' ' ')"$'\n'
done

if [[ -n "$REPORT" ]]; then
  {
    echo "i18n key mismatch in $LOCALE_DIR (source: $SOURCE_LANG.json):"   # L5: print the dir
    printf '%s' "$REPORT"
    echo "-> Sync keys across all locale files. New keys: kebab-case; untranslated value: 'TODO: translate'."
  } >&2
  exit 2
fi

exit 0
