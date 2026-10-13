import { notFound } from "next/navigation";
import { LegalArticle, loadLegal } from "@/lib/legal";
import { siteHref } from "@/lib/sites";

export const metadata = { title: "Mentions légales" };

export default function Page() {
  const doc = loadLegal("mentions-legales", ["mentions-legales"], { basePath: siteHref("solutions") });
  if (!doc) notFound();
  return <LegalArticle doc={doc} />;
}
