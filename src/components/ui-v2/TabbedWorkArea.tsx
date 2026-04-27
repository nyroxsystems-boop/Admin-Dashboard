/**
 * TabbedWorkArea — Chrome-like Tabs innerhalb eines Workspaces.
 *
 * Verwaltet offene Vorgänge als Tabs, rendert aktiven Tab-Inhalt.
 * State via useWorkspaceTabs() — siehe WorkspaceTabs.tsx.
 *
 * Stream: A — Skelett. Agentur implementiert Dragging, Context-Menu, etc.
 */

import { forwardRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  title: string;
  /** Icon oder Kurz-Label vor Titel */
  prefix?: string;
  dirty?: boolean;
  content: ReactNode;
}

export interface TabbedWorkAreaProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab?: () => void;
  className?: string;
}

export const TabbedWorkArea = forwardRef<HTMLDivElement, TabbedWorkAreaProps>(
  ({ tabs, activeTabId, onTabSelect, onTabClose, onNewTab, className }, ref) => {
    const active = tabs.find((t) => t.id === activeTabId);
    return (
      <div ref={ref} className={cn('flex flex-col h-full', className)}>
        {/* Tab-Rail */}
        <div className="flex items-center gap-px bg-canvas border-b border-border-subtle overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabSelect(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 h-9 min-w-0 max-w-[240px] cursor-pointer',
                  'border-t-2 label-technical text-xs',
                  isActive
                    ? 'bg-surface border-accent-500 text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-elevated',
                )}
              >
                {tab.prefix && <span className="text-text-muted flex-shrink-0">{tab.prefix}</span>}
                <span className="truncate">{tab.title}</span>
                {tab.dirty && <span className="w-1 h-1 rounded-full bg-accent-500" aria-label="Ungespeichert" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  aria-label={`Tab ${tab.title} schließen`}
                  className="text-text-muted hover:text-text-primary flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          {onNewTab && (
            <button
              type="button"
              onClick={onNewTab}
              aria-label="Neuen Tab öffnen"
              className="px-2 h-9 text-text-muted hover:text-text-primary"
            >
              +
            </button>
          )}
        </div>

        {/* Tab-Inhalt */}
        <div className="flex-1 overflow-auto">
          {active ? active.content : (
            <div className="flex items-center justify-center h-full text-text-muted">
              Kein Tab geöffnet
            </div>
          )}
        </div>
      </div>
    );
  },
);

TabbedWorkArea.displayName = 'TabbedWorkArea';
