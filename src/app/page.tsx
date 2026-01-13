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
  type: 'hot' | 'opportunity' | 'risky';
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
  lifecycle?: {
    label: string;
    description: string;
  };
}

interface LoyaltyRatio {
  avgRatio: number;
  interpretation: string;
  emoji: string;
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
  loyaltyRatio: LoyaltyRatio;
  titlePatterns: TitlePatterns;
  thumbnailAnalysis: ThumbnailAnalysis | null;
  thumbnailPrompt: string;
}

const features = [
  { icon: '🎯', title: 'Find Market Gaps', desc: 'Discover underserved video lengths with high demand' },
  { icon: '📈', title: 'Track Trends', desc: 'Real-time Google Trends data for any niche' },
  { icon: '🤖', title: 'AI Analysis', desc: 'Gemini-powered thumbnail insights' },
  { icon: '🔍', title: 'Related Niches', desc: 'YouTube autocomplete for adjacent markets' },
];

const exampleQueries = [
  'productivity tips',
  'home workout',
  'cooking for beginners',
  'personal finance',
  'morning routine',
  'study with me',
];

const regions = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('US');
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
      const res = await fetch(`/api/analyze?q=${encodeURIComponent(q)}&max=100&region=${region}`);
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
    <main className="min-h-screen bg-[#f8f9fa] relative">
      {/* Header decoration */}
      <div className="header-decoration" />

      <div className="container-professional page-wrapper relative z-10">
        {/* Hero Section */}
        {!result && !loading && (
          <>
            <div className="text-center mb-12 pt-8">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Powered by YouTube API + Google Trends + Gemini AI
              </div>
              <h1 className="text-display text-gray-900 mb-4">
                Find Your Next
                <span className="text-blue-600"> Viral Niche</span>
              </h1>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Analyze any YouTube niche to discover untapped content gaps,
                trending topics, and data-driven insights for your next video.
              </p>
            </div>

            {/* Search Box */}
            <div className="max-w-2xl mx-auto mb-16">
              <div className="card-elevated p-3 flex gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Enter a YouTube search query..."
                    className="w-full bg-transparent border-none outline-none pl-12 pr-4 py-4 text-lg"
                  />
                </div>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium border-none outline-none cursor-pointer"
                >
                  {regions.map(r => (
                    <option key={r.code} value={r.code}>{r.code}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={loading || !query.trim()}
                  className="btn-primary px-8 text-base"
                >
                  Analyze
                </button>
              </div>

              {/* Example queries */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400 mb-3">Try these examples:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {exampleQueries.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setQuery(q); handleAnalyze(q); }}
                      className="chip text-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-4 gap-6 mb-16">
              {features.map((f) => (
                <div key={f.title} className="card p-6 text-center">
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="text-title text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="card p-10 mb-16">
              <h2 className="text-headline text-gray-900 text-center mb-10">How It Works</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: '1', title: 'Enter Your Niche', desc: 'Search for any topic you want to create content about' },
                  { step: '2', title: 'Get Data Insights', desc: 'We analyze 50+ top videos, trends, and patterns' },
                  { step: '3', title: 'Find Opportunities', desc: 'Discover gaps where demand exceeds supply' },
                ].map((item) => (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                      {item.step}
                    </div>
                    <h3 className="text-title text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 text-center mb-16">
              <div>
                <div className="text-4xl font-bold text-gray-900 mb-1">50+</div>
                <div className="text-sm text-gray-500">Videos analyzed per query</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gray-900 mb-1">5</div>
                <div className="text-sm text-gray-500">Data sources combined</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gray-900 mb-1">Free</div>
                <div className="text-sm text-gray-500">No signup required</div>
              </div>
            </div>
          </>
        )}

        {/* Search bar when results are showing */}
        {(result || loading) && (
          <div className="mb-10">
            <div className="max-w-2xl mx-auto">
              <div className="card p-2 flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Enter a YouTube search query..."
                  className="input-professional flex-1 border-0 shadow-none"
                />
                <button
                  onClick={() => handleAnalyze()}
                  disabled={loading || !query.trim()}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="spinner" /> Analyzing
                    </span>
                  ) : 'Analyze'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto mb-8 alert alert-warning">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
            </div>
            <div className="skeleton h-56 rounded-xl" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="skeleton h-48 rounded-xl" />
              <div className="skeleton h-48 rounded-xl" />
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-8">
            {/* Query title */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">
                Results for &quot;<span className="text-blue-600">{result.query}</span>&quot;
              </h1>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="metric-card">
                <div className="metric-value">{result.totalVideos}</div>
                <div className="metric-label">Videos</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{formatNumber(result.overallAvgViews)}</div>
                <div className="metric-label">Avg Views</div>
              </div>
              <div className="metric-card">
                <div className={`metric-value ${result.momentum.status === 'rising' ? 'text-green-600' :
                  result.momentum.status === 'declining' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                  {result.momentum.status === 'rising' ? '↑' : result.momentum.status === 'declining' ? '↓' : '→'}
                </div>
                <div className="metric-label">{result.momentum.lifecycle?.label || result.momentum.status}</div>
              </div>
              <div className="metric-card">
                <div className={`metric-value ${result.marketHoles.filter(h => h.type !== 'risky').length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {result.marketHoles.filter(h => h.type !== 'risky').length}
                </div>
                <div className="metric-label">Opportunities</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{result.loyaltyRatio.emoji}</div>
                <div className="metric-label">Audience</div>
                <div className="text-xs text-gray-500 mt-1">{result.loyaltyRatio.avgRatio}x ratio</div>
              </div>
            </div>

            {/* Length Distribution Chart */}
            <div className="card p-8">
              <div className="section-header">
                <div className="section-icon bg-blue-100 text-blue-600">📊</div>
                <div>
                  <h2 className="text-title text-gray-900">Length Distribution</h2>
                  <p className="text-sm text-gray-500">Video count by duration category</p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-4 h-44 mb-6 mt-8">
                {result.lengthAnalysis.map((bucket, i) => {
                  const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  const isAboveAvg = bucket.avgViews >= result.overallAvgViews;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer">
                      <div className="text-sm font-medium text-gray-500 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatNumber(bucket.avgViews)} avg
                      </div>
                      <div
                        className={`w-full rounded-lg transition-all duration-500 ${isAboveAvg ? 'bg-green-500' : 'bg-gray-300'
                          } hover:opacity-80`}
                        style={{ height: `${Math.max(height, 8)}%` }}
                      />
                      <div className="mt-4 text-center">
                        <div className="text-xl font-bold text-gray-900">{bucket.count}</div>
                        <div className="text-xs text-gray-500 mt-1">{bucket.range.replace(/\s*\([^)]*\)/g, '')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 text-sm text-gray-500 border-t pt-4">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-green-500" /> Above avg views
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-gray-300" /> Below avg views
                </span>
              </div>
            </div>

            {/* Opportunities & Insights */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Market Holes */}
              <div className="card p-6">
                <div className="section-header">
                  <div className="section-icon bg-green-100 text-green-600">🎯</div>
                  <h2 className="text-title text-gray-900">Opportunities</h2>
                </div>
                {result.marketHoles.length > 0 ? (
                  <div className="space-y-3">
                    {result.marketHoles.map((hole, i) => (
                      <div key={i} className={`alert ${hole.type === 'hot' ? 'alert-warning' :
                        hole.type === 'risky' ? 'bg-gray-50 border-l-gray-400' :
                          'alert-success'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900 flex items-center gap-2">
                            <span>{hole.emoji}</span>
                            {hole.range}
                          </span>
                          <span className={`badge ${hole.type === 'hot' ? 'badge-warning' :
                            hole.type === 'risky' ? 'bg-gray-200 text-gray-600' :
                              'badge-success'
                            }`}>
                            {hole.type === 'risky' ? 'Risky' : `Score ${hole.opportunityScore}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{hole.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 py-4">No clear gaps found. Try a more specific niche.</p>
                )}
              </div>

              {/* Insights */}
              <div className="card p-6">
                <div className="section-header">
                  <div className="section-icon bg-purple-100 text-purple-600">💡</div>
                  <h2 className="text-title text-gray-900">Insights</h2>
                </div>

                {/* Trend */}
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Search Trend</div>
                  <div className={`text-2xl font-bold ${result.momentum.trendChange && result.momentum.trendChange > 0 ? 'text-green-600' :
                    result.momentum.trendChange && result.momentum.trendChange < 0 ? 'text-red-500' : 'text-gray-900'
                    }`}>
                    {result.momentum.trendChange !== null && result.momentum.trendChange !== undefined ? (
                      `${result.momentum.trendChange > 0 ? '+' : ''}${result.momentum.trendChange}%`
                    ) : result.momentum.message}
                  </div>
                  {result.momentum.source === 'google_trends' && (
                    <span className="badge badge-primary mt-2">via Google Trends</span>
                  )}
                </div>

                {/* Warning */}
                {result.optimizationWarning && (
                  <div className="alert alert-warning mb-4">
                    <div className="font-medium mb-1">⚠️ Format Saturation</div>
                    <p className="text-sm">{result.optimizationWarning.message}</p>
                  </div>
                )}

                {/* AI Insight */}
                {result.thumbnailAnalysis?.geminiInsights && (
                  <div className="alert alert-info mb-4">
                    <div className="font-medium mb-1">🤖 AI Thumbnail Analysis</div>
                    <p className="text-sm">{result.thumbnailAnalysis.geminiInsights}</p>
                  </div>
                )}

                {/* Loyalty Ratio */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Audience Loyalty</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{result.loyaltyRatio.emoji}</span>
                    <span className="font-semibold text-gray-900">{result.loyaltyRatio.avgRatio}x</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{result.loyaltyRatio.interpretation}</p>
                </div>
              </div>
            </div>

            {/* Title Patterns */}
            <div className="card p-6">
              <div className="section-header">
                <div className="section-icon bg-orange-100 text-orange-600">🎨</div>
                <div>
                  <h2 className="text-title text-gray-900">Title Patterns</h2>
                  <p className="text-sm text-gray-500">Common patterns in top-performing titles</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-8 mt-6">
                {[
                  { label: 'Numbers', value: result.titlePatterns.hasNumber, color: 'bg-blue-500' },
                  { label: 'Questions', value: result.titlePatterns.hasQuestion, color: 'bg-purple-500' },
                  { label: 'ALL CAPS', value: result.titlePatterns.allCaps, color: 'bg-orange-500' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">{label}</span>
                      <span className="font-bold text-gray-900">{value}%</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${color}`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPrompt(true)} className="btn-secondary w-full mt-8">
                🍌 Generate Thumbnail Prompt
              </button>
            </div>

            {/* Related Searches */}
            <div className="card p-6">
              <div className="section-header">
                <div className="section-icon bg-sky-100 text-sky-600">🔍</div>
                <div>
                  <h2 className="text-title text-gray-900">Related Searches</h2>
                  <p className="text-sm text-gray-500">Explore adjacent niches</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
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
            <div className="card p-6">
              <div className="section-header">
                <div className="section-icon bg-red-100 text-red-600">🎬</div>
                <h2 className="text-title text-gray-900">Top Videos ({result.totalVideos})</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto mt-4">
                {result.videos.slice(0, 12).map((video) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-card"
                  >
                    <div className="overflow-hidden">
                      <img src={video.thumbnail} alt="" className="w-full h-32 object-cover" />
                    </div>
                    <div className="p-4">
                      <p className="font-medium text-sm text-gray-900 line-clamp-2">{video.title}</p>
                      <p className="text-xs text-gray-500 mt-2">{video.channelTitle}</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-gray-500">{formatNumber(video.views)} views</span>
                        <span className="badge badge-primary text-xs">{video.lengthCategory.split(' ')[0]}</span>
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
            <div className="card-elevated p-8 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">🍌 Thumbnail Prompt</h3>
                <button onClick={() => setShowPrompt(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <pre className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 whitespace-pre-wrap mb-6 max-h-64 overflow-y-auto border">
                {result.thumbnailPrompt}
              </pre>
              <div className="flex gap-4">
                <button onClick={copyPrompt} className="btn-primary flex-1">📋 Copy Prompt</button>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1 text-center"
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
