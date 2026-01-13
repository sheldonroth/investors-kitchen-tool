'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    ArrowLeft,
    Eye,
    ThumbsUp,
    MessageSquare,
    TrendingUp,
    TrendingDown,
    Lightbulb,
    ExternalLink,
    Copy,
    Check,
    BarChart3,
    Clock,
    Zap,
    AlertCircle,
    Shuffle,
    Image as ImageIcon,
    Target,
    Award,
    PlayCircle
} from 'lucide-react';

interface VideoData {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    views: number;
    likes: number;
    comments: number;
    publishedAt: string;
    channelTitle: string;
    isShort: boolean;
    velocity: number;
    daysSince: number;
    engagement: {
        likeRatio: number;
        commentRatio: number;
    };
}

interface Competitor {
    id: string;
    title: string;
    views: number;
    thumbnail?: string;
    zScore?: number;
}

interface AuditResult {
    video: VideoData;
    channel: {
        id: string;
        title: string;
        subscribers: number;
        viewToSubRatio: string;
    };
    competitivePosition: {
        zScore: number;
        percentile: number;
        level: string;
        competitionLevel: string;
        sampleSize: number;
    };
    retroVerdict: {
        prediction: string;
        message: string;
        wouldHaveRecommended: boolean;
    };
    titleAnalysis: {
        patterns: string[];
        wordCount: number;
        charCount: number;
        hasHooks: boolean;
    };
    aiInsights: {
        whatWorked: string[];
        whatCouldImprove: string[];
        followUpIdeas: string[];
        betterTitles: string[];
    };
    topCompetitors: Competitor[];
    methodology: {
        approach: string;
        limitations: string[];
    };
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}:${secs.toString().padStart(2, '0')}`;
    const hours = Math.floor(mins / 60);
    return `${hours}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const verdictColors: Record<string, string> = {
    'Favorable': 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    'Mixed': 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    'Challenging': 'from-rose-500/20 to-rose-600/10 border-rose-500/30'
};

const levelColors: Record<string, string> = {
    'Outlier (Top Performer)': 'text-emerald-400',
    'Above Average': 'text-emerald-400',
    'Average': 'text-amber-400',
    'Below Average': 'text-rose-400'
};

export default function AuditPage() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AuditResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleAudit = async () => {
        if (!input.trim()) return;

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await axios.get('/api/audit', {
                params: { video: input }
            });
            setResult(response.data);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to audit video');
            }
        } finally {
            setLoading(false);
        }
    };

    const copyText = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent pointer-events-none" />

            {/* Navigation */}
            <nav className="relative z-10 border-b border-white/5">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Target className="w-5 h-5 text-white" strokeWidth={2} />
                        </div>
                        <span className="font-semibold text-white tracking-tight">Video Audit</span>
                    </div>
                    <a href="/" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Back
                    </a>
                </div>
            </nav>

            {/* Hero */}
            <div className="relative z-10 max-w-3xl mx-auto px-6 pt-16 pb-12">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-6">
                        <Zap className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Learn from any video</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-4">
                        Audit any<br />
                        <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">YouTube video</span>
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Paste a video URL to see how it performed and what you can learn
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-xl mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50" />
                    <div className="relative flex items-center gap-3 p-4 bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-white/10 focus-within:border-amber-500/50 transition-all shadow-2xl shadow-black/20">
                        <PlayCircle className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
                            placeholder="youtube.com/watch?v=... or video ID"
                            className="flex-1 bg-transparent text-lg text-white placeholder-neutral-500 focus:outline-none"
                        />
                        <button
                            onClick={handleAudit}
                            disabled={loading || !input.trim()}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/25"
                        >
                            {loading ? 'Auditing...' : 'Audit'}
                        </button>
                    </div>
                </div>

                {/* Examples */}
                {!result && !loading && (
                    <p className="text-center text-sm text-neutral-600 mt-4">
                        Works with youtube.com/watch, youtu.be, /shorts/ URLs
                    </p>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-2 border-neutral-800 border-t-amber-500 rounded-full animate-spin mb-4" />
                        <p className="text-neutral-500 text-sm">Analyzing video performance...</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
                    <div className="flex items-start gap-3 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-rose-200">{error}</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="relative z-10 max-w-5xl mx-auto px-6 pb-16 space-y-8">

                    {/* Video Header */}
                    <div className="flex flex-col md:flex-row gap-6 p-6 bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5">
                        <div className="md:w-80 shrink-0">
                            <div className="aspect-video rounded-xl overflow-hidden bg-neutral-800 relative">
                                <img
                                    src={result.video.thumbnail}
                                    alt={result.video.title}
                                    className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs">
                                    {formatDuration(result.video.duration)}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <h2 className="text-xl font-medium text-white line-clamp-2">{result.video.title}</h2>
                                <a
                                    href={`https://youtube.com/watch?v=${result.video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 p-2 text-neutral-500 hover:text-white transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                                </a>
                            </div>
                            <p className="text-sm text-neutral-500 mb-4">{result.channel.title} · {formatDate(result.video.publishedAt)}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5 text-neutral-400">
                                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                                    {formatNumber(result.video.views)} views
                                </span>
                                <span className="flex items-center gap-1.5 text-neutral-400">
                                    <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
                                    {result.video.engagement.likeRatio}%
                                </span>
                                <span className="flex items-center gap-1.5 text-neutral-400">
                                    <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                                    {formatNumber(result.video.comments)}
                                </span>
                                <span className="flex items-center gap-1.5 text-neutral-400">
                                    <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                                    {formatNumber(result.video.velocity)}/day
                                </span>
                                {result.video.isShort && (
                                    <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs">Short</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Retroactive Verdict */}
                    <div className={`rounded-2xl p-6 border bg-gradient-to-br ${verdictColors[result.retroVerdict.prediction] || verdictColors['Mixed']}`}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                                <p className="text-sm text-white/50 uppercase tracking-wide font-medium mb-1">If you asked us before making this</p>
                                <p className="text-3xl font-light text-white">We'd have said: {result.retroVerdict.prediction}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-white/40">Percentile</p>
                                <p className="text-2xl font-light text-white">{result.competitivePosition.percentile}th</p>
                            </div>
                        </div>
                        <p className="text-white/80">{result.retroVerdict.message}</p>
                    </div>

                    {/* Competitive Position */}
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Z-Score</p>
                            <p className={`text-2xl font-light ${result.competitivePosition.zScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {result.competitivePosition.zScore > 0 ? '+' : ''}{result.competitivePosition.zScore}
                            </p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Performance</p>
                            <p className={`text-2xl font-light ${levelColors[result.competitivePosition.level] || 'text-white'}`}>
                                {result.competitivePosition.level.split('(')[0].trim()}
                            </p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Competition</p>
                            <p className="text-2xl font-light text-white">{result.competitivePosition.competitionLevel}</p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">View/Sub Ratio</p>
                            <p className="text-2xl font-light text-white">{result.channel.viewToSubRatio}</p>
                        </div>
                    </div>

                    {/* AI Insights */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* What Worked */}
                        {result.aiInsights.whatWorked.length > 0 && (
                            <div className="bg-emerald-950/20 rounded-2xl border border-emerald-800/30 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                    <h3 className="font-medium text-emerald-400">What likely worked</h3>
                                </div>
                                <ul className="space-y-2">
                                    {result.aiInsights.whatWorked.map((point, i) => (
                                        <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">•</span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* What Could Improve */}
                        {result.aiInsights.whatCouldImprove.length > 0 && (
                            <div className="bg-amber-950/20 rounded-2xl border border-amber-800/30 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Lightbulb className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                                    <h3 className="font-medium text-amber-400">What could improve</h3>
                                </div>
                                <ul className="space-y-2">
                                    {result.aiInsights.whatCouldImprove.map((point, i) => (
                                        <li key={i} className="text-sm text-neutral-300 flex items-start gap-2">
                                            <span className="text-amber-400 mt-1">•</span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Better Titles with Random Walk Link */}
                    {result.aiInsights.betterTitles.length > 0 && (
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
                                    <h3 className="font-medium text-white">Title alternatives (AI-generated)</h3>
                                </div>
                                <a
                                    href={`/random-walk?title=${encodeURIComponent(result.video.title)}&niche=${encodeURIComponent(result.video.title.split(/[:|—\-]/).slice(0, 2).join(' ').replace(/[^\w\s]/g, '').trim())}`}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-300 text-sm rounded-lg hover:bg-violet-500/30 transition-colors"
                                >
                                    <Shuffle className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span>Optimize with data</span>
                                </a>
                            </div>
                            <div className="divide-y divide-white/5">
                                {result.aiInsights.betterTitles.map((title, i) => (
                                    <div key={i} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                                        <p className="text-white">{title}</p>
                                        <button
                                            onClick={() => copyText(title, i)}
                                            className="shrink-0 p-2 text-neutral-500 hover:text-white transition-colors"
                                        >
                                            {copiedIndex === i ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Competitor Thumbnails for Reference */}
                    {result.topCompetitors.length > 0 && (
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
                                <h3 className="font-medium text-white">Top competitor thumbnails to study</h3>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                    {result.topCompetitors.map((comp) => (
                                        <a
                                            key={comp.id}
                                            href={`https://youtube.com/watch?v=${comp.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group"
                                        >
                                            <div className="aspect-video rounded-lg overflow-hidden bg-neutral-800 mb-1">
                                                {comp.thumbnail ? (
                                                    <img
                                                        src={comp.thumbnail}
                                                        alt={comp.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                                        <ImageIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-500">{formatNumber(comp.views)} views</p>
                                        </a>
                                    ))}
                                </div>
                                <p className="text-xs text-neutral-600 mt-3">
                                    These thumbnails are from videos that outperformed in the same topic. Study their patterns for inspiration.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Follow-up Ideas */}
                    {result.aiInsights.followUpIdeas.length > 0 && (
                        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-500/20 overflow-hidden">
                            <div className="p-5 border-b border-violet-500/20 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
                                <h3 className="font-medium text-white">Follow-up video ideas</h3>
                            </div>
                            <div className="divide-y divide-violet-500/10">
                                {result.aiInsights.followUpIdeas.map((idea, i) => (
                                    <div key={i} className="p-5 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                                        <p className="text-white">{idea}</p>
                                        <button
                                            onClick={() => copyText(idea, i + 100)}
                                            className="shrink-0 p-2 text-neutral-500 hover:text-white transition-colors"
                                        >
                                            {copiedIndex === i + 100 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Title Patterns */}
                    <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-3">Title patterns detected</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {result.titleAnalysis.patterns.length > 0 ? (
                                result.titleAnalysis.patterns.map((pattern, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-white/5 rounded-full text-sm text-neutral-300">
                                        {pattern}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-neutral-500">No common patterns detected</span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-500">
                            <span>{result.titleAnalysis.wordCount} words</span>
                            <span>{result.titleAnalysis.charCount} characters</span>
                            <span>{result.titleAnalysis.hasHooks ? '✓ Has hooks' : '✗ No hooks'}</span>
                        </div>
                    </div>

                    {/* Methodology */}
                    <div className="text-center text-sm text-neutral-600">
                        <p>Compared against {result.competitivePosition.sampleSize} similar videos · {result.methodology.limitations[0]}</p>
                    </div>

                    {/* New Audit */}
                    <div className="text-center">
                        <button
                            onClick={() => { setResult(null); setInput(''); }}
                            className="text-neutral-500 hover:text-white text-sm transition-colors"
                        >
                            Audit another video
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
