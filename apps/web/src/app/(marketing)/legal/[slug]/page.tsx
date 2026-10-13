import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const SLUGS = ["mentions-legales", "cgu", "cgv", "confidentialite", "confidentialite-widget", "dpa", "sous-traitants"] as const;
type Slug = (typeof SLUGS)[number];

function load(slug: string): { title: string; updated: string; version?: string; html: string } | null {
  if (!(SLUGS as readonly string[]).includes(slug)) return null;
  const raw = readFileSync(join(process.cwd(), "content/legal", `${slug as Slug}.md`), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const meta = Object.fromEntries(
    (m?.[1] ?? "")
      .split("\n")
      .map((l) => l.split(/:\s*/, 2) as [string, string])
      .filter(([k]) => k),
  );
  // Content is first-party markdown from the repo (trusted).
  const html = marked.parse(m?.[2] ?? raw, { async: false });
  return { title: meta.title ?? slug, updated: meta.updated ?? "", version: meta.version, html };
}

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = load(slug);
  return doc ? { title: doc.title } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = load(slug);
  if (!doc) notFound();
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
