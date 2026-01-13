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
  Info
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
  color: string;
}

const TOOLS: ToolCard[] = [
  { id: 'optimize', icon: <Shuffle className="w-5 h-5" strokeWidth={1.5} />, name: 'Optimize Title', description: 'Improve titles with MCMC random walk', href: '/random-walk', color: 'violet' },
  { id: 'gaps', icon: <BarChart3 className="w-5 h-5" strokeWidth={1.5} />, name: 'Find Gaps', description: 'Discover underserved topics', href: '/gaps', color: 'amber' },
  { id: 'oracle', icon: <Search className="w-5 h-5" strokeWidth={1.5} />, name: 'Research Tools', description: 'Failures, trends, competitors, thumbnails', href: '/oracle', color: 'blue' },
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
    if (effectiveScore >= 60) return 'text-emerald-600';
    if (effectiveScore >= 40) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getVerdictStyle = (assessment: string) => {
    if (assessment === 'Favorable') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (assessment === 'Mixed') return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-rose-50 border-rose-200 text-rose-800';
  };

  const getToolColor = (color: string) => {
    const colors: Record<string, string> = {
      violet: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
      amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
      blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Quota Error Banner */}
      {error === 'quota' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-amber-800 font-medium">API limit reached</p>
              <p className="text-sm text-amber-700">
                YouTube limits requests to 10,000/day. Resets at midnight Pacific Time (~{new Date().getHours() < 3 ? '3' : '27'} hours).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-neutral-900" strokeWidth={1.5} />
            <span className="font-medium text-neutral-900">Niche Finder</span>
          </div>
          <p className="text-sm text-neutral-400">Research tools for creators</p>
        </div>
      </header>

      {/* Main: Evaluate Feature */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-neutral-900 tracking-tight mb-3">
            Is your video idea worth making?
          </h1>
          <p className="text-neutral-500">
            Enter a topic to see competition, demand, and title suggestions
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus-within:border-neutral-400 transition-colors">
            <Target className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
              placeholder="e.g., how to make sourdough"
              className="flex-1 bg-transparent text-lg text-neutral-900 placeholder-neutral-400 focus:outline-none"
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
          </div>
          <button
            onClick={() => handleEvaluate()}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Checking...' : 'Evaluate'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mb-4" />
            <p className="text-neutral-500 text-sm">Analyzing market data...</p>
          </div>
        </div>
      )}

      {/* Error (non-quota) */}
      {error && error !== 'quota' && (
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-xl border border-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-rose-800">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6">

          {/* Verdict */}
          <div className={`rounded-2xl p-6 border ${getVerdictStyle(result.verdict.assessment)}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-70 uppercase tracking-wide font-medium mb-1">Assessment</p>
                <p className="text-2xl font-light">{result.verdict.assessment}</p>
                <p className="text-sm mt-1 opacity-80">{result.verdict.message}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-60">Confidence</p>
                <p className="text-lg">{result.confidence.score}/100</p>
              </div>
            </div>
          </div>

          {/* Three Signals */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-sm text-neutral-500 mb-2">Competition</p>
              <p className={`text-2xl font-light ${getSignalColor(result.market.competition.score, true)}`}>
                {result.market.competition.label}
              </p>
              <p className="text-xs text-neutral-500 mt-1">{result.market.competition.interpretation}</p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-sm text-neutral-500 mb-2">
                Interest {!result.market.interest.dataAvailable && <span className="text-amber-500">(est.)</span>}
              </p>
              <p className={`text-2xl font-light ${getSignalColor(result.market.interest.score)}`}>
                {result.market.interest.label}
              </p>
              <p className="text-xs text-neutral-500 mt-1">{result.market.interest.interpretation}</p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-sm text-neutral-500 mb-2">Pattern Clarity</p>
              <p className={`text-2xl font-light ${getSignalColor(result.market.learnable.score)}`}>
                {result.market.learnable.label}
              </p>
              <p className="text-xs text-neutral-500 mt-1">{result.market.learnable.interpretation}</p>
            </div>
          </div>

          {/* Title Suggestions */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
              <h2 className="font-medium text-neutral-900">Title ideas</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {result.titleSuggestions.slice(0, 4).map((s, i) => (
                <div key={i} className="p-4 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-4">
                  <div>
                    <p className="text-neutral-900">{s.title}</p>
                    <p className="text-xs text-neutral-500">{s.reasoning}</p>
                  </div>
                  <button onClick={() => copyTitle(s.title, i)} className="shrink-0 p-2 text-neutral-400 hover:text-neutral-900">
                    {copiedIndex === i ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Length */}
          <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-neutral-200">
            <Clock className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
            <div>
              <p className="text-neutral-900 font-medium">{result.recommendedLength.bucket}</p>
              <p className="text-sm text-neutral-500">{result.recommendedLength.multiplier}x avg views · {result.recommendedLength.sampleSize} samples</p>
            </div>
          </div>

          {/* Expand Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 py-3 text-neutral-500 hover:text-neutral-900 transition-colors text-sm"
          >
            {showDetails ? 'Hide details' : 'Show more'}
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showDetails && result.outliers.top.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-sm text-neutral-500 mb-4">Top performers to study</p>
              <div className="grid md:grid-cols-3 gap-4">
                {result.outliers.top.map((v, i) => (
                  <a key={i} href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="group">
                    <div className="aspect-video rounded-lg overflow-hidden bg-neutral-100 mb-2">
                      <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <p className="text-sm text-neutral-900 line-clamp-2">{v.title}</p>
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
          <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl text-sm text-neutral-500">
            <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p>{result.dataQuality.disclaimer}</p>
          </div>

          {/* New Search */}
          <div className="text-center pt-2">
            <button onClick={() => { setResult(null); setQuery(''); }} className="text-neutral-500 hover:text-neutral-900 text-sm">
              Evaluate another idea
            </button>
          </div>
        </div>
      )}

      {/* Other Tools (when no result) */}
      {!result && !loading && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-sm text-neutral-400 uppercase tracking-wide text-center mb-6">More tools</p>
          <div className="grid md:grid-cols-3 gap-4">
            {TOOLS.map(tool => (
              <a
                key={tool.id}
                href={tool.href}
                className={`block p-5 rounded-xl border transition-colors ${getToolColor(tool.color)}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {tool.icon}
                  <span className="font-medium">{tool.name}</span>
                </div>
                <p className="text-sm opacity-80">{tool.description}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
