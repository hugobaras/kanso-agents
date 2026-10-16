import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalArticle, loadLegal } from "@/lib/legal";
import { siteHref } from "@/lib/sites";

const SLUGS = ["cgu", "cgv", "confidentialite", "confidentialite-widget", "dpa", "sous-traitants"] as const;

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadLegal(slug, SLUGS);
  return doc ? { title: doc.title } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = loadLegal(slug, SLUGS, { basePath: siteHref("assistant") });
  if (!doc) notFound();
  return <LegalArticle doc={doc} />;
}
