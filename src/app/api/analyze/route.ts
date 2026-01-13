import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return (hours * 3600) + (minutes * 60) + seconds;
}

function categorizeDuration(seconds: number): string {
    if (seconds < 60) return 'Short (<1 min)';
    if (seconds < 300) return 'Short (1-5 min)';
    if (seconds < 600) return 'Medium (5-10 min)';
    if (seconds < 1200) return 'Long (10-20 min)';
    return 'Very Long (>20 min)';
}

interface VideoData {
    id: string;
    title: string;
    channelTitle: string;
    publishedAt: string;
    views: number;
    likes: number;
    duration: string;
    durationSec: number;
    lengthCategory: string;
    thumbnail: string;
}

interface DurationBucket {
    range: string;
    count: number;
    totalViews: number;
    avgViews: number;
    videos: VideoData[];
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const maxResults = Math.min(parseInt(searchParams.get('max') || '50'), 50);

    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Search for videos
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items;
        if (!items || items.length === 0) {
            return NextResponse.json({ videos: [], analysis: null });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // 2. Get detailed statistics
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const videos: VideoData[] = statsResponse.data.items.map((item: {
            id: string;
            snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            contentDetails: { duration: string };
            statistics: { viewCount?: string; likeCount?: string };
        }) => {
            const durationSec = parseDuration(item.contentDetails.duration);
            return {
                id: item.id,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                views: parseInt(item.statistics.viewCount || '0', 10),
                likes: parseInt(item.statistics.likeCount || '0', 10),
                duration: item.contentDetails.duration,
                durationSec,
                lengthCategory: categorizeDuration(durationSec),
                thumbnail: item.snippet.thumbnails.high?.url || ''
            };
        });

        // 3. Analyze for "Holes" (market gaps) and "Lengths"
        const durationBuckets: Record<string, DurationBucket> = {};
        const categories = ['Short (<1 min)', 'Short (1-5 min)', 'Medium (5-10 min)', 'Long (10-20 min)', 'Very Long (>20 min)'];

        categories.forEach(cat => {
            durationBuckets[cat] = { range: cat, count: 0, totalViews: 0, avgViews: 0, videos: [] };
        });

        videos.forEach(video => {
            const bucket = durationBuckets[video.lengthCategory];
            bucket.count++;
            bucket.totalViews += video.views;
            bucket.videos.push(video);
        });

        // Calculate baselines
        const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
        const overallAvgViews = totalViews / videos.length;
        const avgCountPerCategory = videos.length / categories.length;

        // Calculate averages and scores for each category
        const analysis = categories.map(cat => {
            const bucket = durationBuckets[cat];
            bucket.avgViews = bucket.count > 0 ? Math.round(bucket.totalViews / bucket.count) : 0;

            // Calculate scores
            const competitionScore = bucket.count > 0 ? 1 - (bucket.count / videos.length) : 1;
            const demandScore = overallAvgViews > 0 ? bucket.avgViews / overallAvgViews : 0;
            const opportunityScore = competitionScore * demandScore;

            return {
                ...bucket,
                competitionScore: Math.round(competitionScore * 100),
                demandScore: Math.round(demandScore * 100),
                opportunityScore: Math.round(opportunityScore * 100)
            };
        });

        // Find TRUE holes using stricter criteria
        const holes = analysis
            .filter(a => {
                const isLowCompetition = a.count < avgCountPerCategory * 0.8; // 20%+ below average
                const isHighDemand = a.avgViews >= overallAvgViews; // At or above average views
                return isLowCompetition && isHighDemand && a.count > 0;
            })
            .map(a => {
                // Classify hole type
                const isVeryLowComp = a.count < avgCountPerCategory * 0.5;
                const isVeryHighDemand = a.avgViews > overallAvgViews * 1.5;

                let type: 'hot' | 'opportunity' = 'opportunity';
                let emoji = '✅';

                if (isVeryLowComp && isVeryHighDemand) {
                    type = 'hot';
                    emoji = '🔥';
                }

                return {
                    range: a.range,
                    type,
                    emoji,
                    reason: `${a.count} videos (${Math.round((a.count / videos.length) * 100)}% of results) with ${a.avgViews.toLocaleString()} avg views`,
                    opportunityScore: a.opportunityScore
                };
            })
            .sort((a, b) => b.opportunityScore - a.opportunityScore);

        // ===== FEATURE 3: Naïve Optimization Warning =====
        const maxCount = Math.max(...analysis.map(a => a.count));
        const concentrationPct = (maxCount / videos.length) * 100;
        const dominantCategory = analysis.find(a => a.count === maxCount)?.range || '';
        const lowCompCategory = analysis.filter(a => a.count > 0).sort((a, b) => a.count - b.count)[0]?.range;

        const optimizationWarning = concentrationPct > 50 ? {
            warning: true,
            concentrationPct: Math.round(concentrationPct),
            dominantCategory,
            message: `${Math.round(concentrationPct)}% of videos are ${dominantCategory}`,
            suggestion: lowCompCategory ? `Consider ${lowCompCategory} for contrarian positioning` : null
        } : null;

        // ===== FEATURE 6: Diversification Suggestions =====
        const stopWords = new Set(['the', 'and', 'for', 'how', 'what', 'this', 'that', 'with', 'you', 'your', 'from', 'are', 'was', 'will', 'can', 'all', 'has', 'have', 'been', 'were', 'they', 'their', 'which', 'would', 'there', 'could', 'about', 'into', 'just', 'than', 'then', 'them', 'these', 'when', 'where', 'while', 'best', 'most', 'more', 'make', 'like', 'get', 'new', 'top', 'video', 'videos']);
        const titleWords = videos.flatMap(v =>
            v.title.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3 && !stopWords.has(w))
        );
        const wordFreq: Record<string, number> = {};
        titleWords.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
        const diversificationKeywords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word, count]) => ({ word, count }));

        // ===== FEATURE 4: Momentum Tracker =====
        const now = new Date();
        const daysSince = (dateStr: string) => Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        const avgUploadAge = Math.round(videos.reduce((sum, v) => sum + daysSince(v.publishedAt), 0) / videos.length);
        const recentVideos = videos.filter(v => daysSince(v.publishedAt) < 30);
        const recentPct = Math.round((recentVideos.length / videos.length) * 100);

        let momentumStatus: 'rising' | 'stable' | 'declining';
        let momentumEmoji: string;
        if (recentPct > 30) {
            momentumStatus = 'rising';
            momentumEmoji = '📈';
        } else if (avgUploadAge < 180) {
            momentumStatus = 'stable';
            momentumEmoji = '➡️';
        } else {
            momentumStatus = 'declining';
            momentumEmoji = '📉';
        }

        const momentum = {
            status: momentumStatus,
            emoji: momentumEmoji,
            avgUploadAgeDays: avgUploadAge,
            recentPct,
            message: `${recentPct}% of top results uploaded in last 30 days`
        };

        // ===== FEATURE 2: Packaging Analyzer =====
        const titlePatterns = {
            hasNumber: Math.round((videos.filter(v => /\d/.test(v.title)).length / videos.length) * 100),
            hasQuestion: Math.round((videos.filter(v => /\?/.test(v.title)).length / videos.length) * 100),
            hasEmoji: Math.round((videos.filter(v => /[\u{1F300}-\u{1F9FF}]/u.test(v.title)).length / videos.length) * 100),
            allCaps: Math.round((videos.filter(v => /[A-Z]{3,}/.test(v.title)).length / videos.length) * 100),
            avgTitleLength: Math.round(videos.reduce((s, v) => s + v.title.length, 0) / videos.length)
        };

        // Generate Nano Banana thumbnail prompt
        const isShortForm = dominantCategory.includes('Short');
        const thumbnailPrompt = `Create a YouTube thumbnail for "${query}":
- Style: ${isShortForm ? 'Bold, minimal, punchy text overlay' : 'Detailed, curiosity-driven visual story'}
- Colors: High contrast, ${overallAvgViews > 100000 ? 'vibrant saturated colors' : 'clean modern pastels'}
- Composition: ${titlePatterns.hasNumber > 50 ? 'Large number as focal point (e.g., "TOP 5")' : 'Single clear subject, rule of thirds'}
- Text: ${titlePatterns.allCaps > 30 ? 'ALL CAPS hook, max 3 words' : 'Title case, short punchy phrase'}
- Person: ${query.toLowerCase().includes('tutorial') || query.toLowerCase().includes('how') ? 'Optional face with pointing gesture toward text' : 'Expressive reaction face, eyes wide open'}
- Background: Soft gradient or blurred, subject pops forward
- Mood: ${momentumStatus === 'rising' ? 'Exciting, energetic, trending vibe' : 'Trustworthy, authoritative, evergreen feel'}`;

        return NextResponse.json({
            query,
            totalVideos: videos.length,
            overallAvgViews: Math.round(overallAvgViews),
            videos,
            lengthAnalysis: analysis,
            marketHoles: holes,
            optimizationWarning,
            diversificationKeywords,
            momentum,
            titlePatterns,
            thumbnailPrompt
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `YouTube API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
