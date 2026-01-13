import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { logMean, logStdDev, nicheNormalizedVelocity, logTransform, expTransform } from '@/lib/stats';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface VideoMetrics {
    views: number;
    publishedAt: string;
    velocity: number;
}

interface ChannelGrowth {
    channelId: string;
    channelTitle: string;
    thumbnail: string;
    subscribers: number;
    videoCount: number;
    recentVideos: VideoMetrics[];
    metrics: {
        avgVelocity: number;
        velocityTrend: number; // Positive = accelerating, Negative = decelerating
        consistencyScore: number;
        breakoutPotential: number;
    };
    prediction: {
        outlook: 'High Potential' | 'Moderate' | 'Steady' | 'Declining';
        reasoning: string;
        confidence: 'low' | 'medium' | 'high';
    };
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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');

    if (!niche) {
        return NextResponse.json({ error: 'Missing "niche" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Search for videos in the niche and get baseline stats
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: niche,
                type: 'video',
                maxResults: 50,
                order: 'date',
                publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                key: YOUTUBE_API_KEY
            }
        });

        const videoIds = searchResponse.data.items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // Get stats for baseline calculation
        const baselineResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // Calculate niche baseline velocities
        const nicheVelocities: number[] = baselineResponse.data.items.map((v: { snippet: { publishedAt: string }, statistics: { viewCount?: string } }) => {
            const views = parseInt(v.statistics.viewCount || '0', 10);
            const days = daysSinceUpload(v.snippet.publishedAt);
            return days > 0 ? views / days : 0;
        }).filter((v: number) => v > 0);

        // 2. Extract unique channels from baseline videos
        const channelMap = new Map<string, { id: string; title: string }>();
        baselineResponse.data.items.forEach((item: { snippet: { channelId: string; channelTitle: string } }) => {
            if (!channelMap.has(item.snippet.channelId)) {
                channelMap.set(item.snippet.channelId, {
                    id: item.snippet.channelId,
                    title: item.snippet.channelTitle
                });
            }
        });

        const channels = Array.from(channelMap.values()).slice(0, 15);

        // 3. Get channel details and recent videos for each
        const channelGrowthData: ChannelGrowth[] = [];

        for (const channel of channels) {
            try {
                // Get channel info
                const channelResponse = await axios.get(`${BASE_URL}/channels`, {
                    params: {
                        part: 'snippet,statistics,contentDetails',
                        id: channel.id,
                        key: YOUTUBE_API_KEY
                    }
                });

                const channelData = channelResponse.data.items?.[0];
                if (!channelData) continue;

                const subscribers = parseInt(channelData.statistics.subscriberCount || '0', 10);

                // Skip very large channels (already "broken out")
                if (subscribers > 1000000) continue;

                // Get recent uploads
                const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;

                const videosResponse = await axios.get(`${BASE_URL}/playlistItems`, {
                    params: {
                        part: 'snippet,contentDetails',
                        playlistId: uploadsPlaylistId,
                        maxResults: 10,
                        key: YOUTUBE_API_KEY
                    }
                });

                const videoIds = videosResponse.data.items
                    .map((item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId)
                    .join(',');

                if (!videoIds) continue;

                const statsResponse = await axios.get(`${BASE_URL}/videos`, {
                    params: {
                        part: 'statistics,snippet',
                        id: videoIds,
                        key: YOUTUBE_API_KEY
                    }
                });

                const recentVideos: VideoMetrics[] = statsResponse.data.items.map((v: {
                    statistics: { viewCount?: string };
                    snippet: { publishedAt: string };
                }) => {
                    const views = parseInt(v.statistics.viewCount || '0', 10);
                    const days = daysSinceUpload(v.snippet.publishedAt);
                    return {
                        views,
                        publishedAt: v.snippet.publishedAt,
                        velocity: days > 0 ? views / days : 0
                    };
                });

                if (recentVideos.length < 3) continue;

                // 4. Calculate growth metrics (Log-normalized)
                const velocities = recentVideos.map(v => v.velocity);
                const avgVelocity = logMean(velocities); // Log-mean

                // Velocity trend: compare first half vs second half
                const midPoint = Math.floor(velocities.length / 2);
                const firstHalf = velocities.slice(midPoint);
                const secondHalf = velocities.slice(0, midPoint);
                const velocityTrend = logMean(secondHalf) - logMean(firstHalf); // Log-trend

                // Consistency score using Log-StdDev (lower is better)
                const stdVelocity = logStdDev(velocities);
                // Normalized consistency: 0-1 scale where 0 std = 100 score
                const consistencyScore = Math.max(0, Math.round(100 - (stdVelocity * 20)));

                // Breakout potential formula (Log-normalized & Niche-adjusted)
                // 1. Niche Performance Score (0-40 pts): How high is velocity compared to niche baseline?
                const nicheScore = nicheNormalizedVelocity(expTransform(avgVelocity), nicheVelocities);
                // Normalized z-score mapped to 0-40 scale (z=0 -> 20pts, z=2 -> 40pts)
                const relativePerformanceScore = Math.min(40, Math.max(0, 20 + (nicheScore.normalized * 10)));

                // 2. Trend Score (0-30 pts): Is it accelerating?
                // Trend > 0.5 (significant log growth) gets max points
                const trendScore = velocityTrend > 0 ? Math.min(30, velocityTrend * 40) : 0;

                // 3. Punch Above Weight (0-10 pts): Views vs Subs
                const subVelocityRatio = subscribers > 0 ? expTransform(avgVelocity) / subscribers : 0;
                const punchAboveWeight = subVelocityRatio > 0.05 ? 10 : subVelocityRatio > 0.01 ? 5 : 0;

                // 4. Consistency Bonus (0-20 pts)
                const consistencyBonus = consistencyScore * 0.2;

                const breakoutPotential = Math.round(Math.min(100, relativePerformanceScore + trendScore + punchAboveWeight + consistencyBonus));

                // 5. Make prediction
                let outlook: 'High Potential' | 'Moderate' | 'Steady' | 'Declining';
                let reasoning: string;
                let confidence: 'low' | 'medium' | 'high';

                if (breakoutPotential >= 70 && velocityTrend > 0) {
                    outlook = 'High Potential';
                    reasoning = 'Strong velocity with positive trend. Watch this channel.';
                    confidence = recentVideos.length >= 5 ? 'medium' : 'low';
                } else if (breakoutPotential >= 50) {
                    outlook = 'Moderate';
                    reasoning = 'Decent performance with room to grow.';
                    confidence = 'medium';
                } else if (velocityTrend >= 0) {
                    outlook = 'Steady';
                    reasoning = 'Consistent but not accelerating.';
                    confidence = 'medium';
                } else {
                    outlook = 'Declining';
                    reasoning = 'Slowing momentum in recent videos.';
                    confidence = 'low';
                }

                channelGrowthData.push({
                    channelId: channel.id,
                    channelTitle: channelData.snippet.title,
                    thumbnail: channelData.snippet.thumbnails.medium?.url || channelData.snippet.thumbnails.default?.url,
                    subscribers,
                    videoCount: parseInt(channelData.statistics.videoCount || '0', 10),
                    recentVideos,
                    metrics: {
                        avgVelocity: Math.round(avgVelocity),
                        velocityTrend: Math.round(velocityTrend),
                        consistencyScore,
                        breakoutPotential
                    },
                    prediction: { outlook, reasoning, confidence }
                });

            } catch (error) {
                console.error(`Error analyzing channel ${channel.id}:`, error);
                continue;
            }
        }

        // 6. Sort by breakout potential
        const sortedChannels = channelGrowthData.sort((a, b) =>
            b.metrics.breakoutPotential - a.metrics.breakoutPotential
        );

        return NextResponse.json({
            niche,
            channelsAnalyzed: sortedChannels.length,

            highPotential: sortedChannels
                .filter(c => c.prediction.outlook === 'High Potential')
                .slice(0, 5)
                .map(c => ({
                    channel: c.channelTitle,
                    channelId: c.channelId,
                    thumbnail: c.thumbnail,
                    subscribers: c.subscribers,
                    breakoutScore: c.metrics.breakoutPotential,
                    avgVelocity: c.metrics.avgVelocity,
                    trend: c.metrics.velocityTrend > 0 ? 'Accelerating' : 'Stable',
                    reasoning: c.prediction.reasoning
                })),

            watchList: sortedChannels
                .filter(c => c.prediction.outlook === 'Moderate')
                .slice(0, 5)
                .map(c => ({
                    channel: c.channelTitle,
                    channelId: c.channelId,
                    subscribers: c.subscribers,
                    breakoutScore: c.metrics.breakoutPotential,
                    reasoning: c.prediction.reasoning
                })),

            methodology: {
                approach: 'Velocity-based growth prediction using recent video performance',
                formula: 'breakoutPotential = velocityScore + trendScore + consistencyBonus + punchAboveWeightBonus',
                limitations: [
                    'Based on public view counts only',
                    'Cannot predict viral events or algorithm changes',
                    'Channels over 1M subs excluded (already "broken out")',
                    'Trend calculated from last 10 videos only'
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
        console.error('Breakout prediction error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
