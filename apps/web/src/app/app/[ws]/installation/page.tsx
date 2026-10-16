"use client";

import { CheckCircle2, Globe, KeyRound, Plus, Radio, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { WebsiteOffer } from "@/components/website-offer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/copy";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { Alert, PageHeader, Tabs } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Install = {
  public_key: string;
  allowed_origins: string[];
  last_seen_at: string | null;
  last_seen_origin: string | null;
  script_url: string;
  api_url: string;
  snippet: string;
};

type Platform = "html" | "wordpress" | "wix" | "squarespace";

const GUIDES: Record<Platform, string[]> = {
  html: ["Copiez le code ci-dessus.", "Collez-le juste avant la balise </body> de chaque page (ou de votre gabarit commun).", "Publiez : la bulle apparaît en bas à droite."],
  wordpress: [
    "Installez l'extension gratuite « WPCode » (ou « Insert Headers and Footers »).",
    "Code Snippets › Header & Footer › collez le code dans la zone « Footer ».",
    "Enregistrez : le widget apparaît sur tout le site.",
  ],
  wix: ["Paramètres du site › Code personnalisé › + Ajouter du code.", "Collez le code, choisissez « Toutes les pages » et « Corps - fin ».", "Appliquez puis publiez le site."],
  squarespace: ["Paramètres › Avancé › Injection de code.", "Collez le code dans la zone « Footer ».", "Enregistrez."],
};

export default function InstallationPage() {
  const { ws, can, overview } = useWorkspace();
  const toast = useToast();
  const { data, mutate } = useApi<Install>(wsPath(ws, "/assistant/install"), { refreshInterval: (d) => (d?.last_seen_at ? 0 : 8000) });
  const [origins, setOrigins] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [platform, setPlatform] = useState<Platform>("html");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setOrigins(data.allowed_origins);
  }, [data]);

  if (!data) return <PageSpinner />;
  const dirty = JSON.stringify(origins) !== JSON.stringify(data.allowed_origins);

  function addOrigin() {
    let v = draft.trim().toLowerCase().replace(/\/+$/, "");
    if (!v) return;
    if (!/^https?:\/\//.test(v)) v = `https://${v}`;
    try {
      const u = new URL(v);
      v = `${u.protocol}//${u.host}`;
    } catch {
      toast.error("Adresse invalide", "Exemple : https://www.mon-cabinet.fr");
      return;
    }
    if (!origins.includes(v)) setOrigins([...origins, v]);
    setDraft("");
  }

  async function saveOrigins() {
    setSaving(true);
    try {
      await api(wsPath(ws, "/assistant/install/origins"), { method: "PUT", body: { origins } });
      await mutate();
      toast.success("Domaines enregistrés");
    } catch (e) {
      toast.error("Enregistrement impossible", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function testHere() {
    if (document.getElementById("kanso-widget-script")) {
      window.dispatchEvent(new CustomEvent("kanso:open"));
      return;
    }
    setTesting(true);
    const s = document.createElement("script");
    s.id = "kanso-widget-script";
    s.src = data!.script_url;
    s.async = true;
    s.dataset.key = data!.public_key;
    s.dataset.api = data!.api_url;
    s.dataset.open = "true";
    s.onload = () => setTesting(false);
    s.onerror = () => {
      setTesting(false);
      toast.error("Widget indisponible", "Le script n'a pas pu être chargé.");
    };
    document.body.appendChild(s);
  }

  return (
    <>
      <PageHeader title="Installation" description="Ajoutez l'assistant à votre site en une ligne de code." />
      {!overview.assistant.published && (
        <Alert
          tone="warning"
          className="mb-6"
          title="Votre assistant n'est pas encore publié"
          action={
            <Link href={`/app/${ws}/assistant`} className="text-sm font-medium underline">
              Le publier
            </Link>
          }
        >
          Le widget affichera un message d&apos;indisponibilité tant qu&apos;aucune version n&apos;est publiée.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="1. Copiez ce code" description="À coller une seule fois : les modifications publiées s'appliquent automatiquement." />
            <CardBody className="space-y-5">
              <CodeBlock code={data.snippet} />
              <Tabs
                value={platform}
                onChange={setPlatform}
                items={[
                  { value: "html", label: "Site sur mesure" },
                  { value: "wordpress", label: "WordPress" },
                  { value: "wix", label: "Wix" },
                  { value: "squarespace", label: "Squarespace" },
                ]}
              />
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/90">
                {GUIDES[platform].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-[13px] text-muted">
                Votre prestataire web s&apos;en occupe ? Envoyez-lui simplement ce code et cette page d&apos;instructions.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="2. Autorisez vos domaines"
              description="Seuls ces sites pourront afficher votre assistant. Recommandé : sans liste, n'importe quel site pourrait utiliser votre quota."
            />
            <CardBody className="space-y-3">
              {origins.length === 0 && (
                <Alert tone="warning">Aucune restriction pour l&apos;instant : ajoutez l&apos;adresse de votre site.</Alert>
              )}
              <ul className="flex flex-wrap gap-2">
                {origins.map((o) => (
                  <li key={o}>
                    <Badge className="gap-1.5 py-1 text-[13px]">
                      <Globe className="size-3.5" />
                      {o}
                      {can("admin") && (
                        <button onClick={() => setOrigins(origins.filter((x) => x !== o))} aria-label={`Retirer ${o}`}>
                          <X className="size-3" />
                        </button>
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
              {can("admin") && (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.mon-cabinet.fr"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOrigin();
                      }
                    }}
                    aria-label="Ajouter un domaine"
                  />
                  <Button variant="secondary" onClick={addOrigin}>
                    <Plus className="size-4" /> Ajouter
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted">Astuce : « https://*.mon-cabinet.fr » autorise tous les sous-domaines.</p>
            </CardBody>
            {can("admin") && (
              <CardFooter>
                <Button onClick={saveOrigins} loading={saving} disabled={!dirty}>
                  Enregistrer les domaines
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="3. Vérification" />
            <CardBody>
              {data.last_seen_at ? (
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  <div className="text-sm">
                    <p className="font-medium">Widget détecté</p>
                    <p className="mt-0.5 text-muted">
                      Sur {data.last_seen_origin?.replace(/^https?:\/\//, "")}, {timeAgo(data.last_seen_at)}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Radio className="mt-0.5 size-5 shrink-0 animate-pulse text-accent" />
                  <div className="text-sm">
                    <p className="font-medium">En attente du premier affichage…</p>
                    <p className="mt-0.5 text-muted">Ouvrez une page de votre site où le code est installé : cette carte se mettra à jour.</p>
                  </div>
                </div>
              )}
              <Button variant="secondary" className="mt-4 w-full" onClick={testHere} loading={testing}>
                Tester le widget sur cette page
              </Button>
            </CardBody>
          </Card>
          {!data.last_seen_at && <WebsiteOffer ws={ws} variant="compact" />}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4" /> Clé publique
                </span>
              }
            />
            <CardBody className="space-y-3 text-sm">
              <code className="block break-all rounded bg-sunken px-2 py-1.5 font-mono text-xs">{data.public_key}</code>
              <p className="text-[13px] text-muted">
                Cette clé n&apos;est pas secrète : elle identifie votre assistant. Régénérez-la si elle est utilisée sur un site qui
                n&apos;est pas le vôtre.
              </p>
              {can("owner") && (
                <Button variant="ghost" size="sm" onClick={() => setRotateOpen(true)}>
                  Régénérer la clé
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Régénérer la clé ?"
        description="L'ancienne clé cesse de fonctionner immédiatement : vous devrez remplacer le code sur votre site."
        confirmLabel="Régénérer"
        danger
        loading={rotating}
        onConfirm={async () => {
          setRotating(true);
          try {
            await api(wsPath(ws, "/assistant/install/rotate"), { method: "POST" });
            await mutate();
            toast.success("Nouvelle clé générée", "Mettez à jour le code sur votre site.");
            setRotateOpen(false);
          } catch (e) {
            toast.error("Impossible de régénérer", errorMessage(e));
          } finally {
            setRotating(false);
          }
        }}
      />
    </>
  );
}
