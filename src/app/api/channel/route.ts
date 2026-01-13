import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface VideoData {
    id: string;
    title: string;
    views: number;
    publishedAt: string;
    thumbnail: string;
    duration: number;
}

interface ContentGap {
    topic: string;
    opportunity: string;
    reasoning: string;
    urgency: 'high' | 'medium' | 'low';
}

// Extract channel ID from various URL formats
function extractChannelIdentifier(input: string): { type: 'id' | 'handle' | 'username' | 'custom'; value: string } | null {
    const trimmed = input.trim();

    // Direct channel ID (starts with UC)
    if (/^UC[\w-]{22}$/.test(trimmed)) {
        return { type: 'id', value: trimmed };
    }

    // @handle format
    const handleMatch = trimmed.match(/@([\w.-]+)/);
    if (handleMatch) {
        return { type: 'handle', value: handleMatch[1] };
    }

    // Full URL patterns
    const patterns = [
        /youtube\.com\/channel\/(UC[\w-]{22})/,        // /channel/UCxxxxx
        /youtube\.com\/@([\w.-]+)/,                    // /@handle
        /youtube\.com\/c\/([\w-]+)/,                   // /c/customname
        /youtube\.com\/user\/([\w-]+)/,                // /user/username
        /youtube\.com\/([\w-]+)(?:\?|$)/               // /customname
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
            if (pattern.source.includes('channel')) {
                return { type: 'id', value: match[1] };
            } else if (pattern.source.includes('@')) {
                return { type: 'handle', value: match[1] };
            } else if (pattern.source.includes('/c/')) {
                return { type: 'custom', value: match[1] };
            } else if (pattern.source.includes('user')) {
                return { type: 'username', value: match[1] };
            }
        }
    }

    // Treat as handle if nothing else matches
    if (/^[\w.-]+$/.test(trimmed)) {
        return { type: 'handle', value: trimmed };
    }

    return null;
}

// Resolve channel ID from various identifiers
async function resolveChannelId(identifier: { type: string; value: string }): Promise<string | null> {
    if (identifier.type === 'id') {
        return identifier.value;
    }

    // For handles, search YouTube
    const searchResponse = await axios.get(`${BASE_URL}/search`, {
        params: {
            part: 'snippet',
            q: identifier.type === 'handle' ? `@${identifier.value}` : identifier.value,
            type: 'channel',
            maxResults: 1,
            key: YOUTUBE_API_KEY
        }
    });

    if (searchResponse.data.items?.[0]) {
        return searchResponse.data.items[0].snippet.channelId;
    }

    return null;
}

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
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
    const channelInput = searchParams.get('channel');

    if (!channelInput) {
        return NextResponse.json({ error: 'Missing "channel" parameter. Provide a channel URL, handle, or ID.' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Parse and resolve channel identifier
        const identifier = extractChannelIdentifier(channelInput);
        if (!identifier) {
            return NextResponse.json({ error: 'Could not parse channel URL or handle' }, { status: 400 });
        }

        const channelId = await resolveChannelId(identifier);
        if (!channelId) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }

        // 2. Get channel info
        const channelResponse = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: channelId,
                key: YOUTUBE_API_KEY
            }
        });

        const channel = channelResponse.data.items?.[0];
        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }

        const channelInfo = {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnail: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url,
            subscribers: parseInt(channel.statistics.subscriberCount || '0', 10),
            videoCount: parseInt(channel.statistics.videoCount || '0', 10),
            viewCount: parseInt(channel.statistics.viewCount || '0', 10)
        };

        // 3. Get channel's recent videos
        const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

        const videosResponse = await axios.get(`${BASE_URL}/playlistItems`, {
            params: {
                part: 'snippet,contentDetails',
                playlistId: uploadsPlaylistId,
                maxResults: 50,
                key: YOUTUBE_API_KEY
            }
        });

        const videoIds = videosResponse.data.items
            .map((item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId)
            .join(',');

        // 4. Get video statistics and durations
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'statistics,contentDetails,snippet',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const videos: VideoData[] = statsResponse.data.items.map((v: {
            id: string;
            snippet: { title: string; publishedAt: string; thumbnails: { medium?: { url: string }; default?: { url: string } } };
            statistics: { viewCount?: string };
            contentDetails: { duration: string };
        }) => ({
            id: v.id,
            title: v.snippet.title,
            views: parseInt(v.statistics.viewCount || '0', 10),
            publishedAt: v.snippet.publishedAt,
            thumbnail: v.snippet.thumbnails.medium?.url || v.snippet.thumbnails.default?.url,
            duration: parseDuration(v.contentDetails.duration)
        }));

        // 5. Analyze performance patterns
        const viewCounts = videos.map(v => v.views);
        const meanViews = calculateMean(viewCounts);
        const stdViews = calculateStdDev(viewCounts, meanViews);

        // Identify best and worst performers
        const videosWithZScore = videos.map(v => ({
            ...v,
            zScore: stdViews > 0 ? (v.views - meanViews) / stdViews : 0
        }));

        const topPerformers = videosWithZScore.filter(v => v.zScore > 1).sort((a, b) => b.zScore - a.zScore).slice(0, 5);
        const underperformers = videosWithZScore.filter(v => v.zScore < -0.5).sort((a, b) => a.zScore - b.zScore).slice(0, 5);

        // Content breakdown by duration
        const shorts = videos.filter(v => v.duration <= 60);
        const longForm = videos.filter(v => v.duration > 60);

        // 6. Extract topics/keywords from titles
        const titleWords = videos.flatMap(v =>
            v.title.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3)
        );

        const wordFreq: Record<string, number> = {};
        const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'your', 'they', 'what', 'when', 'where', 'which']);
        titleWords.forEach(w => {
            if (!stopWords.has(w)) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        });

        const topTopics = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));

        // 7. Generate AI suggestions for gaps
        let contentGaps: ContentGap[] = [];

        if (GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const topTitles = topPerformers.map(v => `"${v.title}" (${v.views.toLocaleString()} views)`).join('\n');
                const underTitles = underperformers.map(v => `"${v.title}" (${v.views.toLocaleString()} views)`).join('\n');
                const avgViews = Math.round(meanViews).toLocaleString();

                const prompt = `Analyze this YouTube channel to identify content gaps and opportunities.

CHANNEL: ${channelInfo.title}
SUBSCRIBERS: ${channelInfo.subscribers.toLocaleString()}
AVERAGE VIEWS: ${avgViews}

TOP PERFORMING VIDEOS:
${topTitles || 'No outliers'}

UNDERPERFORMING VIDEOS:
${underTitles || 'No underperformers'}

COMMON TOPICS: ${topTopics.map(t => t.word).join(', ')}

Based on this analysis, suggest 5 specific video ideas that:
1. Are similar to what works (top performers) but different enough to be unique
2. Fill gaps the channel hasn't covered
3. Would likely perform well for this specific audience

Return ONLY valid JSON:
{"gaps":[{"topic":"specific video idea","opportunity":"why this could work","reasoning":"based on channel data","urgency":"high/medium/low"}]}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    contentGaps = parsed.gaps || [];
                }
            } catch (error) {
                console.error('AI gap analysis failed:', error);
            }
        }

        // 8. Calculate channel health metrics
        const recentVideos = videos.slice(0, 10);
        const recentMeanViews = calculateMean(recentVideos.map(v => v.views));
        const viewsToSubRatio = channelInfo.subscribers > 0
            ? Math.round((recentMeanViews / channelInfo.subscribers) * 100)
            : 0;

        const postingFrequency = videos.length >= 2
            ? Math.round(30 / (
                (new Date(videos[0].publishedAt).getTime() - new Date(videos[Math.min(9, videos.length - 1)].publishedAt).getTime())
                / (1000 * 60 * 60 * 24 * Math.min(10, videos.length))
            ))
            : 0;

        return NextResponse.json({
            channel: channelInfo,

            performance: {
                avgViews: Math.round(meanViews),
                viewsToSubRatio: `${viewsToSubRatio}%`,
                postingFrequency: postingFrequency > 0 ? `~${postingFrequency} videos/month` : 'Unknown',
                outlierRate: `${Math.round((topPerformers.length / videos.length) * 100)}%`
            },

            contentMix: {
                shorts: { count: shorts.length, avgViews: Math.round(calculateMean(shorts.map(v => v.views))) },
                longForm: { count: longForm.length, avgViews: Math.round(calculateMean(longForm.map(v => v.views))) },
                topFormat: shorts.length > 0 && longForm.length > 0
                    ? (calculateMean(shorts.map(v => v.views)) > calculateMean(longForm.map(v => v.views)) ? 'Shorts perform better' : 'Long-form performs better')
                    : 'Not enough data'
            },

            topPerformers: topPerformers.map(v => ({
                id: v.id,
                title: v.title,
                views: v.views,
                thumbnail: v.thumbnail,
                zScore: Math.round(v.zScore * 100) / 100
            })),

            underperformers: underperformers.slice(0, 3).map(v => ({
                id: v.id,
                title: v.title,
                views: v.views,
                zScore: Math.round(v.zScore * 100) / 100
            })),

            topTopics,

            contentGaps,

            methodology: {
                videosAnalyzed: videos.length,
                approach: 'Statistical analysis of video performance + AI-powered gap detection',
                limitations: [
                    'Based on public data only (no CTR, retention, or revenue)',
                    'Recent videos may not have reached full view potential',
                    'Outlier detection uses z-score > 1.0 threshold',
                    'Content gaps are AI suggestions, not guarantees'
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
        console.error('Channel analysis error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
