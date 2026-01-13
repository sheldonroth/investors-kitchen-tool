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
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-bold gradient-text mb-6 tracking-tight">
            Investor&apos;s Kitchen
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Discover untapped <span className="text-purple-400 font-semibold">market opportunities</span> and
            <span className="text-pink-400 font-semibold"> content gaps</span> in any YouTube niche
          </p>
        </div>

        {/* Search Box */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="glass-card p-2 flex gap-3 glow-purple">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="Enter a YouTube search query..."
              className="input-glass flex-1 border-0 bg-transparent"
            />
            <button
              onClick={() => handleAnalyze()}
              disabled={loading || !query.trim()}
              className="btn-primary px-8"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing
                </span>
              ) : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 glass-card p-4 border-red-500/30 bg-red-500/10 text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="grid md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-8">
            {/* Hero Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-6 text-center glow-purple">
                <div className="stat-number text-purple-400">{result.totalVideos}</div>
                <div className="stat-label">Videos Analyzed</div>
              </div>
              <div className="glass-card p-6 text-center">
                <div className="stat-number text-white">{formatNumber(result.overallAvgViews)}</div>
                <div className="stat-label">Avg Views</div>
              </div>
              <div className={`glass-card p-6 text-center ${result.momentum.status === 'rising' ? 'glow-green' :
                  result.momentum.status === 'declining' ? 'border-red-500/30' : ''
                }`}>
                <div className={`stat-number ${result.momentum.status === 'rising' ? 'text-green-400' :
                    result.momentum.status === 'declining' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                  {result.momentum.emoji}
                </div>
                <div className="stat-label capitalize">{result.momentum.status}</div>
                {result.momentum.source === 'google_trends' && (
                  <div className="badge badge-blue mt-2 text-xs">Google Trends</div>
                )}
              </div>
              <div className={`glass-card p-6 text-center ${result.marketHoles.length > 0 ? 'glow-green' : ''
                }`}>
                <div className={`stat-number ${result.marketHoles.length > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                  {result.marketHoles.length}
                </div>
                <div className="stat-label">Market Holes</div>
              </div>
            </div>

            {/* Market Holes + Optimization Warning */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Market Holes */}
              <div className={`glass-card p-6 ${result.marketHoles.length > 0 ? 'border-green-500/30' : ''}`}>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🕳️</span>
                  {result.marketHoles.length > 0 ? 'Market Holes Found' : 'No Holes Detected'}
                </h2>
                {result.marketHoles.length > 0 ? (
                  <div className="space-y-3">
                    {result.marketHoles.map((hole, i) => (
                      <div key={i} className={`p-4 rounded-xl ${hole.type === 'hot' ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <span className="text-xl">{hole.emoji}</span>
                            {hole.range}
                          </span>
                          <span className="badge badge-purple">Score: {hole.opportunityScore}</span>
                        </div>
                        <p className="text-sm text-slate-400">{hole.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">This niche is well-covered across all formats. Try a sub-niche.</p>
                )}
              </div>

              {/* Optimization Warning or Trend Info */}
              <div className={`glass-card p-6 ${result.optimizationWarning ? 'border-yellow-500/30 glow-yellow' : ''
                }`}>
                {result.optimizationWarning ? (
                  <>
                    <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                      <span className="text-2xl">⚠️</span> Over-Optimization Alert
                    </h2>
                    <p className="text-slate-300 mb-2">{result.optimizationWarning.message}</p>
                    {result.optimizationWarning.suggestion && (
                      <p className="text-yellow-400/80 text-sm">💡 {result.optimizationWarning.suggestion}</p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <span className="text-2xl">📊</span> Trend Analysis
                    </h2>
                    <p className="text-slate-400 mb-3">{result.momentum.message}</p>
                    {result.momentum.trendChange !== null && result.momentum.trendChange !== undefined && (
                      <div className={`text-3xl font-bold ${result.momentum.trendChange > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {result.momentum.trendChange > 0 ? '+' : ''}{result.momentum.trendChange}%
                        <span className="text-sm font-normal text-slate-500 ml-2">over 90 days</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Length Distribution Chart */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">📊</span> Length Distribution
              </h2>
              <div className="flex items-end justify-between gap-3 h-48 mb-4">
                {result.lengthAnalysis.map((bucket, i) => {
                  const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  const isAboveAvg = bucket.avgViews >= result.overallAvgViews;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 relative ${isAboveAvg
                            ? 'bg-gradient-to-t from-green-500/30 to-green-400'
                            : 'bg-gradient-to-t from-purple-500/30 to-purple-400'
                          }`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded text-xs whitespace-nowrap">
                          {formatNumber(bucket.avgViews)} avg views
                        </div>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-2xl font-bold text-white">{bucket.count}</div>
                        <div className="text-xs text-slate-500 mt-1">{bucket.range.split(' ')[0]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-400" /> Above avg views
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-400" /> Below avg views
                </span>
              </div>
            </div>

            {/* Packaging & Related Searches */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Packaging Patterns */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎨</span> Title Patterns
                </h2>
                <div className="space-y-4">
                  {[
                    { label: 'Has Numbers', value: result.titlePatterns.hasNumber, color: 'purple' },
                    { label: 'Question Mark', value: result.titlePatterns.hasQuestion, color: 'pink' },
                    { label: 'ALL CAPS', value: result.titlePatterns.allCaps, color: 'yellow' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white font-semibold">{value}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${color === 'purple' ? 'bg-purple-500' :
                              color === 'pink' ? 'bg-pink-500' : 'bg-yellow-500'
                            }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gemini Insights */}
                {result.thumbnailAnalysis?.geminiInsights && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-300 mb-2 font-semibold">🤖 AI Thumbnail Analysis</p>
                    <p className="text-sm text-slate-300">{result.thumbnailAnalysis.geminiInsights}</p>
                  </div>
                )}

                <button
                  onClick={() => setShowPrompt(true)}
                  className="btn-primary w-full mt-4"
                >
                  🍌 Generate Thumbnail Prompt
                </button>
              </div>

              {/* Related Searches */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔄</span> Related Searches
                  <span className="badge badge-blue text-xs ml-2">YouTube Autocomplete</span>
                </h2>
                <p className="text-slate-500 text-sm mb-4">Click to explore adjacent markets</p>
                <div className="flex flex-wrap gap-2">
                  {result.relatedQueries && result.relatedQueries.length > 0 ? (
                    result.relatedQueries.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnalyze(q)}
                        className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-500/20 hover:border-blue-400 transition-all"
                      >
                        {q}
                      </button>
                    ))
                  ) : (
                    <p className="text-slate-500">No related queries found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Video Grid */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">🎬</span> Top Videos ({result.totalVideos})
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {result.videos.map((video) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-card group"
                  >
                    <div className="relative">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute bottom-2 right-2 badge badge-purple text-xs">
                        {video.lengthCategory.split(' ')[0]}
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-sm line-clamp-2 text-white group-hover:text-purple-300 transition-colors">
                        {video.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">{video.channelTitle}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatNumber(video.views)} views</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail Prompt Modal */}
        {showPrompt && result && (
          <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4" onClick={() => setShowPrompt(false)}>
            <div className="glass-card p-8 max-w-2xl w-full glow-purple" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold gradient-text flex items-center gap-2">
                  🍌 Nano Banana Prompt
                </h3>
                <button onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
              </div>
              <pre className="bg-slate-900/50 rounded-xl p-6 text-sm text-slate-300 whitespace-pre-wrap mb-6 max-h-64 overflow-y-auto border border-slate-700">
                {result.thumbnailPrompt}
              </pre>
              <div className="flex gap-4">
                <button onClick={copyPrompt} className="btn-primary flex-1">
                  📋 Copy Prompt
                </button>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold text-center transition-all text-white"
                >
                  Open AI Studio →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
