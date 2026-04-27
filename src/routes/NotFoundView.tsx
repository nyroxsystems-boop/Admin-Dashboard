/**
 * NotFoundView — 404 with EmptyState look.
 */
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Compass } from 'lucide-react';

export default function NotFoundView(): JSX.Element {
    const nav = useNavigate();
    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
            <EmptyState
                icon={Compass}
                title="404 — Seite nicht gefunden"
                description="Diese Route existiert (noch) nicht."
                actionLabel="Zur Übersicht"
                onAction={() => nav('/')}
            />
        </div>
    );
}
