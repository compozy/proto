/**
 * S18 remote sign-in: the card a deployed gallery shows without a session (one button to the
 * project's sign-in, no token field — credentials are for the CLI and agents), and the
 * session-expired banner over the shell. Unsent drafts stay in local storage (`drafts.ts`), so
 * "Sign in again" returns to the same URL with the text intact (IT-029).
 */
import { useShellData } from "../../lib/shell-data";
import { useT } from "../../lib/i18n";
import { Button } from "../../ui/button";
import { Layers, Lock, Terminal } from "../../ui/icons";
import { useReviewData } from "../data";

/**
 * The sign-in link: the server's sign-in route with `returnTo` always set to this gallery
 * document (origin-relative `pathname + search`, base path included). A `returnTo` the server
 * put there (on a 401 it names the API request) is replaced, so sign-in lands on this screen.
 */
export function signInHref(
  signInUrl: string,
  location: Pick<Location, "pathname" | "search" | "origin"> = window.location
) {
  const url = new URL(signInUrl, document.baseURI);
  url.searchParams.set("returnTo", `${location.pathname}${location.search}`);
  return url.origin === location.origin ? `${url.pathname}${url.search}` : url.href;
}

export function SignInPage() {
  const t = useT();
  const { bootstrap } = useShellData();
  return (
    <main className="shell-dots grid h-svh min-h-[560px] w-full place-items-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-border bg-[var(--shell-panel)] p-7 shadow-2xl">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Layers className="size-5" />
          </div>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">
            {t("auth.title", { title: bootstrap.title })}
          </h1>
          {bootstrap.signInUrl ? (
            <Button
              className="mt-6 h-10 w-full font-semibold"
              render={<a href={signInHref(bootstrap.signInUrl)} />}
            >
              {t("auth.continue")}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t("auth.noSignIn")}</p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("auth.agents")}</p>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Terminal className="size-3" />
          {window.location.host}
        </p>
      </div>
    </main>
  );
}

/** Shown when a request answered 401 `auth_required`: drafts are kept, sign in again here. */
export function SessionExpiredBanner() {
  const t = useT();
  const { bootstrap } = useShellData();
  const review = useReviewData();
  if (!review?.expired) return null;
  const signInUrl = review.expired.signInUrl ?? bootstrap.signInUrl;
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-3 border-b border-[color-mix(in_oklch,var(--tone-warning)_40%,transparent)] bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-4 py-2 text-[13px]"
    >
      <Lock className="size-4 shrink-0 text-[var(--tone-warning)]" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{t("auth.expired")}</b> {t("auth.draftsKept")}
      </span>
      {signInUrl && (
        <Button
          size="sm"
          className="shrink-0 font-semibold"
          render={<a href={signInHref(signInUrl)} />}
        >
          {t("auth.signInAgain")}
        </Button>
      )}
    </div>
  );
}
