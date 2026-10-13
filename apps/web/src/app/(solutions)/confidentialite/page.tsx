import { notFound } from "next/navigation";
import { LegalArticle, loadLegal } from "@/lib/legal";
import { siteHref } from "@/lib/sites";

export const metadata = { title: "Politique de confidentialité" };

export default function Page() {
  const doc = loadLegal("confidentialite", ["confidentialite"], { file: "confidentialite-solutions", basePath: siteHref("solutions") });
  if (!doc) notFound();
  return <LegalArticle doc={doc} />;
}
