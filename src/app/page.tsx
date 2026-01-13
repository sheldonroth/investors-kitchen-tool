'use client';

import { useState } from 'react';

interface VideoData {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  views: number;
  likes: number;
  durationSec: number;
  lengthCategory: string;
  thumbnail: string;
}

interface LengthBucket {
  range: string;
  count: number;
  avgViews: number;
  videos: VideoData[];
  competitionScore: number;
  demandScore: number;
  opportunityScore: number;
}

interface MarketHole {
  range: string;
  reason: string;
  type: 'hot' | 'opportunity';
  emoji: string;
  opportunityScore: number;
}

interface OptimizationWarning {
  warning: boolean;
  concentrationPct: number;
  dominantCategory: string;
  message: string;
  suggestion: string | null;
}

interface Momentum {
  status: string;
  emoji: string;
  trendChange?: number | null;
  avgUploadAgeDays: number;
  recentPct: number;
  message: string;
  source: string;
}

interface TitlePatterns {
  hasNumber: number;
  hasQuestion: number;
  hasEmoji: number;
  allCaps: number;
  avgTitleLength: number;
}

interface ThumbnailAnalysis {
  hasFaces: boolean;
  faceCount: number;
  dominantColors: string[];
  hasText: boolean;
  detectedLabels: string[];
  geminiInsights?: string;
}

interface AnalysisResult {
  query: string;
  totalVideos: number;
  overallAvgViews: number;
  videos: VideoData[];
  lengthAnalysis: LengthBucket[];
  marketHoles: MarketHole[];
  optimizationWarning: OptimizationWarning | null;
  relatedQueries: string[];
  momentum: Momentum;
  titlePatterns: TitlePatterns;
  thumbnailAnalysis: ThumbnailAnalysis | null;
  thumbnailPrompt: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleAnalyze = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    if (searchQuery) setQuery(searchQuery);

    try {
      const res = await fetch(`/api/analyze?q=${encodeURIComponent(q)}&max=50`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to fetch analysis');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = () => {
    if (result?.thumbnailPrompt) {
      navigator.clipboard.writeText(result.thumbnailPrompt);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const maxCount = result ? Math.max(...result.lengthAnalysis.map(b => b.count)) : 1;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
            YouTube Niche Analyzer
          </h1>
          <p className="text-lg text-gray-500">
            Find content gaps and market opportunities
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-16">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="Enter a search query..."
              className="input-clean flex-1"
            />
            <button
              onClick={() => handleAnalyze()}
              disabled={loading || !query.trim()}
              className="btn-primary"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
            <div className="skeleton h-48 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card-subtle p-6 text-center">
                <div className="stat-value text-gray-900">{result.totalVideos}</div>
                <div className="stat-label">Videos</div>
              </div>
              <div className="card-subtle p-6 text-center">
                <div className="stat-value text-gray-900">{formatNumber(result.overallAvgViews)}</div>
                <div className="stat-label">Avg Views</div>
              </div>
              <div className="card-subtle p-6 text-center">
                <div className={`stat-value ${result.momentum.status === 'rising' ? 'text-green-600' :
                    result.momentum.status === 'declining' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                  {result.momentum.status === 'rising' ? '↑' : result.momentum.status === 'declining' ? '↓' : '→'}
                </div>
                <div className="stat-label capitalize">{result.momentum.status}</div>
              </div>
              <div className="card-subtle p-6 text-center">
                <div className={`stat-value ${result.marketHoles.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {result.marketHoles.length}
                </div>
                <div className="stat-label">Opportunities</div>
              </div>
            </div>

            {/* Length Distribution Chart */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Length Distribution</h2>
              <div className="flex items-end justify-between gap-4 h-40 mb-6">
                {result.lengthAnalysis.map((bucket, i) => {
                  const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  const isAboveAvg = bucket.avgViews >= result.overallAvgViews;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer">
                      <div
                        className={`w-full rounded-lg transition-all ${isAboveAvg ? 'bg-green-500' : 'bg-gray-300'
                          } hover:opacity-80`}
                        style={{ height: `${Math.max(height, 8)}%` }}
                      />
                      <div className="mt-4 text-center">
                        <div className="text-xl font-semibold text-gray-900">{bucket.count}</div>
                        <div className="text-xs text-gray-500 mt-1">{bucket.range.replace(/\s*\([^)]*\)/g, '')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-500" /> High performance
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-gray-300" /> Low performance
                </span>
              </div>
            </div>

            {/* Opportunities & Insights */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Market Holes */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Opportunities</h2>
                {result.marketHoles.length > 0 ? (
                  <div className="space-y-3">
                    {result.marketHoles.map((hole, i) => (
                      <div key={i} className={`p-4 rounded-xl ${hole.type === 'hot' ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">{hole.range}</span>
                          <span className={`badge ${hole.type === 'hot' ? 'badge-orange' : 'badge-green'}`}>
                            Score {hole.opportunityScore}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{hole.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No clear gaps found. Try a more specific niche.</p>
                )}
              </div>

              {/* Trend & Warning */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Insights</h2>

                {/* Trend */}
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">Search Trend</div>
                  <div className={`text-2xl font-semibold ${result.momentum.trendChange && result.momentum.trendChange > 0 ? 'text-green-600' :
                      result.momentum.trendChange && result.momentum.trendChange < 0 ? 'text-red-500' : 'text-gray-900'
                    }`}>
                    {result.momentum.trendChange !== null && result.momentum.trendChange !== undefined ? (
                      `${result.momentum.trendChange > 0 ? '+' : ''}${result.momentum.trendChange}%`
                    ) : result.momentum.message}
                  </div>
                  {result.momentum.source === 'google_trends' && (
                    <span className="badge badge-blue mt-2">Google Trends</span>
                  )}
                </div>

                {/* Warning */}
                {result.optimizationWarning && (
                  <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                    <div className="font-medium text-orange-700 mb-1">Format Saturation</div>
                    <p className="text-sm text-orange-600">{result.optimizationWarning.message}</p>
                  </div>
                )}

                {/* AI Insight */}
                {result.thumbnailAnalysis?.geminiInsights && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="font-medium text-blue-700 mb-1">AI Analysis</div>
                    <p className="text-sm text-blue-600">{result.thumbnailAnalysis.geminiInsights}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Title Patterns */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Title Patterns</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { label: 'Numbers', value: result.titlePatterns.hasNumber, color: 'bg-blue-500' },
                  { label: 'Questions', value: result.titlePatterns.hasQuestion, color: 'bg-purple-500' },
                  { label: 'ALL CAPS', value: result.titlePatterns.allCaps, color: 'bg-orange-500' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-gray-900">{value}%</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${color}`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPrompt(true)} className="btn-secondary w-full mt-6">
                Generate Thumbnail Prompt
              </button>
            </div>

            {/* Related Searches */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Searches</h2>
              <div className="flex flex-wrap gap-2">
                {result.relatedQueries && result.relatedQueries.length > 0 ? (
                  result.relatedQueries.map((q, i) => (
                    <button key={i} onClick={() => handleAnalyze(q)} className="chip">
                      {q}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500">No related searches found</p>
                )}
              </div>
            </div>

            {/* Videos */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Videos</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                {result.videos.slice(0, 12).map((video) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-card"
                  >
                    <img src={video.thumbnail} alt="" className="w-full h-32 object-cover" />
                    <div className="p-4">
                      <p className="font-medium text-sm text-gray-900 line-clamp-2">{video.title}</p>
                      <p className="text-xs text-gray-500 mt-2">{video.channelTitle}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">{formatNumber(video.views)} views</span>
                        <span className="badge badge-blue text-xs">{video.lengthCategory.split(' ')[0]}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {showPrompt && result && (
          <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4" onClick={() => setShowPrompt(false)}>
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Thumbnail Prompt</h3>
                <button onClick={() => setShowPrompt(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              <pre className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 whitespace-pre-wrap mb-6 max-h-64 overflow-y-auto">
                {result.thumbnailPrompt}
              </pre>
              <div className="flex gap-4">
                <button onClick={copyPrompt} className="btn-primary flex-1">Copy</button>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1 text-center"
                >
                  Open AI Studio
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
