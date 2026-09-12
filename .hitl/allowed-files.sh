#!/usr/bin/env bash
# hitl — allowed-files pre-commit gate
#
# Turns the packet's "Files allowed to change" list into an actual gate.
# Installed as .git/hooks/pre-commit by `hitl-init`.
#
# Resolving the active packet, in order:
#   1. $HITL_PACKET                      (explicit override)
#   2. .hitl/active-packet               (written by `hitl slice <NN>`)
#   3. a packet whose NN prefix matches the current branch name
#
# No packet found => allow the commit, but say so. Not every commit is slice
# work. Set HITL_STRICT=1 to require a packet.
#
# Escape hatch: `git commit --no-verify`. Deliberate — a gate you cannot bypass
# gets uninstalled the first time it is wrong at 23:00.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
PACKET_DIR="$ROOT/docs/method/packets"
RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'

resolve_packet() {
  [ -n "${HITL_PACKET:-}" ] && { echo "$HITL_PACKET"; return; }
  [ -f "$ROOT/.hitl/active-packet" ] && {
    p="$(tr -d '[:space:]' < "$ROOT/.hitl/active-packet")"
    [ -n "$p" ] && { echo "$ROOT/docs/method/packets/$p"; return; }
  }
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  nn="$(printf '%s' "$branch" | grep -oE '[0-9]{2,}' | head -1)"
  [ -n "$nn" ] && [ -d "$PACKET_DIR" ] && {
    match="$(find "$PACKET_DIR" -maxdepth 1 -name "${nn}-*.md" -o -maxdepth 1 -name "${nn}.md" 2>/dev/null | head -1)"
    [ -n "$match" ] && { echo "$match"; return; }
  }
  echo ""
}

PACKET="$(resolve_packet)"

if [ -z "$PACKET" ] || [ ! -f "$PACKET" ]; then
  if [ "${HITL_STRICT:-0}" = "1" ]; then
    echo "${RED}✗ hitl: no active packet, and HITL_STRICT=1.${OFF}" >&2
    echo "  Set one with:  hitl slice <NN>" >&2
    exit 1
  fi
  echo "${DIM}hitl: no active packet — allowed-files gate not applied.${OFF}" >&2
  exit 0
fi

# Extract the fenced block under "## Files allowed to change".
mapfile -t ALLOWED < <(
  awk '
    /^##[[:space:]]+Files allowed to change/ { insec=1; next }
    insec && /^##[[:space:]]/               { exit }
    insec && /^```/                          { infence = !infence; next }
    insec && infence && NF                   { print }
  ' "$PACKET" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^{{'
)

if [ ${#ALLOWED[@]} -eq 0 ]; then
  echo "${YEL}⚠ hitl: packet $(basename "$PACKET") has no allowed-files list — gate skipped.${OFF}" >&2
  exit 0
fi

# The implementer always owns its own handoff and the packet's review notes.
ALLOWED+=("docs/method/handoffs/*" "$(realpath --relative-to="$ROOT" "$PACKET")")

# D is in the filter because deleting a file the packet never named is exactly
# as out-of-scope as editing one, and --no-renames splits a rename into its
# delete and its add — otherwise git reports only the destination and a file
# can be moved out of the allowed list without the gate ever seeing it.
mapfile -t STAGED < <(git diff --cached --name-only --no-renames --diff-filter=ACMRD)
[ ${#STAGED[@]} -eq 0 ] && exit 0

VIOLATIONS=()
for f in "${STAGED[@]}"; do
  ok=0
  for pat in "${ALLOWED[@]}"; do
    # Literal first. A Next.js route segment like [ref] is an ordinary
    # directory name AND a bash character class, so glob-first rejects the
    # exact path the packet listed while allowing three paths it did not.
    if [[ "$f" == "$pat" ]]; then ok=1; break; fi
    # shellcheck disable=SC2053
    if [[ "$f" == $pat ]]; then ok=1; break; fi
    case "$pat" in */) [[ "$f" == "$pat"* ]] && { ok=1; break; } ;; esac
  done
  [ $ok -eq 0 ] && VIOLATIONS+=("$f")
done

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo >&2
  echo "${RED}✗ hitl: files outside the packet's allowed list${OFF}" >&2
  echo "  packet: ${DIM}$(realpath --relative-to="$ROOT" "$PACKET")${OFF}" >&2
  echo >&2
  for v in "${VIOLATIONS[@]}"; do echo "    ${RED}$v${OFF}" >&2; done
  echo >&2
  echo "  Allowed:" >&2
  for a in "${ALLOWED[@]}"; do echo "    ${DIM}$a${OFF}" >&2; done
  echo >&2
  echo "  This is a stop condition. Either the change is out of scope, or the" >&2
  echo "  packet is wrong. Both are worth a human deciding — do not widen the" >&2
  echo "  list just to get past this." >&2
  echo >&2
  echo "  ${DIM}Deliberate exception: git commit --no-verify${OFF}" >&2
  exit 1
fi

echo "${GRN}✓ hitl: ${#STAGED[@]} file(s), all within packet scope${OFF}" >&2
exit 0
