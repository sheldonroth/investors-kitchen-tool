'use client';

import { useState } from 'react';
import axios from 'axios';

type OracleTool = 'failures' | 'blue-ocean' | 'competitor-gaps' | 'momentum' | 'thumbnails';

interface ToolInfo {
    id: OracleTool;
    name: string;
    icon: string;
    description: string;
    inputLabel: string;
    inputPlaceholder: string;
}

const TOOLS: ToolInfo[] = [
    {
        id: 'failures',
        name: 'Failure Predictor',
        icon: '🚫',
        description: 'Avoid title patterns that kill videos',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., cooking tutorials'
    },
    {
        id: 'momentum',
        name: 'Momentum Detector',
        icon: '🔥',
        description: 'Find topics spiking RIGHT NOW',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., personal finance'
    },
    {
        id: 'blue-ocean',
        name: 'Blue Ocean Generator',
        icon: '🌊',
        description: 'Create new content categories',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., home repair'
    },
    {
        id: 'competitor-gaps',
        name: 'Competitor Gap Finder',
        icon: '🎯',
        description: 'Find what competitors missed',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., fitness'
    },
    {
        id: 'thumbnails',
        name: 'Thumbnail Scorer',
        icon: '🖼️',
        description: 'Learn what thumbnails work',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., tech reviews'
    }
];

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export default function OraclePage() {
    const [selectedTool, setSelectedTool] = useState<OracleTool>('failures');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Record<string, unknown> | null>(null);

    const currentTool = TOOLS.find(t => t.id === selectedTool)!;

    const handleAnalyze = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const paramName = selectedTool === 'blue-ocean' || selectedTool === 'momentum' ? 'topic' : 'niche';
            const response = await axios.get(`/api/${selectedTool}`, {
                params: { [paramName]: query }
            });
            setResult(response.data);
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔮</span>
                        <span className="font-bold text-xl">The Oracle</span>
                        <span className="text-xs text-slate-500 ml-2">5 tools that eliminate guesswork</span>
                    </div>
                    <a href="/" className="text-sm text-slate-400 hover:text-white">← Evaluator</a>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Tool Selector */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    {TOOLS.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => { setSelectedTool(tool.id); setResult(null); setQuery(''); }}
                            className={`p-4 rounded-xl border transition-all text-left ${selectedTool === tool.id
                                ? 'bg-purple-900/30 border-purple-500 ring-2 ring-purple-500/50'
                                : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                                }`}
                        >
                            <div className="text-2xl mb-2">{tool.icon}</div>
                            <div className="font-medium text-sm">{tool.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{tool.description}</div>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-8">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            placeholder={currentTool.inputPlaceholder}
                            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !query.trim()}
                            className="px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 disabled:opacity-50"
                        >
                            {loading ? 'Analyzing...' : `Run ${currentTool.name}`}
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-4 animate-pulse">🔮</div>
                        <p className="text-slate-400">The Oracle is analyzing...</p>
                    </div>
                )}

                {/* Results */}
                {result && !loading && (
                    <div className="space-y-6">
                        {/* Insight Banner */}
                        {'insight' in result && (
                            <div className="bg-gradient-to-r from-purple-900/30 to-slate-900 rounded-2xl p-6 border border-purple-500/30">
                                <div className="text-lg font-medium text-purple-300">
                                    {result.insight as string}
                                </div>
                            </div>
                        )}

                        {/* Failure Predictor Results */}
                        {selectedTool === 'failures' && 'failurePatterns' in result && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>🚫</span> Failure Patterns to Avoid
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.failurePatterns as Array<{ pattern: string; failureRate: number; advice: string; examples: string[] }>).map((pattern, i) => (
                                        <div key={i} className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-red-400">{pattern.pattern}</span>
                                                <span className="text-red-500 font-bold">{pattern.failureRate}% fail rate</span>
                                            </div>
                                            <p className="text-sm text-slate-300 mb-2">{pattern.advice}</p>
                                            {pattern.examples.length > 0 && (
                                                <div className="text-xs text-slate-500">
                                                    Example: &quot;{pattern.examples[0]?.substring(0, 50)}...&quot;
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Momentum Results */}
                        {selectedTool === 'momentum' && 'opportunities' in result && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>🔥</span> Momentum Opportunities
                                </h2>
                                <div className="space-y-3">
                                    {(result.opportunities as Array<{ topic: string; momentumScore: number; urgency: string; trendGrowth: string; recentVideosCount: number; reasoning: string }>).map((opp, i) => (
                                        <div key={i} className={`rounded-xl p-4 border ${opp.urgency.includes('Critical') ? 'bg-orange-900/20 border-orange-500/50' :
                                            opp.urgency.includes('High') ? 'bg-yellow-900/20 border-yellow-500/50' :
                                                'bg-slate-800/50 border-slate-700'
                                            }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="font-bold text-lg">{opp.topic}</span>
                                                    <span className="ml-3 text-sm text-green-400">{opp.trendGrowth}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold">{opp.momentumScore}</div>
                                                    <div className="text-xs text-slate-400">score</div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-400 mb-2">{opp.urgency}</div>
                                            <div className="text-sm text-slate-300">{opp.reasoning}</div>
                                            <div className="text-xs text-slate-500 mt-2">
                                                {opp.recentVideosCount} videos in last 7 days
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Blue Ocean Results */}
                        {selectedTool === 'blue-ocean' && 'blueOceans' in result && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>🌊</span> New Category Opportunities
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.blueOceans as Array<{ combination: string; format: string; opportunityScore: number; supplyLevel: string; existingVideos: number; reasoning: string }>).map((bo, i) => (
                                        <div key={i} className={`rounded-xl p-4 border ${bo.existingVideos === 0 ? 'bg-green-900/20 border-green-500/50' :
                                            'bg-slate-800/50 border-slate-700'
                                            }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold">{bo.combination}</span>
                                                <span className={`font-bold ${bo.opportunityScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {bo.opportunityScore}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-400 mb-2">
                                                Format: {bo.format} • {bo.supplyLevel} supply ({bo.existingVideos} videos)
                                            </div>
                                            <div className="text-sm text-slate-300">{bo.reasoning}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Competitor Gaps Results */}
                        {selectedTool === 'competitor-gaps' && 'analysis' in result && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>🎯</span> Content Gaps Found
                                </h2>
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-4">
                                    <div className="text-sm text-slate-400">Analyzing channel:</div>
                                    <div className="font-bold text-lg">{(result.analysis as { channelTitle: string; subscriberCount: number }).channelTitle}</div>
                                    <div className="text-sm text-slate-500">{formatNumber((result.analysis as { subscriberCount: number }).subscriberCount)} subscribers</div>
                                </div>
                                <div className="space-y-3">
                                    {((result.analysis as { contentGaps: Array<{ topic: string; gapScore: number; lastCoveredDaysAgo: number | null; searchDemand: number; reason: string }> }).contentGaps).map((gap, i) => (
                                        <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold">{gap.topic}</span>
                                                <span className={`font-bold ${gap.gapScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    Gap Score: {gap.gapScore}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-300">{gap.reason}</div>
                                            <div className="text-xs text-slate-500 mt-2">
                                                {gap.lastCoveredDaysAgo ? `Last covered ${gap.lastCoveredDaysAgo} days ago` : 'Never covered'}
                                                {' • '}Search demand: {gap.searchDemand}/100
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Thumbnail Results */}
                        {selectedTool === 'thumbnails' && 'patterns' in result && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span>🖼️</span> Thumbnail Patterns in This Niche
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.patterns as Array<{ pattern: string; prevalence: number; correlation: string; recommendation: string }>).map((pattern, i) => (
                                        <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold">{pattern.pattern}</span>
                                                <span className={`font-bold ${pattern.correlation === 'Strong' ? 'text-green-400' : 'text-yellow-400'
                                                    }`}>
                                                    {pattern.prevalence}%
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-300">{pattern.recommendation}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Top performers */}
                                {'topPerformers' in result && (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-bold mb-4">Top Performers</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {(result.topPerformers as Array<{ thumbnailUrl: string; title: string; views: number; keyFeatures: string[] }>).map((video, i) => (
                                                <div key={i} className="rounded-xl overflow-hidden bg-slate-800/50">
                                                    <img src={video.thumbnailUrl} alt={video.title} className="w-full aspect-video object-cover" />
                                                    <div className="p-2">
                                                        <div className="text-xs text-slate-400 line-clamp-1">{video.title}</div>
                                                        <div className="text-xs text-green-400">{formatNumber(video.views)} views</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!result && !loading && (
                    <div className="text-center py-12 text-slate-500">
                        <div className="text-6xl mb-4">{currentTool.icon}</div>
                        <p>Enter a {currentTool.inputLabel.toLowerCase()} to run the {currentTool.name}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
