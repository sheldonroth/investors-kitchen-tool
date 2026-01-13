import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface VideoData {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: number;
    views: number;
    likes: number;
    comments: number;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    isShort: boolean;
}

// Extract video ID from various URL formats
function extractVideoId(input: string): string | null {
    const trimmed = input.trim();

    // Direct video ID (11 characters)
    if (/^[\w-]{11}$/.test(trimmed)) {
        return trimmed;
    }

    // Various YouTube URL patterns
    const patterns = [
        /youtube\.com\/watch\?v=([\w-]{11})/,
        /youtube\.com\/shorts\/([\w-]{11})/,
        /youtu\.be\/([\w-]{11})/,
        /youtube\.com\/embed\/([\w-]{11})/,
        /youtube\.com\/v\/([\w-]{11})/
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) return match[1];
    }

    return null;
}

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return parseInt(match[1] || '0', 10) * 3600 +
        parseInt(match[2] || '0', 10) * 60 +
        parseInt(match[3] || '0', 10);
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

// Extract title features for pattern analysis
function extractTitleFeatures(title: string): Record<string, boolean | number> {
    return {
        hasNumber: /\d/.test(title),
        hasQuestion: /\?/.test(title),
        hasExclamation: /!/.test(title),
        hasPipe: /\|/.test(title),
        hasColon: /:/.test(title),
        hasAllCaps: /[A-Z]{3,}/.test(title),
        startsWithNumber: /^\d/.test(title),
        startsWithHow: /^how/i.test(title),
        startsWithWhy: /^why/i.test(title),
        startsWithWhat: /^what/i.test(title),
        hasListFormat: /\d+\s+(ways|tips|things|reasons|steps|mistakes)/i.test(title),
        hasBeginner: /beginner/i.test(title),
        hasUltimate: /ultimate/i.test(title),
        hasGuide: /guide/i.test(title),
        hasSecret: /secret/i.test(title),
        hasYear: /202\d/i.test(title),
        wordCount: title.split(/\s+/).length,
        charCount: title.length,
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const videoInput = searchParams.get('video');

    if (!videoInput) {
        return NextResponse.json({ error: 'Missing "video" parameter. Provide a video URL or ID.' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Extract video ID
        const videoId = extractVideoId(videoInput);
        if (!videoId) {
            return NextResponse.json({ error: 'Could not parse video URL or ID' }, { status: 400 });
        }

        // 2. Get video details
        const videoResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: videoId,
                key: YOUTUBE_API_KEY
            }
        });

        const video = videoResponse.data.items?.[0];
        if (!video) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        const duration = parseDuration(video.contentDetails.duration);
        const isShort = duration <= 60;
        const daysSince = daysSinceUpload(video.snippet.publishedAt);

        const videoData: VideoData = {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
            duration,
            views: parseInt(video.statistics.viewCount || '0', 10),
            likes: parseInt(video.statistics.likeCount || '0', 10),
            comments: parseInt(video.statistics.commentCount || '0', 10),
            publishedAt: video.snippet.publishedAt,
            channelId: video.snippet.channelId,
            channelTitle: video.snippet.channelTitle,
            isShort
        };

        // Calculate velocity
        const velocity = Math.round(videoData.views / daysSince);

        // 3. Get channel stats for context
        const channelResponse = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'statistics',
                id: videoData.channelId,
                key: YOUTUBE_API_KEY
            }
        });

        const channelStats = channelResponse.data.items?.[0]?.statistics || {};
        const channelSubs = parseInt(channelStats.subscriberCount || '0', 10);
        const viewToSubRatio = channelSubs > 0 ? Math.round((videoData.views / channelSubs) * 100) : 0;

        // 4. Search for competing videos (same topic)
        const searchQuery = videoData.title.split(/[:|—\-]/).slice(0, 2).join(' ').replace(/[^\w\s]/g, '').trim();

        const competitorResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: searchQuery,
                type: 'video',
                maxResults: 50,
                order: 'relevance',
                key: YOUTUBE_API_KEY
            }
        });

        const competitorIds = competitorResponse.data.items
            .map((item: { id: { videoId: string } }) => item.id.videoId)
            .filter((id: string) => id !== videoId)
            .join(',');

        // 5. Get competitor stats
        let competitors: { id: string; title: string; views: number; velocity: number; thumbnail?: string; zScore?: number }[] = [];
        let competitorZScore = 0;
        let competitionLevel = 'Unknown';
        let percentile = 0;

        if (competitorIds) {
            const competitorStatsResponse = await axios.get(`${BASE_URL}/videos`, {
                params: {
                    part: 'snippet,statistics',
                    id: competitorIds,
                    key: YOUTUBE_API_KEY
                }
            });

            competitors = competitorStatsResponse.data.items.map((v: {
                id: string;
                snippet: { title: string; publishedAt: string; thumbnails: { high?: { url: string }; default?: { url: string } } };
                statistics: { viewCount?: string };
            }) => {
                const compViews = parseInt(v.statistics.viewCount || '0', 10);
                const compDays = daysSinceUpload(v.snippet.publishedAt);
                return {
                    id: v.id,
                    title: v.snippet.title,
                    views: compViews,
                    velocity: compDays > 0 ? Math.round(compViews / compDays) : 0,
                    thumbnail: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url
                };
            });

            // Calculate z-score for this video vs competitors
            const allVelocities = [...competitors.map(c => c.velocity), velocity];
            const meanVelocity = calculateMean(allVelocities);
            const stdVelocity = calculateStdDev(allVelocities, meanVelocity);

            if (stdVelocity > 0) {
                competitorZScore = Math.round(((velocity - meanVelocity) / stdVelocity) * 100) / 100;

                // Add z-scores to competitors
                competitors = competitors.map(c => ({
                    ...c,
                    zScore: Math.round(((c.velocity - meanVelocity) / stdVelocity) * 100) / 100
                }));
            }

            // Calculate percentile
            const sortedVelocities = allVelocities.sort((a, b) => a - b);
            const rank = sortedVelocities.indexOf(velocity);
            percentile = Math.round(((rank + 1) / sortedVelocities.length) * 100);

            // Competition level based on total views in niche
            const totalCompetitorViews = competitors.reduce((sum, c) => sum + c.views, 0);
            const avgCompetitorViews = totalCompetitorViews / competitors.length;
            competitionLevel = avgCompetitorViews > 1000000 ? 'Very High' :
                avgCompetitorViews > 100000 ? 'High' :
                    avgCompetitorViews > 10000 ? 'Medium' : 'Low';
        }

        // 6. Analyze title patterns
        const titleFeatures = extractTitleFeatures(videoData.title);
        const titlePatterns = Object.entries(titleFeatures)
            .filter(([key, value]) => typeof value === 'boolean' && value)
            .map(([key]) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace('Has', '').replace('Starts With', 'Starts with').trim());

        // 7. Determine retroactive verdict
        let retroVerdict = {
            prediction: 'Mixed',
            message: '',
            wouldHaveRecommended: false
        };

        if (competitorZScore >= 1.5) {
            retroVerdict = {
                prediction: 'Favorable',
                message: 'This video significantly outperformed competitors. If you asked us before, we would have seen opportunity here.',
                wouldHaveRecommended: true
            };
        } else if (competitorZScore >= 0.5) {
            retroVerdict = {
                prediction: 'Favorable',
                message: 'This video performed above average for the niche. Good execution on a solid idea.',
                wouldHaveRecommended: true
            };
        } else if (competitorZScore >= -0.5) {
            retroVerdict = {
                prediction: 'Mixed',
                message: 'This video performed around average. The idea had potential, execution or timing may have affected results.',
                wouldHaveRecommended: true
            };
        } else {
            retroVerdict = {
                prediction: 'Challenging',
                message: 'This video underperformed relative to similar content. The competition level or topic saturation may have been factors.',
                wouldHaveRecommended: competitionLevel === 'Low'
            };
        }

        // 8. Generate AI insights
        let aiInsights = {
            whatWorked: [] as string[],
            whatCouldImprove: [] as string[],
            followUpIdeas: [] as string[],
            betterTitles: [] as string[]
        };

        if (GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const topCompetitors = competitors.filter(c => (c.zScore || 0) > 0.5).slice(0, 3);
                const lowCompetitors = competitors.filter(c => (c.zScore || 0) < -0.5).slice(0, 3);

                const prompt = `Analyze this YouTube video's performance and provide actionable insights.

VIDEO BEING AUDITED:
Title: "${videoData.title}"
Views: ${videoData.views.toLocaleString()}
Days since upload: ${daysSince}
Z-score: ${competitorZScore} (${competitorZScore > 0 ? 'above' : 'below'} average)
${isShort ? 'This is a Short (under 60 seconds)' : 'This is a long-form video'}

TOP PERFORMERS (same topic):
${topCompetitors.map(c => `"${c.title}" - ${c.views.toLocaleString()} views`).join('\n') || 'None found'}

UNDERPERFORMERS (same topic):
${lowCompetitors.map(c => `"${c.title}" - ${c.views.toLocaleString()} views`).join('\n') || 'None found'}

Based on comparing this video to competitors, provide:
1. What likely worked well (2-3 points)
2. What could be improved (2-3 points)  
3. Follow-up video ideas that could build on this (3 ideas)
4. Better title alternatives that might have performed better (3 titles)

Return ONLY valid JSON:
{"whatWorked":["..."],"whatCouldImprove":["..."],"followUpIdeas":["..."],"betterTitles":["..."]}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    aiInsights = JSON.parse(jsonMatch[0]);
                }
            } catch (error) {
                console.error('AI analysis failed:', error);
            }
        }

        // 9. Build final audit response
        return NextResponse.json({
            video: {
                ...videoData,
                velocity,
                daysSince,
                engagement: {
                    likeRatio: videoData.views > 0 ? Math.round((videoData.likes / videoData.views) * 10000) / 100 : 0,
                    commentRatio: videoData.views > 0 ? Math.round((videoData.comments / videoData.views) * 10000) / 100 : 0
                }
            },

            channel: {
                id: videoData.channelId,
                title: videoData.channelTitle,
                subscribers: channelSubs,
                viewToSubRatio: `${viewToSubRatio}%`
            },

            competitivePosition: {
                zScore: competitorZScore,
                percentile,
                level: competitorZScore >= 1.5 ? 'Outlier (Top Performer)' :
                    competitorZScore >= 0.5 ? 'Above Average' :
                        competitorZScore >= -0.5 ? 'Average' : 'Below Average',
                competitionLevel,
                sampleSize: competitors.length
            },

            retroVerdict,

            titleAnalysis: {
                patterns: titlePatterns,
                wordCount: titleFeatures.wordCount,
                charCount: titleFeatures.charCount,
                hasHooks: titleFeatures.hasNumber || titleFeatures.hasQuestion || titleFeatures.hasListFormat
            },

            aiInsights,

            topCompetitors: competitors
                .filter(c => (c.zScore || 0) > 0)
                .sort((a, b) => (b.zScore || 0) - (a.zScore || 0))
                .slice(0, 6)
                .map(c => ({ id: c.id, title: c.title, views: c.views, thumbnail: c.thumbnail, zScore: c.zScore })),

            methodology: {
                approach: 'Compared video velocity (views/day) against similar videos in the same topic',
                limitations: [
                    'Z-score based on velocity, not total views',
                    'Competitor sample is top 50 by relevance, not comprehensive',
                    'Cannot measure CTR, retention, or algorithm factors',
                    'Retroactive analysis - hindsight is different from prediction'
                ]
            }
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 403 && error.response.data?.error?.message?.includes('quota')) {
                return NextResponse.json({ error: 'YouTube API quota exceeded. Resets at midnight Pacific.' }, { status: 429 });
            }
            return NextResponse.json({ error: `API Error: ${error.response.status}` }, { status: error.response.status });
        }
        console.error('Video audit error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
