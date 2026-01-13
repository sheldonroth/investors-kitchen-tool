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
}

interface MarketHole {
  range: string;
  reason: string;
}

interface AnalysisResult {
  query: string;
  totalVideos: number;
  videos: VideoData[];
  lengthAnalysis: LengthBucket[];
  marketHoles: MarketHole[];
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <div className="space-y-8">
            {/* Market Holes */}
            {result.marketHoles.length > 0 && (
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-purple-500/30">
                <h2 className="text-2xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                  <span className="text-3xl">🕳️</span> Market Holes Detected
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.marketHoles.map((hole, i) => (
                    <div key={i} className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                      <p className="text-lg font-semibold text-purple-300">{hole.range}</p>
                      <p className="text-slate-400 text-sm">{hole.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Length Analysis */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-pink-400 mb-4 flex items-center gap-2">
                <span className="text-3xl">📊</span> Length Distribution
              </h2>
              <div className="grid md:grid-cols-5 gap-4">
                {result.lengthAnalysis.map((bucket, i) => (
                  <div key={i} className="bg-slate-700/50 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-400">{bucket.range}</p>
                    <p className="text-3xl font-bold text-white mt-2">{bucket.count}</p>
                    <p className="text-sm text-slate-500">videos</p>
                    <p className="text-xs text-pink-400 mt-2">{bucket.avgViews.toLocaleString()} avg views</p>
                  </div>
                ))}
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
      </div>
    </main>
  );
}
