#!/usr/bin/env bash
# Tag the planned release commit and create its GitHub Release from the `pr-release plan` outputs,
# after npm publication succeeded. Idempotent: an existing tag must point to RELEASE_COMMIT, and an
# existing release must carry the planned prerelease flag; both are reused as is.
set -euo pipefail
: "${RELEASE_TAG:?}" "${RELEASE_COMMIT:?}" "${RELEASE_NOTES_FILE:?}" "${PRERELEASE:?}" "${MAKE_LATEST:?}"

# Resolve the remote tag as well, including annotated tags, before any mutation.
remote_tag=$(git ls-remote origin "refs/tags/${RELEASE_TAG}" "refs/tags/${RELEASE_TAG}^{}")
if [[ -n "$remote_tag" ]]; then
  test "$(printf '%s\n' "$remote_tag" | tail -n 1 | cut -f 1)" = "$RELEASE_COMMIT"
fi
if git rev-parse --verify --quiet "refs/tags/${RELEASE_TAG}" >/dev/null; then
  test "$(git rev-parse "${RELEASE_TAG}^{commit}")" = "$RELEASE_COMMIT"
else
  git -c user.name='github-actions[bot]' \
    -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    tag -a "$RELEASE_TAG" "$RELEASE_COMMIT" -m "$RELEASE_TAG"
fi
if [[ -z "$remote_tag" ]]; then
  git push origin "refs/tags/${RELEASE_TAG}"
fi

if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  test "$(gh release view "$RELEASE_TAG" --json isPrerelease --jq .isPrerelease)" = "$PRERELEASE"
else
  args=(--verify-tag --target "$RELEASE_COMMIT" --title "$RELEASE_TAG" --notes-file "$RELEASE_NOTES_FILE")
  if [[ "$PRERELEASE" == true ]]; then args+=(--prerelease); fi
  gh release create "$RELEASE_TAG" "${args[@]}" --latest="$MAKE_LATEST"
fi
