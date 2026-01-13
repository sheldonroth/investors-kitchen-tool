'use client';

import { useState } from 'react';
import axios from 'axios';

interface TitleSuggestion {
  title: string;
  reasoning: string;
}

interface EvaluationResult {
  idea: string;
  viability: {
    score: number;
    label: string;
    reasons: string[];
    verdict: string;
  };
  titleSuggestions: TitleSuggestion[];
  recommendedLength: {
    bucket: string;
    avgViews: number;
    multiplier: number;
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
    topWords: string[];
    saturatedPatterns: string[];
  };
  totalAnalyzed: number;
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          YouTube Video Idea Evaluator
        </h1>
        <p className="text-lg text-gray-500 mb-4">
          Is your idea worth making? What should you title it?
        </p>
        <a
          href="/gaps"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors mb-8"
        >
          📊 Find Content Gaps →
        </a>

        {/* Search */}
        <div className="flex gap-2 max-w-xl mx-auto">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-3 border border-gray-200 rounded-xl bg-white text-sm"
          >
            {regions.map(r => (
              <option key={r.code} value={r.code}>{r.code}</option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
            placeholder="Enter your video idea..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => handleEvaluate()}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Evaluate'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-2xl" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="max-w-3xl mx-auto px-4 pb-16 space-y-6">

          {/* Question 1: Is this idea good? */}
          <div className={`rounded-2xl p-8 ${result.viability.score >= 70 ? 'bg-green-50 border-2 border-green-200' :
            result.viability.score >= 45 ? 'bg-yellow-50 border-2 border-yellow-200' :
              'bg-red-50 border-2 border-red-200'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Idea Viability</div>
                <div className={`text-5xl font-bold ${result.viability.score >= 70 ? 'text-green-600' :
                  result.viability.score >= 45 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                  {result.viability.score}/100
                </div>
              </div>
              <div className={`text-6xl`}>
                {result.viability.score >= 70 ? '✅' : result.viability.score >= 45 ? '⚡' : '⚠️'}
              </div>
            </div>
            <div className={`text-xl font-medium ${result.viability.score >= 70 ? 'text-green-700' :
              result.viability.score >= 45 ? 'text-yellow-700' :
                'text-red-700'
              }`}>
              {result.viability.verdict}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {result.viability.reasons.map((reason, i) => (
                <span key={i} className="px-3 py-1 bg-white/70 rounded-full text-sm text-gray-700">
                  {reason}
                </span>
              ))}
            </div>
          </div>

          {/* Question 2: What should I title it? */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">✨</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Title Suggestions</h2>
                <p className="text-sm text-gray-500">AI-optimized for this specific niche</p>
              </div>
            </div>

            <div className="space-y-3">
              {result.titleSuggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="text-lg font-medium text-gray-900">{suggestion.title}</div>
                    <div className="text-sm text-gray-500 mt-1">{suggestion.reasoning}</div>
                  </div>
                  <button
                    onClick={() => copyTitle(suggestion.title, i)}
                    className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {copiedIndex === i ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Length */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">⏱️</div>
              <div>
                <div className="text-sm text-gray-500">Best Length</div>
                <div className="text-2xl font-bold text-gray-900">{result.recommendedLength.bucket}</div>
                <div className="text-sm text-gray-500">
                  {result.recommendedLength.multiplier}x more views than other lengths
                </div>
              </div>
            </div>
          </div>

          {/* Expand for details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-3 text-center text-gray-500 hover:text-gray-700 text-sm"
          >
            {showDetails ? '▲ Hide detailed analysis' : '▼ Show detailed analysis'}
          </button>

          {showDetails && (
            <div className="space-y-6">
              {/* Saturation & Demand */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="text-sm text-gray-500 mb-2">Saturation</div>
                  <div className={`text-4xl font-bold ${result.saturation.label === 'Low' ? 'text-green-600' :
                    result.saturation.label === 'Medium' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                    {result.saturation.score}/100
                  </div>
                  <div className="text-sm text-gray-500">{result.saturation.label} competition</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="text-sm text-gray-500 mb-2">Search Demand</div>
                  <div className={`text-4xl font-bold ${result.demand.score >= 60 ? 'text-green-600' :
                    result.demand.score >= 40 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                    {result.demand.score}/100
                  </div>
                  <div className="text-sm text-gray-500">Based on Google Trends</div>
                </div>
              </div>

              {/* Outliers to study */}
              {result.outliers.top.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🔥 Top Performers to Study</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {result.outliers.top.map((video, i) => (
                      <a
                        key={i}
                        href={`https://youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl overflow-hidden bg-gray-50 hover:ring-2 hover:ring-blue-400 transition-all"
                      >
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{video.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatNumber(video.views)} views • {formatNumber(video.velocity)}/day
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Topics */}
              {result.demand.trending.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Trending Related Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.demand.trending.map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => { setQuery(topic.keyword); handleEvaluate(topic.keyword); }}
                        className="px-4 py-2 bg-gray-100 hover:bg-blue-100 rounded-full text-sm text-gray-700 flex items-center gap-2"
                      >
                        {topic.keyword}
                        {topic.growth && <span className="text-green-600 font-bold">{topic.growth}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns to avoid */}
              {result.patterns.saturatedPatterns.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🚫 Saturated Patterns to Avoid</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.patterns.saturatedPatterns.map((pattern, i) => (
                      <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                        &quot;{pattern}...&quot;
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New search */}
          <div className="text-center pt-4">
            <button
              onClick={() => { setResult(null); setQuery(''); }}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Evaluate another idea
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-400">
          <p>Enter a video idea above to get started</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['how to make sourdough', 'productivity tips 2024', 'home gym workout'].map(example => (
              <button
                key={example}
                onClick={() => { setQuery(example); handleEvaluate(example); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-600"
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
