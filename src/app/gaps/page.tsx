'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    ArrowLeft,
    TrendingUp,
    ExternalLink,
    BarChart3
} from 'lucide-react';

interface Opportunity {
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
        channelConcentration: number;
        avgAge: number;
    };
    opportunityScore: number;
    opportunityGrade: string;
    arbitrageSignal: string;
    sampleVideos: {
        title: string;
        views: number;
        velocity: number;
        thumbnail: string;
        id: string;
    }[];
}

interface GapResult {
    seed: string;
    marketOverview: {
        totalAnalyzed: number;
        averageOpportunity: number;
        bestOpportunity: number;
        strongOpportunities: number;
    };
    opportunities: Opportunity[];
    topPicks: Opportunity[];
    investorInsight: string;
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

function getGradeColor(grade: string): string {
    switch (grade) {
        case 'A': return 'text-emerald-400';
        case 'B': return 'text-emerald-500';
        case 'C': return 'text-amber-400';
        case 'D': return 'text-amber-500';
        default: return 'text-neutral-500';
    }
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
                        <span className="font-medium">Content Gaps</span>
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
                    Find undervalued opportunities
                </h1>
                <p className="text-neutral-500 mb-10">
                    Topics where demand exceeds quality supply
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

                    {/* Market Overview */}
                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Market Overview</p>
                        <p className="text-neutral-300 mb-6">{result.investorInsight}</p>

                        <div className="grid grid-cols-4 gap-6">
                            <div>
                                <p className="text-3xl font-light text-white">{result.marketOverview.totalAnalyzed}</p>
                                <p className="text-sm text-neutral-500">topics analyzed</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-white">{result.marketOverview.averageOpportunity}</p>
                                <p className="text-sm text-neutral-500">avg opportunity</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-emerald-400">{result.marketOverview.bestOpportunity}</p>
                                <p className="text-sm text-neutral-500">best score</p>
                            </div>
                            <div>
                                <p className="text-3xl font-light text-emerald-400">{result.marketOverview.strongOpportunities}</p>
                                <p className="text-sm text-neutral-500">strong picks</p>
                            </div>
                        </div>
                    </div>

                    {/* Top Picks */}
                    {result.topPicks.length > 0 && (
                        <div>
                            <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Top picks</p>
                            <div className="grid md:grid-cols-3 gap-4">
                                {result.topPicks.map((opp, i) => (
                                    <div key={i} className="bg-emerald-950/30 rounded-xl p-5 border border-emerald-800/50">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className={`text-2xl font-light ${getGradeColor(opp.opportunityGrade)}`}>
                                                {opp.opportunityGrade}
                                            </span>
                                            <span className="text-2xl font-light text-emerald-400">{opp.opportunityScore}</span>
                                        </div>
                                        <p className="text-white font-medium mb-2">{opp.topic}</p>
                                        <p className="text-sm text-neutral-400 mb-4">{opp.arbitrageSignal}</p>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-neutral-900/50 rounded-lg p-3">
                                                <p className="text-emerald-400 font-medium">{formatNumber(opp.demand.avgViews)}</p>
                                                <p className="text-xs text-neutral-500">avg views</p>
                                            </div>
                                            <div className="bg-neutral-900/50 rounded-lg p-3">
                                                <p className="text-amber-400 font-medium">{opp.supply.qualityVideoCount}</p>
                                                <p className="text-xs text-neutral-500">quality videos</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Opportunities */}
                    <div>
                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">All opportunities</p>
                        <div className="space-y-3">
                            {result.opportunities.map((opp, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl p-5 border ${opp.opportunityScore >= 65 ? 'bg-neutral-900 border-emerald-800/30' : 'bg-neutral-900 border-neutral-800'
                                        }`}
                                >
                                    <div className="flex items-center gap-6">
                                        {/* Grade */}
                                        <span className={`text-2xl font-light w-8 ${getGradeColor(opp.opportunityGrade)}`}>
                                            {opp.opportunityGrade}
                                        </span>

                                        {/* Topic & Signal */}
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{opp.topic}</p>
                                            <p className="text-sm text-neutral-500">{opp.arbitrageSignal}</p>
                                        </div>

                                        {/* Metrics */}
                                        <div className="hidden md:flex gap-8 text-center">
                                            <div>
                                                <p className="text-white">{formatNumber(opp.demand.avgViews)}</p>
                                                <p className="text-xs text-neutral-500">demand</p>
                                            </div>
                                            <div>
                                                <p className="text-white">{opp.supply.qualityVideoCount}/{opp.supply.videoCount}</p>
                                                <p className="text-xs text-neutral-500">quality/supply</p>
                                            </div>
                                            <div>
                                                <p className="text-white">{opp.demand.searchInterest}</p>
                                                <p className="text-xs text-neutral-500">interest</p>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <span className={`text-2xl font-light ${opp.opportunityScore >= 65 ? 'text-emerald-400' :
                                                opp.opportunityScore >= 50 ? 'text-amber-400' : 'text-neutral-500'
                                            }`}>
                                            {opp.opportunityScore}
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
