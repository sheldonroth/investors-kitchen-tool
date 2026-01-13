'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    ArrowLeft,
    Users,
    Play,
    Eye,
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
    Youtube
} from 'lucide-react';

interface ChannelInfo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    subscribers: number;
    videoCount: number;
    viewCount: number;
}

interface ContentGap {
    topic: string;
    opportunity: string;
    reasoning: string;
    urgency: 'high' | 'medium' | 'low';
}

interface VideoPerformer {
    id: string;
    title: string;
    views: number;
    thumbnail?: string;
    zScore: number;
}

interface ChannelResult {
    channel: ChannelInfo;
    performance: {
        avgViews: number;
        viewsToSubRatio: string;
        postingFrequency: string;
        outlierRate: string;
    };
    contentMix: {
        shorts: { count: number; avgViews: number };
        longForm: { count: number; avgViews: number };
        topFormat: string;
    };
    topPerformers: VideoPerformer[];
    underperformers: VideoPerformer[];
    topTopics: { word: string; count: number }[];
    contentGaps: ContentGap[];
    methodology: {
        videosAnalyzed: number;
        limitations: string[];
    };
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

const urgencyColors = {
    high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30'
};

export default function ChannelPage() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ChannelResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await axios.get('/api/channel', {
                params: { channel: input }
            });
            setResult(response.data);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to analyze channel');
            }
        } finally {
            setLoading(false);
        }
    };

    const copyTopic = (topic: string, index: number) => {
        navigator.clipboard.writeText(topic);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/10 via-transparent to-transparent pointer-events-none" />

            {/* Navigation */}
            <nav className="relative z-10 border-b border-white/5">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <Youtube className="w-5 h-5 text-white" strokeWidth={2} />
                        </div>
                        <span className="font-semibold text-white tracking-tight">Channel Analyzer</span>
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-6">
                        <Zap className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Personalized content opportunities</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-4">
                        Analyze any<br />
                        <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">YouTube channel</span>
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Paste a channel URL to get tailored content suggestions
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-xl mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-50" />
                    <div className="relative flex items-center gap-3 p-4 bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-white/10 focus-within:border-rose-500/50 transition-all shadow-2xl shadow-black/20">
                        <Search className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            placeholder="@handle, channel URL, or channel ID"
                            className="flex-1 bg-transparent text-lg text-white placeholder-neutral-500 focus:outline-none"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !input.trim()}
                            className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-medium rounded-xl hover:from-rose-400 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-500/25"
                        >
                            {loading ? 'Analyzing...' : 'Analyze'}
                        </button>
                    </div>
                </div>

                {/* Examples */}
                {!result && !loading && (
                    <p className="text-center text-sm text-neutral-600 mt-4">
                        Try: @mkbhd, youtube.com/@veritasium, or UCq-Fj5jknLsUf-MWSy4_brA
                    </p>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-2 border-neutral-800 border-t-rose-500 rounded-full animate-spin mb-4" />
                        <p className="text-neutral-500 text-sm">Analyzing channel performance...</p>
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

                    {/* Channel Header */}
                    <div className="flex items-center gap-5 p-6 bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5">
                        <img
                            src={result.channel.thumbnail}
                            alt={result.channel.title}
                            className="w-20 h-20 rounded-2xl object-cover"
                        />
                        <div className="flex-1">
                            <h2 className="text-2xl font-medium text-white">{result.channel.title}</h2>
                            <div className="flex items-center gap-6 mt-2 text-sm text-neutral-400">
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4" strokeWidth={1.5} />
                                    {formatNumber(result.channel.subscribers)} subs
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Play className="w-4 h-4" strokeWidth={1.5} />
                                    {result.channel.videoCount} videos
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                                    {formatNumber(result.channel.viewCount)} total views
                                </span>
                            </div>
                        </div>
                        <a
                            href={`https://youtube.com/channel/${result.channel.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 text-neutral-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <ExternalLink className="w-5 h-5" strokeWidth={1.5} />
                        </a>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Avg Views</p>
                            <p className="text-2xl font-light text-white">{formatNumber(result.performance.avgViews)}</p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Views/Subs Ratio</p>
                            <p className="text-2xl font-light text-white">{result.performance.viewsToSubRatio}</p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Posting</p>
                            <p className="text-2xl font-light text-white">{result.performance.postingFrequency}</p>
                        </div>
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <p className="text-sm text-neutral-500 mb-1">Outlier Rate</p>
                            <p className="text-2xl font-light text-white">{result.performance.outlierRate}</p>
                        </div>
                    </div>

                    {/* Content Mix */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-violet-950/20 rounded-2xl border border-violet-800/30 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
                                <p className="text-sm text-violet-400 uppercase tracking-wide">Shorts</p>
                            </div>
                            <p className="text-3xl font-light text-white">{result.contentMix.shorts.count}</p>
                            <p className="text-sm text-neutral-500 mt-1">Avg: {formatNumber(result.contentMix.shorts.avgViews)} views</p>
                        </div>
                        <div className="bg-emerald-950/20 rounded-2xl border border-emerald-800/30 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                <p className="text-sm text-emerald-400 uppercase tracking-wide">Long-form</p>
                            </div>
                            <p className="text-3xl font-light text-white">{result.contentMix.longForm.count}</p>
                            <p className="text-sm text-neutral-500 mt-1">Avg: {formatNumber(result.contentMix.longForm.avgViews)} views</p>
                        </div>
                    </div>

                    {/* Content Gaps - The Main Value */}
                    {result.contentGaps.length > 0 && (
                        <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 rounded-2xl border border-rose-500/20 overflow-hidden">
                            <div className="p-5 border-b border-rose-500/20 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-rose-400" strokeWidth={1.5} />
                                <h3 className="font-medium text-white">Content opportunities for this channel</h3>
                            </div>
                            <div className="divide-y divide-rose-500/10">
                                {result.contentGaps.map((gap, i) => (
                                    <div key={i} className="p-5 hover:bg-white/5 transition-colors">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <p className="text-white font-medium">{gap.topic}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${urgencyColors[gap.urgency]}`}>
                                                    {gap.urgency}
                                                </span>
                                                <button
                                                    onClick={() => copyTopic(gap.topic, i)}
                                                    className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                                                >
                                                    {copiedIndex === i ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-rose-300/80 mb-1">{gap.opportunity}</p>
                                        <p className="text-xs text-neutral-500">{gap.reasoning}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Top Performers */}
                    {result.topPerformers.length > 0 && (
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                <h3 className="font-medium text-white">Best performing videos</h3>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4 p-5">
                                {result.topPerformers.slice(0, 3).map((v) => (
                                    <a
                                        key={v.id}
                                        href={`https://youtube.com/watch?v=${v.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group"
                                    >
                                        <div className="aspect-video rounded-xl overflow-hidden bg-neutral-800 mb-2">
                                            <img
                                                src={v.thumbnail}
                                                alt={v.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        </div>
                                        <p className="text-sm text-neutral-300 line-clamp-2 group-hover:text-white transition-colors">{v.title}</p>
                                        <p className="text-xs text-neutral-500 mt-1">{formatNumber(v.views)} views · z: {v.zScore}</p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Underperformers */}
                    {result.underperformers.length > 0 && (
                        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingDown className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
                                <h3 className="font-medium text-white">Videos to avoid replicating</h3>
                            </div>
                            <div className="space-y-2">
                                {result.underperformers.map((v) => (
                                    <div key={v.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                        <p className="text-sm text-neutral-300 line-clamp-1 flex-1 mr-4">{v.title}</p>
                                        <p className="text-xs text-neutral-500 shrink-0">{formatNumber(v.views)} views</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Top Topics */}
                    <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-3">Common topics in this channel</p>
                        <div className="flex flex-wrap gap-2">
                            {result.topTopics.map((topic, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 bg-white/5 rounded-full text-sm text-neutral-300"
                                >
                                    {topic.word} <span className="text-neutral-600">({topic.count})</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Methodology */}
                    <div className="text-center text-sm text-neutral-600">
                        <p>Analyzed {result.methodology.videosAnalyzed} videos · {result.methodology.limitations[0]}</p>
                    </div>

                    {/* New Search */}
                    <div className="text-center">
                        <button
                            onClick={() => { setResult(null); setInput(''); }}
                            className="text-neutral-500 hover:text-white text-sm transition-colors"
                        >
                            Analyze another channel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
