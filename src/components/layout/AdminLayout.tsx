/**
 * AdminLayout — Top-level shell for the Admin-Dashboard.
 * Wraps Sidebar + Topbar + <Outlet/> + global CommandPalette.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { CommandPalette } from './CommandPalette';

export function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[color:var(--canvas,#0A0B0D)] text-[color:var(--text-primary,#E5E7EB)]">
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto" role="main">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
