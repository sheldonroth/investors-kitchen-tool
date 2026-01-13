'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    ArrowLeft,
    ExternalLink,
    BarChart3,
    Info
} from 'lucide-react';

interface TopicAnalysis {
    topic: string;
    demand: {
        avgViews: number;
        totalViews: number;
        searchInterest: number;
        velocityAvg: number;
    };
    supply: {
        videoCount: number;
        qualityVideoCount: number;
        dominantChannelSize: string;
        avgAge: number;
    };
    gapIndicator: number;
    signalStrength: string;
    interpretation: string;
    sampleVideos: {
        title: string;
        views: number;
        velocity: number;
        thumbnail: string;
        id: string;
        channelSubs: number;
    }[];
}

interface GapResult {
    seed: string;
    marketOverview: {
        topicsAnalyzed: number;
        avgGapIndicator: number;
        strongSignals: number;
        moderateSignals: number;
    };
    opportunities: TopicAnalysis[];
    topPicks: TopicAnalysis[];
    methodology: {
        gapIndicator: string;
        supplyFloor: string;
        signalStrength: Record<string, string>;
        channelSizeContext: string;
        limitations: string[];
    };
    insight: string;
}

const regions = [
    { code: 'US', name: 'US' },
    { code: 'GB', name: 'UK' },
    { code: 'CA', name: 'CA' },
    { code: 'AU', name: 'AU' },
    { code: 'IN', name: 'IN' },
];

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getStrengthStyle(strength: string): string {
    if (strength === 'strong') return 'bg-emerald-950/30 border-emerald-800/50';
    if (strength === 'moderate') return 'bg-amber-950/30 border-amber-800/50';
    return 'bg-neutral-900 border-neutral-800';
}

function getStrengthColor(strength: string): string {
    if (strength === 'strong') return 'text-emerald-400';
    if (strength === 'moderate') return 'text-amber-400';
    return 'text-neutral-500';
}

export default function GapsPage() {
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState('US');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GapResult | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await axios.get('/api/gaps', {
                params: { seed: query, region }
            });
            setResult(response.data);
        } catch (error) {
            console.error('Gap detection failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Navigation */}
            <nav className="border-b border-neutral-800">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                        </div>
                        <span className="font-medium">Gap Analysis</span>
                    </div>
                    <a href="/" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Back
                    </a>
                </div>
            </nav>

            {/* Hero */}
            <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
                <h1 className="text-3xl font-light text-white tracking-tight mb-4">
                    Explore market gaps
                </h1>
                <p className="text-neutral-500 mb-10">
                    Signal strength based on available data. Not a guarantee.
                </p>

                {/* Search */}
                <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 focus-within:border-neutral-700 transition-colors max-w-xl mx-auto">
                    <Search className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter a market to analyze..."
                        className="flex-1 bg-transparent text-lg text-white placeholder-neutral-600 focus:outline-none"
                    />
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="text-sm text-neutral-500 bg-transparent border-none focus:outline-none cursor-pointer"
                    >
                        {regions.map(r => (
                            <option key={r.code} value={r.code}>{r.code}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleSearch}
                        disabled={loading || !query.trim()}
                        className="px-5 py-2 bg-white text-neutral-900 text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Scanning...' : 'Scan'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="max-w-5xl mx-auto px-6 py-16">
                    <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-neutral-500 text-sm">Scanning market...</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="max-w-5xl mx-auto px-6 pb-16 space-y-8">

                    {/* Methodology Disclaimer */}
                    <div className="flex items-start gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                        <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div className="text-sm text-neutral-400">
                            {result.methodology.gapIndicator}. {result.methodology.supplyFloor}
                        </div>
                    </div>

                    {/* Market Overview */}
                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Market Overview</p>
                        <p className="text-neutral-300 mb-6">{result.insight}</p>

                        <div className="grid grid-cols-4 gap-6">
                            <div>
                                <p className="text-3xl font-light text-white">{result.marketOverview.topicsAnalyzed}</p>
                                <p className="text-sm text-neutral-500">topics analyzed</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-white">{result.marketOverview.avgGapIndicator}</p>
                                <p className="text-sm text-neutral-500">avg gap indicator</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-emerald-400">{result.marketOverview.strongSignals}</p>
                                <p className="text-sm text-neutral-500">strong signals</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-amber-400">{result.marketOverview.moderateSignals}</p>
                                <p className="text-sm text-neutral-500">moderate signals</p>
                            </div>
                        </div>
                    </div>

                    {/* Top Picks */}
                    {result.topPicks.length > 0 && (
                        <div>
                            <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Strong signals</p>
                            <div className="grid md:grid-cols-3 gap-4">
                                {result.topPicks.map((opp, i) => (
                                    <div key={i} className={`rounded-xl p-5 border ${getStrengthStyle(opp.signalStrength)}`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <span className={`text-sm font-medium uppercase ${getStrengthColor(opp.signalStrength)}`}>
                                                {opp.signalStrength}
                                            </span>
                                            <span className="text-2xl font-light text-white">{opp.gapIndicator}</span>
                                        </div>
                                        <p className="text-white font-medium mb-2">{opp.topic}</p>
                                        <p className="text-sm text-neutral-400 mb-4">{opp.interpretation}</p>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-neutral-900/50 rounded-lg p-3">
                                                <p className="text-emerald-400 font-medium">{formatNumber(opp.demand.avgViews)}</p>
                                                <p className="text-xs text-neutral-500">avg views</p>
                                            </div>
                                            <div className="bg-neutral-900/50 rounded-lg p-3">
                                                <p className="text-amber-400 font-medium">{opp.supply.dominantChannelSize}</p>
                                                <p className="text-xs text-neutral-500">channel size</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Opportunities */}
                    <div>
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">All topics analyzed</p>
                        <div className="space-y-3">
                            {result.opportunities.map((opp, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl p-5 border ${getStrengthStyle(opp.signalStrength)}`}
                                >
                                    <div className="flex items-center gap-6">
                                        {/* Signal Strength */}
                                        <span className={`text-sm font-medium uppercase w-20 ${getStrengthColor(opp.signalStrength)}`}>
                                            {opp.signalStrength}
                                        </span>

                                        {/* Topic & Interpretation */}
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{opp.topic}</p>
                                            <p className="text-sm text-neutral-500">{opp.interpretation}</p>
                                        </div>

                                        {/* Metrics */}
                                        <div className="hidden md:flex gap-8 text-center">
                                            <div>
                                                <p className="text-white">{formatNumber(opp.demand.avgViews)}</p>
                                                <p className="text-xs text-neutral-500">avg views</p>
                                            </div>
                                            <div>
                                                <p className="text-white">{opp.supply.qualityVideoCount}/{opp.supply.videoCount}</p>
                                                <p className="text-xs text-neutral-500">quality/supply</p>
                                            </div>
                                            <div>
                                                <p className="text-white">{opp.supply.dominantChannelSize}</p>
                                                <p className="text-xs text-neutral-500">ch. size</p>
                                            </div>
                                        </div>

                                        {/* Gap Indicator */}
                                        <span className={`text-2xl font-light ${getStrengthColor(opp.signalStrength)}`}>
                                            {opp.gapIndicator}
                                        </span>
                                    </div>

                                    {/* Sample Videos */}
                                    {opp.sampleVideos.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-neutral-800">
                                            <div className="flex gap-4">
                                                {opp.sampleVideos.map((v, j) => (
                                                    <a
                                                        key={j}
                                                        href={`https://youtube.com/watch?v=${v.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 group"
                                                    >
                                                        <img
                                                            src={v.thumbnail}
                                                            alt={v.title}
                                                            className="w-24 aspect-video object-cover rounded-lg"
                                                        />
                                                        <div>
                                                            <p className="text-xs text-neutral-400 line-clamp-2 group-hover:text-white transition-colors">
                                                                {v.title}
                                                            </p>
                                                            <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1">
                                                                <span>{formatNumber(v.views)} views</span>
                                                                <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                                                            </div>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Limitations */}
                    <div className="bg-neutral-900/50 rounded-2xl p-6">
                        <p className="text-sm font-medium text-neutral-500 mb-3">Limitations</p>
                        <ul className="text-sm text-neutral-400 space-y-2">
                            {result.methodology.limitations.map((limitation, i) => (
                                <li key={i}>• {limitation}</li>
                            ))}
                        </ul>
                    </div>

                    {/* New Search */}
                    <div className="text-center pt-4">
                        <button
                            onClick={() => { setResult(null); setQuery(''); }}
                            className="text-neutral-500 hover:text-white text-sm transition-colors"
                        >
                            Scan another market
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!result && !loading && (
                <div className="max-w-2xl mx-auto px-6 py-8 text-center">
                    <p className="text-neutral-500 text-sm mb-6">Try these markets</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['personal finance', 'home fitness', 'productivity apps', 'cooking basics'].map(example => (
                            <button
                                key={example}
                                onClick={() => setQuery(example)}
                                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-full text-sm text-neutral-400 transition-colors"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
