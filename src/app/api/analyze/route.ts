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

        // Calculate averages and identify holes
        const analysis = categories.map(cat => {
            const bucket = durationBuckets[cat];
            bucket.avgViews = bucket.count > 0 ? Math.round(bucket.totalViews / bucket.count) : 0;
            return bucket;
        });

        // Find "holes" - categories with high avg views but low video count
        const avgCount = videos.length / categories.length;
        const holes = analysis.filter(a => a.count < avgCount && a.avgViews > 0).map(a => ({
            range: a.range,
            reason: `Low competition (${a.count} videos) with ${a.avgViews.toLocaleString()} avg views`
        }));

        return NextResponse.json({
            query,
            totalVideos: videos.length,
            videos,
            lengthAnalysis: analysis,
            marketHoles: holes
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
