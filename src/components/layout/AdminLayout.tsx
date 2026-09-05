/**
 * AdminLayout — Top-level shell for the Admin-Dashboard.
 * Wraps Sidebar + Topbar + <Outlet/> + global CommandPalette.
 */

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { WORKSPACE_FRAME } from './workspaceShell';
import { ansichtenVorwaermen } from '@/routes/vorwaermen';

/**
 * Die Befehlspalette oeffnet erst auf ⌘K.
 *
 * Sie bringt `cmdk` mit. Eager geladen liegt das im Hauptbuendel und
 * verzoegert das erste Bild — fuer ein Fenster, das die meisten nie
 * aufmachen. Vorgewaermt wird sie trotzdem (siehe routes/vorwaermen.ts):
 * eine Tastenkombination bietet kein Ueberfahren, auf das man das Holen
 * legen koennte.
 */
const CommandPalette = lazy(() =>
  import('./CommandPalette').then(({ CommandPalette }) => ({ default: CommandPalette })),
);

export function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Die Buendel der uebrigen Ansichten holen, sobald der Rechner Luft hat —
  // sonst wartet der erste Klick auf jeden Punkt der Seitenleiste auf einen
  // Download. Leeres Abhaengigkeitsfeld: genau einmal je Sitzung.
  useEffect(() => { ansichtenVorwaermen(); }, []);

  // The page scroll lives in this overflow container, not on window. Without
  // resetting it, route changes can open the next workspace halfway down the
  // page (especially after long tables). useLayoutEffect avoids a visible jump.
  useLayoutEffect(() => {
    if (!mainRef.current) return;
    mainRef.current.scrollTop = 0;
    mainRef.current.scrollLeft = 0;
  }, [pathname]);

  return (
    <div className={WORKSPACE_FRAME} data-workspace="admin">
      <a
        href="#admin-main-content"
        className="sr-only rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]"
      >
        Zum Hauptinhalt springen
      </a>
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main
          ref={mainRef}
          id="admin-main-content"
          className="flex-1 overflow-auto"
          role="main"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
      {/* Ohne Rueckfall-Anzeige: bis das Buendel da ist, soll gar nichts zu
          sehen sein — ein Ladehinweis mitten auf dem Bildschirm waere
          stoerender als die Palette einen Wimpernschlag spaeter. */}
      <Suspense fallback={null}>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />
      </Suspense>
    </div>
  );
}
