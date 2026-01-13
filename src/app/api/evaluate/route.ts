import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
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
    if (seconds < 60) return 'Shorts (<1 min)';
    if (seconds < 300) return 'Short (1-5 min)';
    if (seconds < 600) return 'Medium (5-10 min)';
    if (seconds < 1200) return 'Long (10-20 min)';
    return 'Very Long (>20 min)';
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    const diffMs = now.getTime() - uploadDate.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

interface VideoData {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    views: number;
    thumbnail: string;
    durationSec: number;
    lengthCategory: string;
    velocity: number;
    zScore?: number;
    isOutlier?: boolean;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idea = searchParams.get('idea');
    const regionCode = searchParams.get('region') || 'US';

    if (!idea) {
        return NextResponse.json({ error: 'Missing "idea" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // ===== 1. FETCH DATA =====
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: idea,
                type: 'video',
                maxResults: 50,
                regionCode,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length === 0) {
            return NextResponse.json({ error: 'No videos found for this idea' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // Parse videos with velocity
        const rawVideos: VideoData[] = statsResponse.data.items.map((item: {
            id: string;
            snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            contentDetails: { duration: string };
            statistics: { viewCount?: string };
        }) => {
            const durationSec = parseDuration(item.contentDetails.duration);
            const views = parseInt(item.statistics.viewCount || '0', 10);
            const days = daysSinceUpload(item.snippet.publishedAt);
            return {
                id: item.id,
                title: item.snippet.title,
                channelId: item.snippet.channelId,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                views,
                thumbnail: item.snippet.thumbnails.high?.url || '',
                durationSec,
                lengthCategory: categorizeDuration(durationSec),
                velocity: Math.round(views / days)
            };
        });

        // Calculate z-scores for outlier detection
        const velocities = rawVideos.map(v => v.velocity);
        const velocityMean = calculateMean(velocities);
        const velocityStdDev = calculateStdDev(velocities, velocityMean);

        const videos: VideoData[] = rawVideos.map(v => {
            const zScore = velocityStdDev > 0 ? (v.velocity - velocityMean) / velocityStdDev : 0;
            return {
                ...v,
                zScore: Math.round(zScore * 100) / 100,
                isOutlier: zScore > 2
            };
        });

        const outliers = videos.filter(v => v.isOutlier);
        const topOutliers = [...videos].sort((a, b) => (b.zScore || 0) - (a.zScore || 0)).slice(0, 5);
        const overallAvg = videos.reduce((sum, v) => sum + v.views, 0) / videos.length;

        // ===== 2. CALCULATE SATURATION =====
        const uniqueChannels = new Set(videos.map(v => v.channelId)).size;
        const channelConcentration = 1 - (uniqueChannels / videos.length);
        const avgDaysOld = videos.reduce((sum, v) => {
            return sum + daysSinceUpload(v.publishedAt);
        }, 0) / videos.length;
        const ageFactor = Math.min(avgDaysOld / 365, 1);
        const competitionFactor = Math.min(videos.length / 50, 1);
        const saturationRaw = (competitionFactor * 0.4) + (channelConcentration * 0.3) + (ageFactor * 0.3);
        const saturationScore = Math.round(saturationRaw * 100);
        const saturationLabel = saturationScore <= 30 ? 'Low' : saturationScore <= 60 ? 'Medium' : 'High';

        // ===== 3. CALCULATE DEMAND (from Google Trends) =====
        let demandScore = 50; // Default
        let trendingTopics: { keyword: string; growth?: string }[] = [];

        try {
            const interestData = await googleTrends.interestOverTime({ keyword: idea, geo: regionCode });
            const parsed = JSON.parse(interestData);
            const timelineData = parsed?.default?.timelineData || [];
            if (timelineData.length >= 2) {
                const recent = timelineData.slice(-4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                const older = timelineData.slice(0, 4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                demandScore = older > 0 ? Math.round((recent / older) * 50) : 50;
                demandScore = Math.min(100, Math.max(0, demandScore));
            }

            const relatedQueries = await googleTrends.relatedQueries({ keyword: idea, geo: regionCode });
            const relatedData = JSON.parse(relatedQueries);
            const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];
            trendingTopics = rising.slice(0, 5).map((item: { query: string; formattedValue: string }) => ({
                keyword: item.query,
                growth: item.formattedValue
            }));
        } catch {
            // Trends API may fail, continue with defaults
        }

        // ===== 4. CALCULATE IDEA VIABILITY SCORE =====
        // Formula: (100 - saturation) * 0.4 + demand * 0.3 + outlierClarity * 0.3
        const outlierClarity = outliers.length >= 3 ? 80 : outliers.length >= 1 ? 50 : 30;
        const viabilityRaw = ((100 - saturationScore) * 0.4) + (demandScore * 0.3) + (outlierClarity * 0.3);
        const viabilityScore = Math.round(Math.min(100, Math.max(0, viabilityRaw)));

        const viabilityLabel = viabilityScore >= 70 ? 'Strong' : viabilityScore >= 45 ? 'Moderate' : 'Weak';
        const viabilityReasons: string[] = [];

        if (saturationScore <= 30) viabilityReasons.push('Low competition');
        else if (saturationScore >= 60) viabilityReasons.push('Crowded market');

        if (demandScore >= 60) viabilityReasons.push('Rising search interest');
        else if (demandScore <= 30) viabilityReasons.push('Low search demand');

        if (outliers.length >= 3) viabilityReasons.push('Clear outlier patterns to learn from');
        else if (outliers.length === 0) viabilityReasons.push('No clear winners to study');

        // ===== 5. FIND BEST LENGTH =====
        const lengthStats: Record<string, { count: number; totalViews: number }> = {};
        videos.forEach(v => {
            if (!lengthStats[v.lengthCategory]) {
                lengthStats[v.lengthCategory] = { count: 0, totalViews: 0 };
            }
            lengthStats[v.lengthCategory].count++;
            lengthStats[v.lengthCategory].totalViews += v.views;
        });

        let bestLength = { bucket: 'Medium (5-10 min)', avgViews: overallAvg, multiplier: 1 };
        Object.entries(lengthStats).forEach(([bucket, stats]) => {
            if (stats.count >= 3) {
                const avgViews = stats.totalViews / stats.count;
                const multiplier = avgViews / overallAvg;
                if (multiplier > bestLength.multiplier) {
                    bestLength = { bucket, avgViews: Math.round(avgViews), multiplier: Math.round(multiplier * 10) / 10 };
                }
            }
        });

        // ===== 6. ANALYZE TITLE PATTERNS =====
        const analysisVideos = topOutliers.length >= 3 ? topOutliers : videos.slice(0, 10);
        const patternInsights = {
            usesNumbers: Math.round((analysisVideos.filter(v => /\d/.test(v.title)).length / analysisVideos.length) * 100),
            usesQuestions: Math.round((analysisVideos.filter(v => /\?/.test(v.title)).length / analysisVideos.length) * 100),
            usesAllCaps: Math.round((analysisVideos.filter(v => /[A-Z]{3,}/.test(v.title)).length / analysisVideos.length) * 100),
            avgTitleLength: Math.round(analysisVideos.reduce((s, v) => s + v.title.length, 0) / analysisVideos.length)
        };

        // Find top words
        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'this', 'that', 'i', 'you', 'my', 'your', 'how', 'what', 'why']);
        analysisVideos.forEach(v => {
            v.title.toLowerCase().split(/\s+/).forEach(word => {
                const clean = word.replace(/[^a-z]/g, '');
                if (clean.length > 2 && !stopWords.has(clean)) {
                    wordCounts[clean] = (wordCounts[clean] || 0) + 1;
                }
            });
        });
        const topWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word]) => word);

        // Find saturated patterns
        const saturatedPatterns: string[] = [];
        const titleStarts: Record<string, number> = {};
        videos.forEach(v => {
            const start = v.title.split(' ').slice(0, 3).join(' ').toLowerCase();
            titleStarts[start] = (titleStarts[start] || 0) + 1;
        });
        Object.entries(titleStarts)
            .filter(([_, count]) => count >= 3)
            .forEach(([pattern]) => saturatedPatterns.push(pattern));

        // ===== 7. GENERATE TITLE SUGGESTIONS =====
        let titleSuggestions: { title: string; reasoning: string }[] = [];

        if (GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const outlierInfo = topOutliers.length >= 3
                    ? `OUTLIER TITLES:\n${topOutliers.map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views)`).join('\n')}`
                    : `TOP PERFORMERS:\n${videos.slice(0, 5).map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views)`).join('\n')}`;

                const prompt = `You are a YouTube title strategist.

VIDEO IDEA: "${idea}"

${outlierInfo}

SATURATION: ${saturationScore}/100 (${saturationLabel})
${saturationScore > 60 ? 'HIGH SATURATION: Focus on specific sub-niches or contrarian angles.' : saturationScore > 30 ? 'MEDIUM: Differentiation needed.' : 'LOW: Standard approaches work.'}

SATURATED PATTERNS TO AVOID:
${saturatedPatterns.length > 0 ? saturatedPatterns.slice(0, 5).map(p => `- "${p}..."`).join('\n') : '- None'}

PATTERNS FROM WINNERS:
- ${patternInsights.usesNumbers}% use numbers
- ${patternInsights.usesQuestions}% are questions  
- Power words: ${topWords.slice(0, 5).join(', ')}

Generate 5 title variations (40-60 chars each) that:
1. AVOID saturated patterns
2. USE winner patterns/structure
3. Each takes a UNIQUE angle

Return ONLY JSON: {"titles":[{"title":"...","reasoning":"..."}]}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    titleSuggestions = parsed.titles || [];
                }
            } catch (error) {
                console.error('Gemini failed:', error);
            }
        }

        // Fallback titles
        if (titleSuggestions.length === 0) {
            titleSuggestions = [
                { title: `${idea} - Complete Guide`, reasoning: 'Classic format' },
                { title: `5 ${idea} Tips You Need`, reasoning: 'Listicle with number' },
                { title: `${idea} for Beginners`, reasoning: 'Beginner-friendly' }
            ];
        }

        // ===== 8. BUILD RESPONSE =====
        return NextResponse.json({
            idea,

            // Core answers
            viability: {
                score: viabilityScore,
                label: viabilityLabel,
                reasons: viabilityReasons,
                verdict: viabilityScore >= 70
                    ? '✅ This is a strong video idea'
                    : viabilityScore >= 45
                        ? '⚡ Viable with the right angle'
                        : '⚠️ Challenging niche - consider pivoting'
            },

            titleSuggestions,

            recommendedLength: bestLength,

            // Supporting data (expandable)
            saturation: {
                score: saturationScore,
                label: saturationLabel,
                factors: {
                    competition: Math.round(competitionFactor * 100),
                    channelConcentration: Math.round(channelConcentration * 100),
                    contentAge: Math.round(ageFactor * 100)
                }
            },

            demand: {
                score: demandScore,
                trending: trendingTopics
            },

            outliers: {
                count: outliers.length,
                rate: Math.round((outliers.length / videos.length) * 100),
                top: topOutliers.slice(0, 3).map(v => ({
                    title: v.title,
                    views: v.views,
                    thumbnail: v.thumbnail,
                    id: v.id,
                    velocity: v.velocity,
                    zScore: v.zScore
                }))
            },

            patterns: {
                ...patternInsights,
                topWords,
                saturatedPatterns: saturatedPatterns.slice(0, 5)
            },

            totalAnalyzed: videos.length
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
