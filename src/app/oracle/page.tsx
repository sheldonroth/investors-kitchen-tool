'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    AlertTriangle,
    Flame,
    Waves,
    Target,
    Image,
    ArrowLeft,
    ExternalLink,
    ChevronRight
} from 'lucide-react';

type OracleTool = 'failures' | 'blue-ocean' | 'competitor-gaps' | 'momentum' | 'thumbnails';

interface ToolInfo {
    id: OracleTool;
    name: string;
    icon: React.ReactNode;
    description: string;
    inputLabel: string;
    inputPlaceholder: string;
}

const TOOLS: ToolInfo[] = [
    {
        id: 'failures',
        name: 'Failure Predictor',
        icon: <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Patterns that kill videos',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., cooking tutorials'
    },
    {
        id: 'momentum',
        name: 'Momentum',
        icon: <Flame className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Topics spiking now',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., personal finance'
    },
    {
        id: 'blue-ocean',
        name: 'Blue Ocean',
        icon: <Waves className="w-5 h-5" strokeWidth={1.5} />,
        description: 'New content categories',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., home repair'
    },
    {
        id: 'competitor-gaps',
        name: 'Competitor Gaps',
        icon: <Target className="w-5 h-5" strokeWidth={1.5} />,
        description: 'What they missed',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., fitness'
    },
    {
        id: 'thumbnails',
        name: 'Thumbnails',
        icon: <Image className="w-5 h-5" strokeWidth={1.5} />,
        description: 'What visuals work',
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
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Navigation */}
            <nav className="border-b border-neutral-800">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <Search className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                        </div>
                        <span className="font-medium">Oracle</span>
                    </div>
                    <a href="/" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                        Back
                    </a>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Tool Selector */}
                <div className="grid grid-cols-5 gap-3 mb-12">
                    {TOOLS.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => { setSelectedTool(tool.id); setResult(null); setQuery(''); }}
                            className={`p-4 rounded-xl border transition-all text-left ${selectedTool === tool.id
                                    ? 'bg-neutral-900 border-neutral-700'
                                    : 'bg-transparent border-neutral-800 hover:border-neutral-700'
                                }`}
                        >
                            <div className={`mb-3 ${selectedTool === tool.id ? 'text-white' : 'text-neutral-500'}`}>
                                {tool.icon}
                            </div>
                            <p className={`text-sm font-medium ${selectedTool === tool.id ? 'text-white' : 'text-neutral-400'}`}>
                                {tool.name}
                            </p>
                            <p className="text-xs text-neutral-600 mt-1">{tool.description}</p>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="max-w-2xl mx-auto mb-12">
                    <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 focus-within:border-neutral-700 transition-colors">
                        <Search className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            placeholder={currentTool.inputPlaceholder}
                            className="flex-1 bg-transparent text-lg text-white placeholder-neutral-600 focus:outline-none"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !query.trim()}
                            className="px-5 py-2 bg-white text-neutral-900 text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Analyzing...' : 'Analyze'}
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center py-16">
                        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-neutral-500 text-sm">Processing...</p>
                    </div>
                )}

                {/* Results */}
                {result && !loading && (
                    <div className="space-y-6">
                        {/* Insight */}
                        {'insight' in result && (
                            <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                                <p className="text-neutral-300">{result.insight as string}</p>
                            </div>
                        )}

                        {/* Failure Predictor Results */}
                        {selectedTool === 'failures' && 'failurePatterns' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Patterns to avoid</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.failurePatterns as Array<{ pattern: string; failureRate: number; advice: string; examples: string[] }>).map((pattern, i) => (
                                        <div key={i} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                            <div className="flex items-start justify-between mb-3">
                                                <span className="text-white font-medium">{pattern.pattern}</span>
                                                <span className="text-rose-400 text-sm">{pattern.failureRate}% fail</span>
                                            </div>
                                            <p className="text-sm text-neutral-400">{pattern.advice}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Momentum Results */}
                        {selectedTool === 'momentum' && 'opportunities' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Momentum opportunities</p>
                                <div className="space-y-3">
                                    {(result.opportunities as Array<{ topic: string; momentumScore: number; urgency: string; trendGrowth: string; recentVideosCount: number; reasoning: string }>).map((opp, i) => (
                                        <div key={i} className={`rounded-xl p-5 border ${opp.momentumScore >= 70 ? 'bg-amber-950/30 border-amber-800/50' : 'bg-neutral-900 border-neutral-800'
                                            }`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-white font-medium">{opp.topic}</span>
                                                    <span className="ml-3 text-sm text-emerald-400">{opp.trendGrowth}</span>
                                                </div>
                                                <span className="text-2xl font-light text-white">{opp.momentumScore}</span>
                                            </div>
                                            <p className="text-sm text-neutral-400">{opp.reasoning}</p>
                                            <p className="text-xs text-neutral-600 mt-2">{opp.recentVideosCount} videos in last 7 days</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Blue Ocean Results */}
                        {selectedTool === 'blue-ocean' && 'blueOceans' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">New category opportunities</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.blueOceans as Array<{ combination: string; format: string; opportunityScore: number; supplyLevel: string; existingVideos: number; reasoning: string }>).map((bo, i) => (
                                        <div key={i} className={`rounded-xl p-5 border ${bo.existingVideos === 0 ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-neutral-900 border-neutral-800'
                                            }`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-white font-medium">{bo.combination}</span>
                                                <span className={`text-lg font-light ${bo.opportunityScore >= 70 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                                                    {bo.opportunityScore}
                                                </span>
                                            </div>
                                            <p className="text-sm text-neutral-500 mb-2">
                                                {bo.format} format · {bo.supplyLevel} supply
                                            </p>
                                            <p className="text-sm text-neutral-400">{bo.reasoning}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Competitor Gaps Results */}
                        {selectedTool === 'competitor-gaps' && 'analysis' in result && (
                            <div className="space-y-4">
                                <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 mb-6">
                                    <p className="text-sm text-neutral-500 mb-1">Analyzing</p>
                                    <p className="text-white font-medium">{(result.analysis as { channelTitle: string }).channelTitle}</p>
                                    <p className="text-sm text-neutral-500">{formatNumber((result.analysis as { subscriberCount: number }).subscriberCount)} subscribers</p>
                                </div>
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Content gaps</p>
                                <div className="space-y-3">
                                    {((result.analysis as { contentGaps: Array<{ topic: string; gapScore: number; lastCoveredDaysAgo: number | null; searchDemand: number; reason: string }> }).contentGaps).map((gap, i) => (
                                        <div key={i} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-white font-medium">{gap.topic}</span>
                                                <span className={`font-light ${gap.gapScore >= 70 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                                                    {gap.gapScore}
                                                </span>
                                            </div>
                                            <p className="text-sm text-neutral-400">{gap.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Thumbnail Results */}
                        {selectedTool === 'thumbnails' && 'patterns' in result && (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Patterns in this niche</p>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {(result.patterns as Array<{ pattern: string; prevalence: number; correlation: string; recommendation: string }>).map((pattern, i) => (
                                            <div key={i} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-white font-medium">{pattern.pattern}</span>
                                                    <span className={`text-sm ${pattern.correlation === 'Strong' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                                        {pattern.prevalence}%
                                                    </span>
                                                </div>
                                                <p className="text-sm text-neutral-400">{pattern.recommendation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {'topPerformers' in result && (
                                    <div>
                                        <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">Top performers</p>
                                        <div className="grid grid-cols-5 gap-4">
                                            {(result.topPerformers as Array<{ thumbnailUrl: string; title: string; views: number }>).map((video, i) => (
                                                <div key={i} className="group">
                                                    <div className="aspect-video rounded-lg overflow-hidden bg-neutral-800 mb-2">
                                                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                                    </div>
                                                    <p className="text-xs text-neutral-500">{formatNumber(video.views)} views</p>
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
                    <div className="text-center py-16">
                        <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                            {currentTool.icon}
                        </div>
                        <p className="text-neutral-500 text-sm">Enter a {currentTool.inputLabel.toLowerCase()} to analyze</p>
                    </div>
                )}
            </div>
        </div>
    );
}
