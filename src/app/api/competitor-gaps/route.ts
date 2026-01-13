import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface ContentGap {
    topic: string;
    lastCoveredDaysAgo: number | null;
    searchDemand: number;
    gapScore: number;
    reason: string;
}

interface ChannelAnalysis {
    channelId: string;
    channelTitle: string;
    subscriberCount: number;
    totalVideos: number;
    analyzedVideos: number;
    contentGaps: ContentGap[];
    staleTopics: string[];
    recommendation: string;
}

function daysSince(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function extractTopics(title: string): string[] {
    // Extract meaningful keywords (simplified topic extraction)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'i', 'you', 'my', 'your', 'how', 'what', 'why', 'this', 'that', 'be', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'get', 'got', 'getting', 'make', 'made', 'making']);

    return title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
}

async function checkSearchDemand(topic: string): Promise<number> {
    try {
        const interestData = await googleTrends.interestOverTime({ keyword: topic });
        const parsed = JSON.parse(interestData);
        const timelineData = parsed?.default?.timelineData || [];
        if (timelineData.length > 0) {
            const recent = timelineData.slice(-4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
            return Math.round(recent);
        }
    } catch {
        // Trends may fail
    }
    return 30;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const channelIdentifier = searchParams.get('channel'); // Channel ID or handle
    const niche = searchParams.get('niche');

    if (!channelIdentifier && !niche) {
        return NextResponse.json({ error: 'Missing "channel" or "niche" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        let channelId = channelIdentifier;
        let channelData;

        // If analyzing by niche, find top channels
        if (niche) {
            // Search for videos in niche and get top channels
            const searchResponse = await axios.get(`${BASE_URL}/search`, {
                params: {
                    part: 'snippet',
                    q: niche,
                    type: 'video',
                    maxResults: 50,
                    order: 'viewCount',
                    key: YOUTUBE_API_KEY
                }
            });

            // Count videos per channel to find dominant channels
            const channelVideoCounts: Record<string, { count: number; channelTitle: string }> = {};
            searchResponse.data.items.forEach((item: { snippet: { channelId: string; channelTitle: string } }) => {
                const cId = item.snippet.channelId;
                if (!channelVideoCounts[cId]) {
                    channelVideoCounts[cId] = { count: 0, channelTitle: item.snippet.channelTitle };
                }
                channelVideoCounts[cId].count++;
            });

            // Get top channel
            const topChannel = Object.entries(channelVideoCounts)
                .sort((a, b) => b[1].count - a[1].count)[0];

            if (topChannel) {
                channelId = topChannel[0];
            }
        }

        if (!channelId) {
            return NextResponse.json({ error: 'Could not identify channel' }, { status: 400 });
        }

        // Get channel details
        const channelResponse = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: channelId,
                key: YOUTUBE_API_KEY
            }
        });

        if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }

        channelData = channelResponse.data.items[0];
        const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) {
            return NextResponse.json({ error: 'Cannot access channel videos' }, { status: 400 });
        }

        // Get recent videos from channel
        const playlistResponse = await axios.get(`${BASE_URL}/playlistItems`, {
            params: {
                part: 'snippet',
                playlistId: uploadsPlaylistId,
                maxResults: 50,
                key: YOUTUBE_API_KEY
            }
        });

        const videos = playlistResponse.data.items || [];

        // Analyze topic coverage
        const topicLastCovered: Record<string, string> = {}; // topic -> most recent date
        const topicCounts: Record<string, number> = {};

        videos.forEach((video: { snippet: { title: string; publishedAt: string } }) => {
            const topics = extractTopics(video.snippet.title);
            const publishedAt = video.snippet.publishedAt;

            topics.forEach(topic => {
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                if (!topicLastCovered[topic] || publishedAt > topicLastCovered[topic]) {
                    topicLastCovered[topic] = publishedAt;
                }
            });
        });

        // Find stale topics (covered before but not recently)
        const staleThreshold = 90; // 90 days
        const staleTopics: string[] = [];

        Object.entries(topicLastCovered).forEach(([topic, lastDate]) => {
            const daysSinceLast = daysSince(lastDate);
            if (daysSinceLast > staleThreshold && topicCounts[topic] >= 2) {
                staleTopics.push(topic);
            }
        });

        // Get niche-related topics that this channel DOESN'T cover
        const allChannelTopics = new Set(Object.keys(topicCounts));
        const nicheSearchTerms: string[] = [];

        if (niche) {
            // Get related searches in niche
            try {
                const relatedQueries = await googleTrends.relatedQueries({ keyword: niche });
                const relatedData = JSON.parse(relatedQueries);
                const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];
                rising.slice(0, 10).forEach((item: { query: string }) => {
                    nicheSearchTerms.push(item.query.toLowerCase());
                });
            } catch {
                // Trends may fail
            }
        }

        // Identify content gaps
        const contentGaps: ContentGap[] = [];

        for (const topic of staleTopics.slice(0, 5)) {
            const demand = await checkSearchDemand(topic);
            const daysSinceLast = daysSince(topicLastCovered[topic]);
            const gapScore = Math.round(demand * 0.5 + Math.min(daysSinceLast / 3, 50));

            contentGaps.push({
                topic,
                lastCoveredDaysAgo: daysSinceLast,
                searchDemand: demand,
                gapScore: Math.min(100, gapScore),
                reason: `Last covered ${daysSinceLast} days ago, still has search demand of ${demand}/100`
            });
        }

        // Check niche topics not covered
        for (const term of nicheSearchTerms.slice(0, 5)) {
            const termWords = term.split(/\s+/);
            const covered = termWords.some(word => allChannelTopics.has(word));

            if (!covered) {
                const demand = await checkSearchDemand(term);
                if (demand >= 30) {
                    contentGaps.push({
                        topic: term,
                        lastCoveredDaysAgo: null,
                        searchDemand: demand,
                        gapScore: Math.round(demand * 0.6 + 30), // Bonus for never covered
                        reason: `Rising search term in niche, never covered by this channel`
                    });
                }
            }
        }

        // Sort by gap score
        contentGaps.sort((a, b) => b.gapScore - a.gapScore);

        const analysis: ChannelAnalysis = {
            channelId,
            channelTitle: channelData.snippet.title,
            subscriberCount: parseInt(channelData.statistics.subscriberCount || '0', 10),
            totalVideos: parseInt(channelData.statistics.videoCount || '0', 10),
            analyzedVideos: videos.length,
            contentGaps: contentGaps.slice(0, 8),
            staleTopics: staleTopics.slice(0, 10),
            recommendation: contentGaps.length > 0
                ? `Found ${contentGaps.length} content gaps. Top opportunity: "${contentGaps[0].topic}" with gap score of ${contentGaps[0].gapScore}/100.`
                : 'No significant content gaps detected. Channel covers niche thoroughly.'
        };

        return NextResponse.json({
            niche: niche || 'N/A',
            analysis,
            insight: `Analyzed ${videos.length} videos from "${analysis.channelTitle}". ${contentGaps.filter(g => g.gapScore >= 60).length} high-priority gaps identified.`
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `API Error: ${error.response.status}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
