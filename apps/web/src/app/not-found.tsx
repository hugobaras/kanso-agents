import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-display text-6xl text-line-strong">404</p>
      <h1 className="mt-4 font-display text-3xl">Page introuvable</h1>
      <p className="mt-2 text-muted">Le lien est peut-être incomplet, ou la page a été déplacée.</p>
      <ButtonLink href="/" className="mt-8">
        Retour à l&apos;accueil
      </ButtonLink>
    </div>
  );
}
