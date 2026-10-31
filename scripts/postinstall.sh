#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/.agents/skills"
TARGET_DIR="$ROOT_DIR/.claude/skills"

# Mirrors every skill under .agents/skills into .claude/skills with a relative
# symlink so Claude Code loads the same catalog other agents read.
if [ -d "$SOURCE_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  linked=0
  for skill in "$SOURCE_DIR"/*/; do
    skill="${skill%/}"
    [ -f "$skill/SKILL.md" ] || continue
    name="$(basename "$skill")"
    rm -rf "${TARGET_DIR:?}/$name"
    ln -s "../../.agents/skills/$name" "$TARGET_DIR/$name"
    linked=$((linked + 1))
  done
  echo "Linked $linked skills from .agents/skills → .claude/skills"
fi

# CLAUDE.md is canonical per surface; AGENTS.md is a relative symlink to it.
linked=0
while IFS= read -r claude_file; do
  dir="$(dirname "$claude_file")"
  rm -f "$dir/AGENTS.md"
  ln -s "CLAUDE.md" "$dir/AGENTS.md"
  linked=$((linked + 1))
done < <(find "$ROOT_DIR" -maxdepth 3 -name CLAUDE.md -not -path "*/node_modules/*" -not -path "*/.agents/*")
echo "Linked $linked AGENTS.md → CLAUDE.md pair(s)"
