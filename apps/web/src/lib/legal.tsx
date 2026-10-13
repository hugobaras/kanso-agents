import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export type LegalDoc = { title: string; updated: string; version?: string; html: string };

/** Textes légaux : markdown versionné dans content/legal (contenu interne de confiance). */
export function loadLegal(
  slug: string,
  allowed: readonly string[],
  opts: { file?: string; basePath?: string } = {},
): LegalDoc | null {
  if (!allowed.includes(slug)) return null;
  const raw = readFileSync(join(process.cwd(), "content/legal", `${opts.file ?? slug}.md`), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const meta = Object.fromEntries(
    (m?.[1] ?? "")
      .split("\n")
      .map((l) => l.split(/:\s*/, 2) as [string, string])
      .filter(([k]) => k),
  );
  let html = marked.parse(m?.[2] ?? raw, { async: false });
  // Liens internes (« /confidentialite ») → préfixés du site courant (chemin en dev, domaine en production).
  if (opts.basePath !== undefined) html = html.replaceAll('href="/', `href="${opts.basePath}/`);
  return { title: meta.title ?? slug, updated: meta.updated ?? "", version: meta.version, html };
}

export function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl">{doc.title}</h1>
      <p className="mt-3 text-sm text-muted">
        Dernière mise à jour : {new Date(doc.updated).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        {doc.version && ` · version ${doc.version}`}
      </p>
      <div className="prose-legal mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
    </article>
  );
}
