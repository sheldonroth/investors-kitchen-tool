'use client';

import { useState } from 'react';
import axios from 'axios';
import {
    Search,
    ArrowLeft,
    Shuffle,
    Copy,
    Check,
    TrendingUp,
    TrendingDown,
    Info,
    ChevronDown,
    ChevronRight
} from 'lucide-react';

interface TitleCandidate {
    title: string;
    score: number;
    breakdown: {
        patternMatch: number;
        saturationPenalty: number;
        lengthScore: number;
        hookBonus: number;
    };
    confidence: number;
    step: number;
}

interface TitlePattern {
    pattern: string;
    prevalence: number;
    avgZScore: number;
    sampleSize: number;
    weight: number;
}

interface WalkResult {
    input: string;
    bestTitle: TitleCandidate;
    walkPath: TitleCandidate[];
    methodology: {
        algorithm: string;
        fitnessFunction: string;
        iterations: number;
        acceptanceCriteria: string;
        limitations: string[];
    };
    patterns: {
        positive: TitlePattern[];
        negative: TitlePattern[];
    };
    statistics: {
        sampleSize: number;
        outliersAnalyzed: number;
        patternConfidence: string;
    };
}

function formatPattern(pattern: string): string {
    return pattern
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/has/i, '')
        .replace(/starts With/i, 'Starts with')
        .trim();
}

export default function RandomWalkPage() {
    const [title, setTitle] = useState('');
    const [niche, setNiche] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<WalkResult | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [showMethodology, setShowMethodology] = useState(false);

    const handleOptimize = async () => {
        if (!title.trim() || !niche.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await axios.get('/api/random-walk', {
                params: { title, niche, iterations: 30 }
            });
            setResult(response.data);
        } catch (error) {
            console.error('Optimization failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyTitle = (t: string, index: number) => {
        navigator.clipboard.writeText(t);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-neutral-400';
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            {/* Navigation */}
            <nav className="border-b border-neutral-800">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <Shuffle className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                        </div>
                        <span className="font-medium">Random Walk Optimizer</span>
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
                    Optimize your title
                </h1>
                <p className="text-neutral-500 mb-10">
                    Generates variations based on patterns from top performers
                </p>

                {/* Inputs */}
                <div className="space-y-4 max-w-xl mx-auto">
                    <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 focus-within:border-neutral-700 transition-colors">
                        <Search className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Your current title..."
                            className="flex-1 bg-transparent text-lg text-white placeholder-neutral-600 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 focus-within:border-neutral-700 transition-colors">
                        <Search className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={niche}
                            onChange={(e) => setNiche(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleOptimize()}
                            placeholder="Your niche (e.g., cooking tutorials)..."
                            className="flex-1 bg-transparent text-lg text-white placeholder-neutral-600 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleOptimize}
                        disabled={loading || !title.trim() || !niche.trim()}
                        className="w-full py-3 bg-white text-neutral-900 font-medium rounded-xl hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Optimizing...' : 'Run Random Walk'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-neutral-500 text-sm">Walking through title space...</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="max-w-4xl mx-auto px-6 pb-16 space-y-8">

                    {/* Statistics */}
                    <div className="flex items-start gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                        <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div className="text-sm text-neutral-400">
                            Analyzed <span className="text-white">{result.statistics.sampleSize}</span> videos,
                            found <span className="text-white">{result.statistics.outliersAnalyzed}</span> outliers (z &gt; 1.5).
                            Pattern confidence: <span className={
                                result.statistics.patternConfidence === 'high' ? 'text-emerald-400' :
                                    result.statistics.patternConfidence === 'medium' ? 'text-amber-400' : 'text-rose-400'
                            }>{result.statistics.patternConfidence}</span>
                        </div>
                    </div>

                    {/* Best Title */}
                    <div className="bg-emerald-950/30 rounded-xl p-6 border border-emerald-800/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Shuffle className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                            <p className="text-sm text-emerald-400 uppercase tracking-wide">Best Found</p>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xl text-white font-medium mb-2">{result.bestTitle.title}</p>
                                <p className="text-sm text-neutral-400">
                                    Found at step {result.bestTitle.step} · Confidence: {result.bestTitle.confidence}%
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`text-3xl font-light ${getScoreColor(result.bestTitle.score)}`}>
                                    {result.bestTitle.score}
                                </p>
                                <p className="text-xs text-neutral-500">score</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-emerald-800/30">
                            <div className="text-center">
                                <p className="text-emerald-400 font-medium">+{result.bestTitle.breakdown.patternMatch}</p>
                                <p className="text-xs text-neutral-500">pattern</p>
                            </div>
                            <div className="text-center">
                                <p className="text-rose-400 font-medium">-{result.bestTitle.breakdown.saturationPenalty}</p>
                                <p className="text-xs text-neutral-500">saturation</p>
                            </div>
                            <div className="text-center">
                                <p className="text-white font-medium">+{result.bestTitle.breakdown.lengthScore}</p>
                                <p className="text-xs text-neutral-500">length</p>
                            </div>
                            <div className="text-center">
                                <p className="text-amber-400 font-medium">+{result.bestTitle.breakdown.hookBonus}</p>
                                <p className="text-xs text-neutral-500">hooks</p>
                            </div>
                        </div>
                    </div>

                    {/* Original vs Best */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Original</p>
                            <p className="text-white mb-2">{result.input}</p>
                            <p className="text-sm text-neutral-500">
                                Score: {result.walkPath[0]?.score || 'N/A'}
                            </p>
                        </div>
                        <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Improvement</p>
                            <p className={`text-xl font-light ${result.bestTitle.score - (result.walkPath[0]?.score || 0) > 0 ? 'text-emerald-400' : 'text-amber-400'
                                }`}>
                                +{result.bestTitle.score - (result.walkPath[0]?.score || 0)} points
                            </p>
                        </div>
                    </div>

                    {/* Walk Path */}
                    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                        <div className="p-5 border-b border-neutral-800">
                            <p className="text-sm text-neutral-500 uppercase tracking-wide">Top alternatives explored</p>
                        </div>
                        <div className="divide-y divide-neutral-800">
                            {result.walkPath.slice(0, 6).map((candidate, i) => (
                                <div key={i} className="p-5 hover:bg-neutral-800/50 transition-colors">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-white mb-1">{candidate.title}</p>
                                            <p className="text-xs text-neutral-500">
                                                Step {candidate.step} · Pattern +{candidate.breakdown.patternMatch} · Hook +{candidate.breakdown.hookBonus}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-lg font-light ${getScoreColor(candidate.score)}`}>
                                                {candidate.score}
                                            </span>
                                            <button
                                                onClick={() => copyTitle(candidate.title, i)}
                                                className="p-2 text-neutral-500 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === i ? (
                                                    <Check className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                                ) : (
                                                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Learned Patterns */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Positive patterns</p>
                            </div>
                            <div className="space-y-2">
                                {result.patterns.positive.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-300">{formatPattern(p.pattern)}</span>
                                        <span className="text-xs text-emerald-400">{p.prevalence}% of outliers</span>
                                    </div>
                                ))}
                                {result.patterns.positive.length === 0 && (
                                    <p className="text-sm text-neutral-500">No strong positive patterns detected</p>
                                )}
                            </div>
                        </div>
                        <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingDown className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
                                <p className="text-sm text-neutral-500 uppercase tracking-wide">Avoid patterns</p>
                            </div>
                            <div className="space-y-2">
                                {result.patterns.negative.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-300">{formatPattern(p.pattern)}</span>
                                        <span className="text-xs text-rose-400">{p.prevalence}% of underperformers</span>
                                    </div>
                                ))}
                                {result.patterns.negative.length === 0 && (
                                    <p className="text-sm text-neutral-500">No strong negative patterns detected</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Methodology */}
                    <button
                        onClick={() => setShowMethodology(!showMethodology)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-neutral-500 hover:text-white transition-colors text-sm"
                    >
                        {showMethodology ? 'Hide methodology' : 'Show methodology'}
                        {showMethodology ? (
                            <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                        ) : (
                            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                        )}
                    </button>

                    {showMethodology && (
                        <div className="bg-neutral-900/50 rounded-xl p-6 space-y-4">
                            <div>
                                <p className="text-sm font-medium text-neutral-500 mb-1">Algorithm</p>
                                <p className="text-sm text-neutral-300">{result.methodology.algorithm}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-500 mb-1">Fitness function</p>
                                <p className="text-sm text-neutral-300">{result.methodology.fitnessFunction}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-500 mb-1">Acceptance criteria</p>
                                <p className="text-sm text-neutral-300">{result.methodology.acceptanceCriteria}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-500 mb-2">Limitations</p>
                                <ul className="text-sm text-neutral-400 space-y-1">
                                    {result.methodology.limitations.map((l, i) => (
                                        <li key={i}>• {l}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* New Search */}
                    <div className="text-center pt-4">
                        <button
                            onClick={() => { setResult(null); }}
                            className="text-neutral-500 hover:text-white text-sm transition-colors"
                        >
                            Optimize another title
                        </button>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!result && !loading && (
                <div className="max-w-2xl mx-auto px-6 py-8 text-center">
                    <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                        <p className="text-sm text-neutral-500 mb-4">How it works</p>
                        <ol className="text-sm text-neutral-400 text-left space-y-2">
                            <li>1. Learns positive patterns from outlier videos (z-score &gt; 1.5)</li>
                            <li>2. Learns negative patterns from underperformers (z-score &lt; -1)</li>
                            <li>3. Generates mutations of your title (numbers, hooks, reordering)</li>
                            <li>4. Uses Metropolis-Hastings random walk to explore title space</li>
                            <li>5. Returns highest-scoring alternatives with confidence metrics</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
}
