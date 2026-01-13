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
    Info
} from 'lucide-react';

type OracleTool = 'failures' | 'blue-ocean' | 'competitor-gaps' | 'momentum' | 'thumbnails';

interface ToolInfo {
    id: OracleTool;
    name: string;
    icon: React.ReactNode;
    description: string;
    whatItDoes: string;
    whenToUse: string;
    inputLabel: string;
    inputPlaceholder: string;
}

const TOOLS: ToolInfo[] = [
    {
        id: 'failures',
        name: 'Pattern Analysis',
        icon: <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Title patterns correlated with underperformance',
        whatItDoes: 'Analyzes videos that underperformed relative to channel size. Identifies common title patterns (words, length, format) that appear more often in failed videos.',
        whenToUse: 'Before finalizing your title. Helps you avoid patterns that are statistically associated with low view ratios in your niche.',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., cooking tutorials'
    },
    {
        id: 'momentum',
        name: 'Momentum',
        icon: <Flame className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Recent trend signals (3-7 day lag)',
        whatItDoes: 'Checks Google Trends for rising topics in your area. Shows which subtopics are gaining search interest and how many videos were published recently.',
        whenToUse: 'When looking for trending topics to cover. Note: Trend data has a 3-7 day lag, so hot topics may already have competition.',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., personal finance'
    },
    {
        id: 'blue-ocean',
        name: 'Low Competition',
        icon: <Waves className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Format × topic experiments',
        whatItDoes: 'Generates combinations of formats (tutorial, vlog, comparison, etc.) with your topic. Checks how many videos exist for each combination and estimates risk level.',
        whenToUse: 'When brainstorming video formats. Low competition might mean opportunity OR no demand—use with caution.',
        inputLabel: 'Topic',
        inputPlaceholder: 'e.g., home repair'
    },
    {
        id: 'competitor-gaps',
        name: 'Competitor Gaps',
        icon: <Target className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Content gaps in competitor channels',
        whatItDoes: 'Analyzes a top channel in your niche. Identifies topics they haven\'t covered recently that have search demand.',
        whenToUse: 'When studying what successful channels are missing. Good for finding differentiation opportunities.',
        inputLabel: 'Niche',
        inputPlaceholder: 'e.g., fitness'
    },
    {
        id: 'thumbnails',
        name: 'Thumbnail Conventions',
        icon: <Image className="w-5 h-5" strokeWidth={1.5} />,
        description: 'Visual patterns by video type',
        whatItDoes: 'Analyzes thumbnails from top performers in your niche. Identifies common patterns (faces, text, colors, composition) separately for Shorts (< 60s) and Long-form videos.',
        whenToUse: 'Before designing your thumbnail. Shows what\'s common in your niche—not what "works" (we can\'t measure CTR).',
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

    const getRiskColor = (risk: string) => {
        if (risk === 'low') return 'text-emerald-400';
        if (risk === 'medium') return 'text-amber-400';
        return 'text-rose-400';
    };

    const getLevelColor = (level: string) => {
        if (level === 'strong') return 'text-emerald-400 bg-emerald-950/30 border-emerald-800/50';
        if (level === 'moderate') return 'text-amber-400 bg-amber-950/30 border-amber-800/50';
        return 'text-neutral-400 bg-neutral-900 border-neutral-800';
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
                        <span className="font-medium">Research Tools</span>
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

                {/* Tool Explanation */}
                <div className="max-w-2xl mx-auto mb-8 p-5 bg-neutral-900 rounded-xl border border-neutral-800">
                    <p className="text-sm text-neutral-500 uppercase tracking-wide mb-2">What it does</p>
                    <p className="text-neutral-300 mb-4">{currentTool.whatItDoes}</p>
                    <p className="text-sm text-neutral-500 uppercase tracking-wide mb-2">When to use</p>
                    <p className="text-neutral-400 text-sm">{currentTool.whenToUse}</p>
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
                        {/* Methodology Disclosure */}
                        {'methodology' in result && (
                            <div className="flex items-start gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                                <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                                <div className="text-sm text-neutral-400">
                                    {String((result.methodology as Record<string, unknown>).disclaimer ||
                                        (result.methodology as Record<string, unknown>).interpretation ||
                                        'Based on available public data. Patterns observed, not proven.')}
                                </div>
                            </div>
                        )}

                        {/* Insight */}
                        {'insight' in result && (
                            <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                                <p className="text-neutral-300">{result.insight as string}</p>
                            </div>
                        )}

                        {/* Failure Predictor Results */}
                        {selectedTool === 'failures' && 'failurePatterns' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Patterns correlated with underperformance</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.failurePatterns as Array<{ pattern: string; correlationRate: number; confidence: string; occurrences: number; advice: string }>).map((pattern, i) => (
                                        <div key={i} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                            <div className="flex items-start justify-between mb-3">
                                                <span className="text-white font-medium">{pattern.pattern}</span>
                                                <div className="text-right">
                                                    <span className="text-rose-400 text-sm">{pattern.correlationRate}% correlated</span>
                                                    <p className="text-xs text-neutral-600">{pattern.confidence} confidence</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-neutral-400">{pattern.advice}</p>
                                            <p className="text-xs text-neutral-600 mt-2">Based on {pattern.occurrences} videos</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Momentum Results */}
                        {selectedTool === 'momentum' && 'opportunities' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Trend signals (3-7 day data lag)</p>
                                <div className="space-y-3">
                                    {(result.opportunities as Array<{ topic: string; opportunityLevel: string; trendSignal: string; recentVideosCount: number; reasoning: string; dataAge: string }>).map((opp, i) => (
                                        <div key={i} className={`rounded-xl p-5 border ${getLevelColor(opp.opportunityLevel)}`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-white font-medium">{opp.topic}</span>
                                                    <span className="ml-3 text-sm text-emerald-400">{opp.trendSignal}</span>
                                                </div>
                                                <span className="text-sm capitalize">{opp.opportunityLevel}</span>
                                            </div>
                                            <p className="text-sm text-neutral-400">{opp.reasoning}</p>
                                            <p className="text-xs text-neutral-600 mt-2">{opp.recentVideosCount} videos in last 7 days · {opp.dataAge}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Blue Ocean Results */}
                        {selectedTool === 'blue-ocean' && 'combinations' in result && (
                            <div className="space-y-4">
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Low-competition experiments (by risk level)</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {(result.combinations as Array<{ combination: string; format: string; riskLevel: string; existingVideos: number; baseDemand: number; reasoning: string }>).map((combo, i) => (
                                        <div key={i} className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-white font-medium">{combo.combination}</span>
                                                <span className={`text-sm ${getRiskColor(combo.riskLevel)}`}>
                                                    {combo.riskLevel} risk
                                                </span>
                                            </div>
                                            <p className="text-sm text-neutral-400">{combo.reasoning}</p>
                                            <p className="text-xs text-neutral-600 mt-2">
                                                {combo.existingVideos} existing videos · Base demand: {combo.baseDemand}/100
                                            </p>
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
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Potential content gaps</p>
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

                        {/* Thumbnail Results - Now separated by format */}
                        {selectedTool === 'thumbnails' && 'shorts' in result && (
                            <div className="space-y-8">
                                {/* Video Types Found */}
                                {'videoTypesFound' in result && (
                                    <div className="flex gap-6 justify-center text-center">
                                        <div>
                                            <p className="text-2xl font-light text-white">
                                                {(result.videoTypesFound as { shorts: number }).shorts}
                                            </p>
                                            <p className="text-xs text-neutral-500">Shorts found</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-light text-white">
                                                {(result.videoTypesFound as { longForm: number }).longForm}
                                            </p>
                                            <p className="text-xs text-neutral-500">Long-form found</p>
                                        </div>
                                    </div>
                                )}

                                {/* Shorts Conventions */}
                                {(() => {
                                    const shortsData = result.shorts as { format: string; videosAnalyzed: number; conventions: Array<{ convention: string; prevalence: number; confidence: string; observation: string }>; topPerformers: Array<{ title: string; views: number; thumbnailUrl: string }>; note?: string };
                                    return (
                                        <div className="bg-violet-950/20 rounded-xl p-6 border border-violet-800/30">
                                            <p className="text-violet-400 text-sm uppercase tracking-wide mb-4">
                                                Shorts conventions ({shortsData.videosAnalyzed} analyzed)
                                            </p>
                                            {shortsData.note ? (
                                                <p className="text-neutral-400 text-sm">{shortsData.note}</p>
                                            ) : (
                                                <>
                                                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                                                        {shortsData.conventions.map((conv, i) => (
                                                            <div key={i} className="bg-neutral-900/50 rounded-lg p-4">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-white text-sm">{conv.convention}</span>
                                                                    <span className="text-violet-400 text-sm">{conv.prevalence}%</span>
                                                                </div>
                                                                <p className="text-xs text-neutral-500">{conv.observation}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {shortsData.topPerformers.length > 0 && (
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {shortsData.topPerformers.map((v, i) => (
                                                                <div key={i} className="aspect-video rounded overflow-hidden bg-neutral-800">
                                                                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Long-form Conventions */}
                                {(() => {
                                    const longFormData = result.longForm as { format: string; videosAnalyzed: number; conventions: Array<{ convention: string; prevalence: number; confidence: string; observation: string }>; topPerformers: Array<{ title: string; views: number; thumbnailUrl: string }>; note?: string };
                                    return (
                                        <div className="bg-emerald-950/20 rounded-xl p-6 border border-emerald-800/30">
                                            <p className="text-emerald-400 text-sm uppercase tracking-wide mb-4">
                                                Long-form conventions ({longFormData.videosAnalyzed} analyzed)
                                            </p>
                                            {longFormData.note ? (
                                                <p className="text-neutral-400 text-sm">{longFormData.note}</p>
                                            ) : (
                                                <>
                                                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                                                        {longFormData.conventions.map((conv, i) => (
                                                            <div key={i} className="bg-neutral-900/50 rounded-lg p-4">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-white text-sm">{conv.convention}</span>
                                                                    <span className="text-emerald-400 text-sm">{conv.prevalence}%</span>
                                                                </div>
                                                                <p className="text-xs text-neutral-500">{conv.observation}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {longFormData.topPerformers.length > 0 && (
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {longFormData.topPerformers.map((v, i) => (
                                                                <div key={i} className="aspect-video rounded overflow-hidden bg-neutral-800">
                                                                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}
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
