'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  Target,
  Sparkles,
  Search,
  TrendingUp,
  BarChart3,
  Shuffle,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Zap
} from 'lucide-react';

interface TitleSuggestion {
  title: string;
  reasoning: string;
}

interface EvaluationResult {
  idea: string;
  market: {
    competition: { score: number; label: string; interpretation: string };
    interest: { score: number; label: string; interpretation: string; dataAvailable: boolean };
    learnable: { score: number; label: string; interpretation: string; outliersFound: number };
  };
  verdict: { assessment: string; message: string };
  confidence: { level: string; score: number; factors: string[] };
  titleSuggestions: TitleSuggestion[];
  recommendedLength: { bucket: string; avgViews: number; multiplier: number; sampleSize: number };
  outliers: { count: number; rate: number; top: { title: string; views: number; thumbnail: string; id: string; velocity: number; zScore?: number }[] };
  dataQuality: { sampleSize: number; outliersDetected: number; trendsAvailable: boolean; disclaimer: string };
}

interface ToolCard {
  id: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  href: string;
  gradient: string;
  iconBg: string;
}

const TOOLS: ToolCard[] = [
  {
    id: 'optimize',
    icon: <Shuffle className="w-5 h-5" strokeWidth={1.5} />,
    name: 'Optimize Title',
    description: 'Generate better title variations',
    href: '/random-walk',
    gradient: 'from-violet-500/10 to-purple-500/10',
    iconBg: 'bg-violet-500/20 text-violet-400'
  },
  {
    id: 'gaps',
    icon: <BarChart3 className="w-5 h-5" strokeWidth={1.5} />,
    name: 'Find Gaps',
    description: 'Discover underserved topics',
    href: '/gaps',
    gradient: 'from-amber-500/10 to-orange-500/10',
    iconBg: 'bg-amber-500/20 text-amber-400'
  },
  {
    id: 'oracle',
    icon: <Search className="w-5 h-5" strokeWidth={1.5} />,
    name: 'Research Tools',
    description: 'Failures, trends, competitors, thumbnails',
    href: '/oracle',
    gradient: 'from-cyan-500/10 to-blue-500/10',
    iconBg: 'bg-cyan-500/20 text-cyan-400'
  },
  {
    id: 'channel',
    icon: <TrendingUp className="w-5 h-5" strokeWidth={1.5} />,
    name: 'Channel Analyzer',
    description: 'Paste any channel for tailored ideas',
    href: '/channel',
    gradient: 'from-rose-500/10 to-pink-500/10',
    iconBg: 'bg-rose-500/20 text-rose-400'
  },
];

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

export default function Home() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleEvaluate = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.get('/api/evaluate', {
        params: { idea: q, region }
      });
      setResult(response.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        const errMsg = err.response.data.error;
        if (errMsg.includes('quota')) {
          setError('quota');
        } else {
          setError(errMsg);
        }
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getSignalColor = (score: number, inverse = false) => {
    const effectiveScore = inverse ? 100 - score : score;
    if (effectiveScore >= 60) return 'text-emerald-400';
    if (effectiveScore >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getVerdictStyle = (assessment: string) => {
    if (assessment === 'Favorable') return 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30';
    if (assessment === 'Mixed') return 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30';
    return 'bg-gradient-to-br from-rose-500/20 to-rose-600/10 border-rose-500/30';
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/10 via-transparent to-transparent pointer-events-none" />

      {/* Quota Error Banner */}
      {error === 'quota' && (
        <div className="relative z-10 bg-amber-500/10 border-b border-amber-500/20">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-amber-200 font-medium">API limit reached</p>
              <p className="text-sm text-amber-200/70">
                YouTube limits requests to 10,000/day. Resets at midnight Pacific.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="font-semibold text-white tracking-tight">Niche Finder</span>
          </div>
          <p className="text-sm text-neutral-500">Research tools for creators</p>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
            <Zap className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Powered by YouTube Data + AI</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-4">
            Is your video idea<br />
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">worth making?</span>
          </h1>
          <p className="text-neutral-400 text-lg">
            Enter a topic to see competition, demand, and title suggestions
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50" />
          <div className="relative flex items-center gap-3 p-4 bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-white/10 focus-within:border-violet-500/50 transition-all shadow-2xl shadow-black/20">
            <Target className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
              placeholder="e.g., how to make sourdough"
              className="flex-1 bg-transparent text-lg text-white placeholder-neutral-500 focus:outline-none"
            />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="text-sm text-neutral-400 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {regions.map(r => (
                <option key={r.code} value={r.code} className="bg-neutral-900">{r.code}</option>
              ))}
            </select>
            <button
              onClick={() => handleEvaluate()}
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:from-violet-400 hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
            >
              {loading ? 'Checking...' : 'Evaluate'}
            </button>
          </div>
        </div>

        {/* Quick examples */}
        {!result && !loading && (
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <span className="text-neutral-600 text-sm">Try:</span>
            {['productivity tips', 'cooking basics', 'home workout'].map(example => (
              <button
                key={example}
                onClick={() => { setQuery(example); handleEvaluate(example); }}
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-2 border-neutral-800 border-t-violet-500 rounded-full animate-spin mb-4" />
            <p className="text-neutral-500 text-sm">Analyzing market data...</p>
          </div>
        </div>
      )}

      {/* Error (non-quota) */}
      {error && error !== 'quota' && (
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-start gap-3 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="relative z-10 max-w-3xl mx-auto px-6 pb-16 space-y-6">

          {/* Verdict */}
          <div className={`rounded-2xl p-6 border ${getVerdictStyle(result.verdict.assessment)}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 uppercase tracking-wide font-medium mb-1">Assessment</p>
                <p className="text-3xl font-light text-white">{result.verdict.assessment}</p>
                <p className="text-sm mt-2 text-white/70">{result.verdict.message}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">Confidence</p>
                <p className="text-2xl font-light text-white">{result.confidence.score}</p>
              </div>
            </div>
          </div>

          {/* Three Signals */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: 'Competition', score: result.market.competition.score, display: result.market.competition.label, interpretation: result.market.competition.interpretation, inverse: true },
              { name: 'Interest', score: result.market.interest.score, display: result.market.interest.label, interpretation: result.market.interest.interpretation, note: !result.market.interest.dataAvailable ? '(est.)' : '' },
              { name: 'Pattern Clarity', score: result.market.learnable.score, display: result.market.learnable.label, interpretation: result.market.learnable.interpretation }
            ].map((signal, i) => (
              <div key={i} className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
                <p className="text-sm text-neutral-500 mb-2">
                  {signal.name} {'note' in signal && signal.note && <span className="text-amber-500">{signal.note}</span>}
                </p>
                <p className={`text-2xl font-light ${getSignalColor(signal.score, 'inverse' in signal && signal.inverse)}`}>
                  {signal.display}
                </p>
                <p className="text-xs text-neutral-600 mt-1">{signal.interpretation}</p>
              </div>
            ))}
          </div>

          {/* Title Suggestions */}
          <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
              <h2 className="font-medium text-white">Title ideas</h2>
            </div>
            <div className="divide-y divide-white/5">
              {result.titleSuggestions.slice(0, 4).map((s, i) => (
                <div key={i} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white">{s.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{s.reasoning}</p>
                  </div>
                  <button onClick={() => copyTitle(s.title, i)} className="shrink-0 p-2 text-neutral-500 hover:text-white">
                    {copiedIndex === i ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Length */}
          <div className="flex items-center gap-4 p-5 bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-white font-medium">{result.recommendedLength.bucket}</p>
              <p className="text-sm text-neutral-500">{result.recommendedLength.multiplier}x avg views · {result.recommendedLength.sampleSize} samples</p>
            </div>
          </div>

          {/* Expand Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 py-3 text-neutral-500 hover:text-white transition-colors text-sm"
          >
            {showDetails ? 'Hide details' : 'Show more'}
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showDetails && result.outliers.top.length > 0 && (
            <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5">
              <p className="text-sm text-neutral-500 mb-4">Top performers to study</p>
              <div className="grid md:grid-cols-3 gap-4">
                {result.outliers.top.map((v, i) => (
                  <a key={i} href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="group">
                    <div className="aspect-video rounded-xl overflow-hidden bg-neutral-800 mb-2">
                      <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <p className="text-sm text-neutral-300 line-clamp-2 group-hover:text-white transition-colors">{v.title}</p>
                    <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1">
                      <span>{formatNumber(v.views)} views</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl text-sm text-neutral-500">
            <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p>{result.dataQuality.disclaimer}</p>
          </div>

          {/* New Search */}
          <div className="text-center pt-2">
            <button onClick={() => { setResult(null); setQuery(''); }} className="text-neutral-500 hover:text-white text-sm transition-colors">
              Evaluate another idea
            </button>
          </div>
        </div>
      )}

      {/* Other Tools (when no result) */}
      {!result && !loading && (
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
          <p className="text-sm text-neutral-600 uppercase tracking-wide text-center mb-8">More tools</p>
          <div className="grid md:grid-cols-3 gap-4">
            {TOOLS.map(tool => (
              <a
                key={tool.id}
                href={tool.href}
                className={`group block p-6 rounded-2xl bg-gradient-to-br ${tool.gradient} border border-white/5 hover:border-white/10 transition-all hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1`}
              >
                <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center mb-4`}>
                  {tool.icon}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{tool.name}</span>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-neutral-400 mt-1">{tool.description}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <p className="text-center text-sm text-neutral-600">
          All tools use YouTube API data. Results are research signals, not predictions.
        </p>
      </footer>
    </div>
  );
}
