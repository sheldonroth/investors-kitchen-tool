'use client';

import { useState } from 'react';
import axios from 'axios';

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
        case 'A': return 'bg-green-500';
        case 'B': return 'bg-green-400';
        case 'C': return 'bg-yellow-400';
        case 'D': return 'bg-orange-400';
        default: return 'bg-red-400';
    }
}

function getGradeTextColor(grade: string): string {
    switch (grade) {
        case 'A': return 'text-green-600';
        case 'B': return 'text-green-500';
        case 'C': return 'text-yellow-600';
        case 'D': return 'text-orange-500';
        default: return 'text-red-500';
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
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <span className="font-bold text-lg">Content Arbitrage Scanner</span>
                    </div>
                    <a href="/" className="text-sm text-slate-400 hover:text-white">← Back to Evaluator</a>
                </div>
            </div>

            {/* Search */}
            <div className="max-w-3xl mx-auto px-4 pt-12 pb-8 text-center">
                <h1 className="text-3xl font-bold mb-2">Find Undervalued Content Opportunities</h1>
                <p className="text-slate-400 mb-8">
                    Identify topics where audience demand exceeds quality supply
                </p>

                <div className="flex gap-2 max-w-xl mx-auto">
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="px-3 py-3 bg-slate-800 border border-slate-600 rounded-xl text-sm"
                    >
                        {regions.map(r => (
                            <option key={r.code} value={r.code}>{r.code}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter a market to analyze..."
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading || !query.trim()}
                        className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 disabled:opacity-50"
                    >
                        {loading ? 'Scanning...' : 'Scan Market'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="max-w-5xl mx-auto px-4 py-12">
                    <div className="text-center text-slate-400">
                        <div className="text-4xl mb-4">📡</div>
                        <p>Analyzing market for arbitrage opportunities...</p>
                        <p className="text-sm text-slate-500 mt-2">Scanning demand signals, quality supply, and opportunity gaps</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="max-w-5xl mx-auto px-4 pb-16 space-y-8">

                    {/* Market Overview */}
                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">🎯</span>
                            <h2 className="text-xl font-bold">Market Overview: {result.seed}</h2>
                        </div>
                        <p className="text-lg text-green-400 mb-4">{result.investorInsight}</p>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold">{result.marketOverview.totalAnalyzed}</div>
                                <div className="text-sm text-slate-400">Topics Analyzed</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold">{result.marketOverview.averageOpportunity}</div>
                                <div className="text-sm text-slate-400">Avg Opportunity</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-400">{result.marketOverview.bestOpportunity}</div>
                                <div className="text-sm text-slate-400">Best Score</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-400">{result.marketOverview.strongOpportunities}</div>
                                <div className="text-sm text-slate-400">Strong Picks</div>
                            </div>
                        </div>
                    </div>

                    {/* Top Picks */}
                    {result.topPicks.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span>🏆</span> Top Investment Picks
                            </h2>
                            <div className="grid md:grid-cols-3 gap-4">
                                {result.topPicks.map((opp, i) => (
                                    <div key={i} className="bg-gradient-to-br from-green-900/30 to-slate-800 rounded-2xl p-5 border border-green-500/30">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`text-3xl font-black ${getGradeTextColor(opp.opportunityGrade)}`}>
                                                {opp.opportunityGrade}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-green-400">{opp.opportunityScore}</div>
                                                <div className="text-xs text-slate-400">Opportunity</div>
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-lg mb-2">{opp.topic}</h3>
                                        <p className="text-sm text-slate-300 mb-4">{opp.arbitrageSignal}</p>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-slate-900/50 rounded-lg p-2">
                                                <div className="text-green-400 font-bold">{formatNumber(opp.demand.avgViews)}</div>
                                                <div className="text-slate-500">Avg Views</div>
                                            </div>
                                            <div className="bg-slate-900/50 rounded-lg p-2">
                                                <div className="text-yellow-400 font-bold">{opp.supply.qualityVideoCount}</div>
                                                <div className="text-slate-500">Quality Videos</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Opportunities */}
                    <div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>📈</span> All Opportunities (Ranked)
                        </h2>
                        <div className="space-y-3">
                            {result.opportunities.map((opp, i) => (
                                <div
                                    key={i}
                                    className={`bg-slate-800/50 rounded-xl p-4 border ${opp.opportunityScore >= 65 ? 'border-green-500/30' : 'border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Grade */}
                                        <div className={`w-12 h-12 rounded-xl ${getGradeColor(opp.opportunityGrade)} flex items-center justify-center`}>
                                            <span className="text-xl font-black text-black">{opp.opportunityGrade}</span>
                                        </div>

                                        {/* Topic & Signal */}
                                        <div className="flex-1">
                                            <div className="font-bold text-lg">{opp.topic}</div>
                                            <div className="text-sm text-slate-400">{opp.arbitrageSignal}</div>
                                        </div>

                                        {/* Metrics */}
                                        <div className="hidden md:flex gap-6 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-green-400">{formatNumber(opp.demand.avgViews)}</div>
                                                <div className="text-xs text-slate-500">Demand</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-yellow-400">{opp.supply.qualityVideoCount}/{opp.supply.videoCount}</div>
                                                <div className="text-xs text-slate-500">Quality/Supply</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold">{opp.demand.searchInterest}</div>
                                                <div className="text-xs text-slate-500">Search Interest</div>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right">
                                            <div className={`text-2xl font-bold ${opp.opportunityScore >= 65 ? 'text-green-400' :
                                                    opp.opportunityScore >= 50 ? 'text-yellow-400' :
                                                        'text-slate-400'
                                                }`}>
                                                {opp.opportunityScore}
                                            </div>
                                            <div className="text-xs text-slate-500">Score</div>
                                        </div>
                                    </div>

                                    {/* Sample Videos */}
                                    {opp.sampleVideos.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-700">
                                            <div className="text-xs text-slate-500 mb-2">Current Market Sample</div>
                                            <div className="flex gap-4 overflow-x-auto">
                                                {opp.sampleVideos.map((v, j) => (
                                                    <a
                                                        key={j}
                                                        href={`https://youtube.com/watch?v=${v.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="shrink-0 w-48 group"
                                                    >
                                                        <img
                                                            src={v.thumbnail}
                                                            alt={v.title}
                                                            className="w-full aspect-video object-cover rounded-lg group-hover:ring-2 ring-green-500"
                                                        />
                                                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">{v.title}</p>
                                                        <p className="text-xs text-slate-500">{formatNumber(v.views)} views</p>
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
                            className="text-green-400 hover:underline text-sm"
                        >
                            ← Scan another market
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!result && !loading && (
                <div className="max-w-2xl mx-auto px-4 py-8 text-center text-slate-500">
                    <p>Enter a market above to scan for content arbitrage opportunities</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {['personal finance', 'home fitness', 'productivity apps', 'cooking basics'].map(example => (
                            <button
                                key={example}
                                onClick={() => { setQuery(example); }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm text-slate-300"
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
