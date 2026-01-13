'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Clock,
  TrendingUp,
  BarChart3,
  Sparkles,
  Target,
  AlertCircle,
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
    competition: {
      score: number;
      label: string;
      interpretation: string;
    };
    interest: {
      score: number;
      label: string;
      interpretation: string;
      dataAvailable: boolean;
    };
    learnable: {
      score: number;
      label: string;
      interpretation: string;
      outliersFound: number;
    };
  };
  verdict: {
    assessment: string;
    message: string;
  };
  confidence: {
    level: string;
    score: number;
    factors: string[];
  };
  titleSuggestions: TitleSuggestion[];
  recommendedLength: {
    bucket: string;
    avgViews: number;
    multiplier: number;
    sampleSize: number;
  };
  saturation: {
    score: number;
    label: string;
    factors: {
      competition: number;
      channelConcentration: number;
      contentAge: number;
    };
  };
  demand: {
    score: number;
    dataAvailable: boolean;
    trending: { keyword: string; growth?: string }[];
  };
  outliers: {
    count: number;
    rate: number;
    top: {
      title: string;
      views: number;
      thumbnail: string;
      id: string;
      velocity: number;
      zScore?: number;
    }[];
  };
  patterns: {
    usesNumbers: number;
    usesQuestions: number;
    usesAllCaps: number;
    avgTitleLength: number;
    basedOn: number;
    source: string;
    topWords: string[];
    saturatedPatterns: string[];
  };
  dataQuality: {
    sampleSize: number;
    outliersDetected: number;
    trendsAvailable: boolean;
    disclaimer: string;
  };
}

const regions = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleEvaluate = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.get('/api/evaluate', {
        params: { idea: q, region }
      });
      setResult(response.data);
    } catch (error) {
      console.error('Evaluation failed:', error);
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

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-neutral-900" strokeWidth={1.5} />
            <span className="font-medium text-neutral-900">Niche Finder</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/gaps" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
              Gaps
            </a>
            <a href="/oracle" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
              Oracle
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-4xl font-light text-neutral-900 tracking-tight text-center mb-4">
          Evaluate your video idea
        </h1>
        <p className="text-lg text-neutral-500 text-center mb-12 font-light">
          Research tool for content decisions. Not a prediction engine.
        </p>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 focus-within:border-neutral-400 transition-colors">
            <Search className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
              placeholder="Enter your video idea..."
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
            {loading ? 'Analyzing...' : 'Evaluate'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mb-4" />
            <p className="text-neutral-500 text-sm">Analyzing market data...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="max-w-3xl mx-auto px-6 pb-24 space-y-8">

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

          {/* Three Signals (Decomposed) */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Competition */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                <p className="text-sm text-neutral-500">Competition</p>
              </div>
              <p className={`text-3xl font-light ${getSignalColor(result.market.competition.score, true)}`}>
                {result.market.competition.score}
              </p>
              <p className="text-sm text-neutral-600 mt-1">{result.market.competition.interpretation}</p>
            </div>

            {/* Interest */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                <p className="text-sm text-neutral-500">Search Interest</p>
                {!result.market.interest.dataAvailable && (
                  <span className="text-xs text-amber-500">(estimated)</span>
                )}
              </div>
              <p className={`text-3xl font-light ${getSignalColor(result.market.interest.score)}`}>
                {result.market.interest.score}
              </p>
              <p className="text-sm text-neutral-600 mt-1">{result.market.interest.interpretation}</p>
            </div>

            {/* Learnable */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                <p className="text-sm text-neutral-500">Pattern Clarity</p>
              </div>
              <p className={`text-3xl font-light ${getSignalColor(result.market.learnable.score)}`}>
                {result.market.learnable.score}
              </p>
              <p className="text-sm text-neutral-600 mt-1">{result.market.learnable.interpretation}</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl text-sm text-neutral-500">
            <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p>{result.dataQuality.disclaimer}</p>
          </div>

          {/* Title Suggestions */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
                <h2 className="text-lg font-medium text-neutral-900">Suggested titles</h2>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {result.titleSuggestions.map((suggestion, i) => (
                <div key={i} className="p-6 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-neutral-900 font-medium mb-1">{suggestion.title}</p>
                      <p className="text-sm text-neutral-500">{suggestion.reasoning}</p>
                    </div>
                    <button
                      onClick={() => copyTitle(suggestion.title, i)}
                      className="shrink-0 p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                      ) : (
                        <Copy className="w-5 h-5" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Length */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-neutral-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm text-neutral-500 mb-1">Recommended length</p>
                <p className="text-xl font-medium text-neutral-900">{result.recommendedLength.bucket}</p>
                <p className="text-sm text-neutral-500">
                  {result.recommendedLength.multiplier}x avg views
                  <span className="text-neutral-400"> · based on {result.recommendedLength.sampleSize} videos</span>
                </p>
              </div>
            </div>
          </div>

          {/* Expand Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 py-3 text-neutral-500 hover:text-neutral-900 transition-colors text-sm"
          >
            {showDetails ? 'Hide details' : 'Show detailed analysis'}
            {showDetails ? (
              <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>

          {showDetails && (
            <div className="space-y-6">
              {/* Confidence Factors */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <p className="text-sm text-neutral-500 mb-4">Analysis confidence factors</p>
                <div className="flex flex-wrap gap-2">
                  {result.confidence.factors.map((factor, i) => (
                    <span key={i} className="px-3 py-1.5 bg-neutral-100 rounded-full text-sm text-neutral-600">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>

              {/* Top Performers */}
              {result.outliers.top.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <p className="text-sm text-neutral-500 mb-4">Top performers to study</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    {result.outliers.top.map((video, i) => (
                      <a
                        key={i}
                        href={`https://youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group"
                      >
                        <div className="aspect-video rounded-lg overflow-hidden bg-neutral-100 mb-2">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <p className="text-sm text-neutral-900 line-clamp-2 mb-1">{video.title}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>{formatNumber(video.views)} views</span>
                          <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Topics */}
              {result.demand.trending.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <p className="text-sm text-neutral-500 mb-4">Related trending topics</p>
                  <div className="flex flex-wrap gap-2">
                    {result.demand.trending.map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => { setQuery(topic.keyword); handleEvaluate(topic.keyword); }}
                        className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-full text-sm text-neutral-700 transition-colors"
                      >
                        {topic.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Quality */}
              <div className="bg-neutral-50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-neutral-700">Data quality</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-500">Sample size</p>
                    <p className="text-neutral-900">{result.dataQuality.sampleSize} videos</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Outliers detected</p>
                    <p className="text-neutral-900">{result.dataQuality.outliersDetected}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Trends data</p>
                    <p className="text-neutral-900">{result.dataQuality.trendsAvailable ? 'Available' : 'Unavailable'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Search */}
          <div className="text-center pt-4">
            <button
              onClick={() => { setResult(null); setQuery(''); }}
              className="text-neutral-500 hover:text-neutral-900 text-sm transition-colors"
            >
              Evaluate another idea
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="max-w-2xl mx-auto px-6 py-8 text-center">
          <p className="text-neutral-400 text-sm mb-6">Try these examples</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['how to make sourdough', 'productivity tips 2024', 'home gym workout'].map(example => (
              <button
                key={example}
                onClick={() => { setQuery(example); handleEvaluate(example); }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-full text-sm text-neutral-600 transition-colors"
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
