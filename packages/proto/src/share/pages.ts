/** A signIn callback with no gallery, identity or return URL reflected into the page. */
export function notInvitedPage(locale: "en" | "pt-BR") {
  const message =
    locale === "pt-BR"
      ? "Este e-mail não foi convidado. Peça acesso à pessoa que enviou o link."
      : "This email was not invited. Ask the person who sent the link.";
  return (_request: Request, _returnTo: string): Response =>
    new Response(
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${locale === "pt-BR" ? "Acesso negado" : "Access denied"}</title></head><body><main><h1>${message}</h1></main></body></html>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        },
      }
    );
}
