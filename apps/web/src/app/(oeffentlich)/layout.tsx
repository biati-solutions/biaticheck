import Link from "next/link";
import { Logo } from "@/komponenten/Logo";
import { ThemaKnopf } from "@/komponenten/ThemaKnopf";

export default function OeffentlichLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-linie bg-grund">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" aria-label="BiatiCheck Startseite">
            <Logo />
          </Link>
          <nav aria-label="Hauptnavigation" className="ml-auto hidden items-center gap-7 text-[15px] font-medium md:flex">
            <Link href="/#ablauf" className="hover:text-gruen">
              So läuft es ab
            </Link>
            <Link href="/#inhalt" className="hover:text-gruen">
              Was wir prüfen
            </Link>
            <Link href="/#fragen" className="hover:text-gruen">
              Fragen
            </Link>
            <Link href="/#pruefen" className="rounded-lg bg-gruen px-4 py-2 font-semibold text-white hover:bg-gruen-tief">
              Abrechnung prüfen
            </Link>
          </nav>
          <div className="ml-auto md:ml-0">
            <ThemaKnopf />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-dunkelkarte text-sm text-dunkelkarte-text">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-8">
          <span className="text-[#7fe0bd]">
            <Logo klein />
          </span>
          <span>Ein Angebot von Biati Solutions</span>
          <a href="https://www.biati.de" target="_blank" rel="noopener" className="underline-offset-4 hover:underline">
            www.biati.de
          </a>
          <Link href="/impressum" className="underline-offset-4 hover:underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="underline-offset-4 hover:underline">
            Datenschutz
          </Link>
          <span className="opacity-70 md:ml-auto">Keine Rechtsberatung</span>
        </div>
      </footer>
    </div>
  );
}
