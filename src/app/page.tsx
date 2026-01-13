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
  status: 'rising' | 'stable' | 'declining';
  emoji: string;
  avgUploadAgeDays: number;
  recentPct: number;
  message: string;
}

interface TitlePatterns {
  hasNumber: number;
  hasQuestion: number;
  hasEmoji: number;
  allCaps: number;
  avgTitleLength: number;
}

interface DiversificationKeyword {
  word: string;
  count: number;
}

interface AnalysisResult {
  query: string;
  totalVideos: number;
  overallAvgViews: number;
  videos: VideoData[];
  lengthAnalysis: LengthBucket[];
  marketHoles: MarketHole[];
  optimizationWarning: OptimizationWarning | null;
  diversificationKeywords: DiversificationKeyword[];
  momentum: Momentum;
  titlePatterns: TitlePatterns;
  thumbnailPrompt: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleAnalyze = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/analyze?q=${encodeURIComponent(query)}&max=50`);
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

  const handleKeywordClick = (keyword: string) => {
    setQuery(keyword);
    setTimeout(() => handleAnalyze(), 100);
  };

  const copyPrompt = () => {
    if (result?.thumbnailPrompt) {
      navigator.clipboard.writeText(result.thumbnailPrompt);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-4">
            Investor&apos;s Kitchen
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Analyze YouTube content to find <span className="text-purple-400 font-semibold">video lengths</span> and
            <span className="text-pink-400 font-semibold"> market holes</span> for your niche.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="Enter a YouTube search query..."
              className="flex-1 px-6 py-4 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !query.trim()}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all shadow-lg shadow-purple-500/25"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Top Row: Momentum + Optimization Warning */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Momentum Tracker */}
              <div className={`rounded-2xl p-5 border ${result.momentum.status === 'rising' ? 'bg-green-900/20 border-green-500/30' :
                  result.momentum.status === 'declining' ? 'bg-red-900/20 border-red-500/30' :
                    'bg-slate-800/50 border-slate-700'
                }`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{result.momentum.emoji}</span>
                  <h2 className="text-xl font-bold text-white capitalize">{result.momentum.status} Niche</h2>
                </div>
                <p className="text-slate-400 text-sm">{result.momentum.message}</p>
                <p className="text-slate-500 text-xs mt-1">Avg upload age: {result.momentum.avgUploadAgeDays} days</p>
              </div>

              {/* Optimization Warning */}
              {result.optimizationWarning ? (
                <div className="rounded-2xl p-5 border bg-yellow-900/20 border-yellow-500/30">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">⚠️</span>
                    <h2 className="text-xl font-bold text-yellow-400">Over-Optimization Alert</h2>
                  </div>
                  <p className="text-slate-300 text-sm">{result.optimizationWarning.message}</p>
                  {result.optimizationWarning.suggestion && (
                    <p className="text-yellow-400/80 text-xs mt-2">💡 {result.optimizationWarning.suggestion}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-5 border bg-slate-800/50 border-slate-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">✅</span>
                    <h2 className="text-xl font-bold text-slate-300">Balanced Distribution</h2>
                  </div>
                  <p className="text-slate-500 text-sm">No single format dominates this niche</p>
                </div>
              )}
            </div>

            {/* Market Holes */}
            {result.marketHoles.length > 0 ? (
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-green-500/30">
                <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
                  <span className="text-3xl">🕳️</span> Market Holes Detected
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.marketHoles.map((hole, i) => (
                    <div key={i} className={`rounded-xl p-4 border ${hole.type === 'hot' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{hole.emoji}</span>
                        <p className="text-lg font-semibold text-white">{hole.range}</p>
                        <span className="ml-auto bg-white/10 px-2 py-0.5 rounded text-xs text-slate-300">
                          Score: {hole.opportunityScore}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{hole.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-slate-400 mb-2 flex items-center gap-2">
                  <span className="text-2xl">📊</span> No Market Holes Found
                </h2>
                <p className="text-slate-500 text-sm">
                  This niche appears well-covered. Try a sub-niche or different angle.
                </p>
              </div>
            )}

            {/* Length Distribution */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-pink-400 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span> Length Distribution
              </h2>
              <p className="text-slate-500 text-sm mb-4">Overall avg: {result.overallAvgViews?.toLocaleString() || 0} views</p>
              <div className="grid md:grid-cols-5 gap-4">
                {result.lengthAnalysis.map((bucket, i) => {
                  const isAboveAvg = bucket.avgViews >= (result.overallAvgViews || 0);
                  return (
                    <div key={i} className={`rounded-xl p-4 text-center border ${isAboveAvg ? 'bg-green-900/20 border-green-500/30' : 'bg-slate-700/50 border-slate-600'}`}>
                      <p className="text-sm text-slate-400">{bucket.range}</p>
                      <p className="text-3xl font-bold text-white mt-2">{bucket.count}</p>
                      <p className="text-sm text-slate-500">videos</p>
                      <p className={`text-xs mt-2 ${isAboveAvg ? 'text-green-400' : 'text-pink-400'}`}>
                        {bucket.avgViews.toLocaleString()} avg views
                      </p>
                      <div className="mt-2 text-xs text-slate-500">
                        Opp: <span className="text-purple-400">{bucket.opportunityScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Packaging Analysis + Diversification */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Title Patterns */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎨</span> Packaging Patterns
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Has Numbers</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${result.titlePatterns.hasNumber}%` }} />
                      </div>
                      <span className="text-white text-sm w-10">{result.titlePatterns.hasNumber}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Question Titles</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500" style={{ width: `${result.titlePatterns.hasQuestion}%` }} />
                      </div>
                      <span className="text-white text-sm w-10">{result.titlePatterns.hasQuestion}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">ALL CAPS hooks</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${result.titlePatterns.allCaps}%` }} />
                      </div>
                      <span className="text-white text-sm w-10">{result.titlePatterns.allCaps}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Has Emoji</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${result.titlePatterns.hasEmoji}%` }} />
                      </div>
                      <span className="text-white text-sm w-10">{result.titlePatterns.hasEmoji}%</span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">Avg title length: {result.titlePatterns.avgTitleLength} chars</p>
                </div>
                <button
                  onClick={() => setShowPrompt(true)}
                  className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm font-semibold transition-all"
                >
                  🍌 Generate Thumbnail Prompt
                </button>
              </div>

              {/* Diversification Keywords */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔄</span> Related Niches
                </h2>
                <p className="text-slate-500 text-sm mb-3">Click to explore adjacent markets</p>
                <div className="flex flex-wrap gap-2">
                  {result.diversificationKeywords.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => handleKeywordClick(kw.word)}
                      className="px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-500/30 transition-all"
                    >
                      {kw.word} <span className="text-blue-500/60">({kw.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video List */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-slate-300 mb-4">
                Videos Found ({result.totalVideos})
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                {result.videos.map((video) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-700/50 rounded-xl overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all group"
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-32 object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="p-3">
                      <p className="font-semibold text-sm line-clamp-2 text-white">{video.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{video.channelTitle}</p>
                      <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                        <span>{video.views.toLocaleString()} views</span>
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                          {video.lengthCategory}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail Prompt Modal */}
        {showPrompt && result && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPrompt(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-purple-500/30" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                  <span>🍌</span> Nano Banana Prompt
                </h3>
                <button onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <pre className="bg-slate-900 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap mb-4 max-h-64 overflow-y-auto">
                {result.thumbnailPrompt}
              </pre>
              <div className="flex gap-3">
                <button
                  onClick={copyPrompt}
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 font-semibold transition-all"
                >
                  📋 Copy Prompt
                </button>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold text-center transition-all"
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
