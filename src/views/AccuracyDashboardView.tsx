import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, CheckCircle, XCircle, Target, Clock, BarChart2 } from 'lucide-react';
import { fetchAccuracyStats, AccuracyStats } from '../api/wws';
import { toast } from 'sonner';
import { StatsCard } from '../components/AdminUI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function AccuracyDashboardView() {
    const [stats, setStats] = useState<AccuracyStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await fetchAccuracyStats();
            setStats(data);
        } catch (err) {
            toast.error('Konnte Accuracy Analytics nicht laden');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    if (loading && !stats) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm">Lade Analytics...</p>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    // Format data for charts
    const sourceData = Object.entries(stats.sourceStats || {}).map(([name, data]) => ({
        name: name.replace('gemini_', '').replace('_source', ''),
        total: data.contributed,
        confirmed: data.confirmed,
        rejected: data.rejected,
        accuracy: data.contributed > 0 ? ((data.confirmed / data.contributed) * 100).toFixed(1) : 0
    })).sort((a, b) => b.total - a.total);

    const brandData = Object.entries(stats.brandStats || {}).map(([name, data]) => ({
        name,
        total: data.total,
        accuracy: data.total > 0 ? ((data.confirmed / data.total) * 100).toFixed(1) : 0
    })).sort((a, b) => b.total - a.total).slice(0, 10); // Top 10 brands

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold">OEM Resolution Accuracy</h2>
                    <p className="text-muted-foreground mt-1">APEX Pipeline KI Performance Analytics</p>
                </div>
                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                    <RefreshCcw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Top KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard
                    title="Resolutions (Gesamt)"
                    value={stats.totalResolutions}
                    icon={<BarChart2 className="w-5 h-5 text-white" />}
                    trend={`${stats.withOem} erfolgreich`}
                    color="from-primary to-primary/70"
                />
                <StatsCard
                    title="Resolution Rate"
                    value={`${(stats.resolutionRate * 100).toFixed(1)}%`}
                    icon={<Target className="w-5 h-5 text-white" />}
                    trend="OEM gefunden vs Leer"
                    color="from-accent to-accent/70"
                />
                <StatsCard
                    title="Real Accuracy"
                    value={`${(stats.accuracyRate * 100).toFixed(1)}%`}
                    icon={<CheckCircle className="w-5 h-5 text-white" />}
                    trend={`${stats.confirmed} OK / ${stats.rejected} Falsch`}
                    color="from-blue-500 to-indigo-600"
                />
                <StatsCard
                    title="Avg. Latenz"
                    value={`${stats.avgDurationMs}ms`}
                    icon={<Clock className="w-5 h-5 text-white" />}
                    trend={stats.avgDurationMs < 3000 ? 'Sehr schnell' : 'Langsam'}
                    color="from-accent to-accent/70"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source Performance Chart */}
                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Performance pro Source</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sourceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.1)" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#888', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: 'none', color: '#fff' }}
                                />
                                <Bar dataKey="total" name="Gesamt" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="confirmed" name="Bestätigt" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Brand Performance */}
                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Top 10 Automarken Accuracy</h3>
                    <div className="space-y-4">
                        {brandData.map((brand) => (
                            <div key={brand.name} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">{brand.name}</span>
                                        <span className="text-sm text-muted-foreground">{brand.accuracy}% ({brand.total} Anfragen)</span>
                                    </div>
                                    <div className="w-full bg-muted/50 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${parseFloat(brand.accuracy as string) > 85 ? 'bg-success' : parseFloat(brand.accuracy as string) > 70 ? 'bg-warn' : 'bg-danger'}`}
                                            style={{ width: `${Math.max(5, parseFloat(brand.accuracy as string))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {brandData.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Noch nicht genug Daten für Marken-Statistiken
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
