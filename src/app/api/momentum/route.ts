import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface MomentumOpportunity {
    topic: string;
    trendGrowth: string;
    recentVideosCount: number;
    avgRecentVideoAge: number;
    qualitySupplyGap: boolean;
    momentumScore: number;
    urgency: string;
    reasoning: string;
}

function daysSince(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

async function checkVideoFreshness(topic: string): Promise<{ count: number; avgAge: number; highViewCount: number }> {
    try {
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: topic,
                type: 'video',
                maxResults: 15,
                order: 'date', // Most recent first
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length === 0) return { count: 0, avgAge: 999, highViewCount: 0 };

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        let totalAge = 0;
        let highViewCount = 0;

        statsResponse.data.items.forEach((v: {
            snippet: { publishedAt: string };
            statistics: { viewCount?: string }
        }) => {
            totalAge += daysSince(v.snippet.publishedAt);
            const views = parseInt(v.statistics.viewCount || '0', 10);
            if (views > 50000) highViewCount++;
        });

        const recentVideos = statsResponse.data.items.filter((v: { snippet: { publishedAt: string } }) =>
            daysSince(v.snippet.publishedAt) <= 7
        );

        return {
            count: recentVideos.length,
            avgAge: Math.round(totalAge / items.length),
            highViewCount
        };
    } catch {
        return { count: 0, avgAge: 999, highViewCount: 0 };
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const seedTopic = searchParams.get('topic');
    const regionCode = searchParams.get('region') || 'US';

    if (!seedTopic) {
        return NextResponse.json({ error: 'Missing "topic" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Get rising topics from Google Trends
        const risingTopics: { query: string; growth: string }[] = [];

        try {
            const relatedQueries = await googleTrends.relatedQueries({
                keyword: seedTopic,
                geo: regionCode
            });
            const relatedData = JSON.parse(relatedQueries);
            const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];

            rising.forEach((item: { query: string; formattedValue: string }) => {
                risingTopics.push({
                    query: item.query,
                    growth: item.formattedValue
                });
            });
        } catch {
            // Trends may fail
        }

        // 2. Get autocomplete suggestions (often reflect recent interest)
        const autocompleteSuggestions: string[] = [];

        try {
            const autocompleteResponse = await axios.get(
                `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seedTopic)}`
            );
            const matches = autocompleteResponse.data.toString().match(/\["([^"]+)"/g);
            if (matches) {
                const suggestions = matches.slice(1, 8).map((m: string) => m.replace(/\["|"/g, ''));
                autocompleteSuggestions.push(...suggestions);
            }
        } catch {
            // Autocomplete may fail
        }

        // 3. Combine and deduplicate topics to check
        const topicsToCheck = new Set<string>();
        risingTopics.forEach(t => topicsToCheck.add(t.query));
        autocompleteSuggestions.forEach(s => topicsToCheck.add(s));

        // 4. Check each topic for momentum opportunity
        const opportunities: MomentumOpportunity[] = [];
        const topicsArray = Array.from(topicsToCheck).slice(0, 12);

        for (const topic of topicsArray) {
            const freshness = await checkVideoFreshness(topic);
            const risingInfo = risingTopics.find(r => r.query === topic);

            // Parse growth percentage
            let growthPercent = 0;
            if (risingInfo?.growth) {
                if (risingInfo.growth.includes('Breakout')) {
                    growthPercent = 500; // Breakout = major spike
                } else {
                    const match = risingInfo.growth.match(/\+?(\d+)/);
                    if (match) growthPercent = parseInt(match[1], 10);
                }
            }

            // Calculate momentum score
            // High growth + few recent videos = high momentum
            const growthScore = Math.min(growthPercent / 5, 50); // 0-50 from growth
            const freshnessScore = Math.max(0, 50 - (freshness.count * 10)); // Fewer recent videos = higher score
            const momentumScore = Math.round(Math.min(100, growthScore + freshnessScore));

            // Determine if there's a quality gap
            const qualitySupplyGap = freshness.count < 5 && (growthPercent > 100 || freshness.highViewCount > 0);

            // Determine urgency
            let urgency = 'Normal';
            if (growthPercent >= 500 || (risingInfo?.growth?.includes('Breakout'))) {
                urgency = '🔥 Critical - Move Now';
            } else if (growthPercent >= 200 && freshness.count < 3) {
                urgency = '⚡ High - 48hr window';
            } else if (momentumScore >= 60) {
                urgency = '📈 Elevated';
            }

            if (momentumScore >= 40) {
                opportunities.push({
                    topic,
                    trendGrowth: risingInfo?.growth || 'Autocomplete signal',
                    recentVideosCount: freshness.count,
                    avgRecentVideoAge: freshness.avgAge,
                    qualitySupplyGap,
                    momentumScore,
                    urgency,
                    reasoning: generateReasoning(growthPercent, freshness, risingInfo?.growth)
                });
            }

            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Sort by momentum score
        opportunities.sort((a, b) => b.momentumScore - a.momentumScore);

        // 5. Generate alerts
        const criticalAlerts = opportunities.filter(o => o.urgency.includes('Critical'));
        const highAlerts = opportunities.filter(o => o.urgency.includes('High'));

        return NextResponse.json({
            seedTopic,
            topicsScanned: topicsArray.length,
            opportunities: opportunities.slice(0, 10),
            criticalAlerts: criticalAlerts.length,
            highPriorityAlerts: highAlerts.length,
            topOpportunity: opportunities[0] || null,
            insight: criticalAlerts.length > 0
                ? `🔥 ${criticalAlerts.length} CRITICAL momentum opportunities detected! Act within 24-48 hours.`
                : highAlerts.length > 0
                    ? `⚡ ${highAlerts.length} high-priority opportunities. The window is open.`
                    : opportunities.length > 0
                        ? `📈 ${opportunities.length} opportunities identified. Monitor for acceleration.`
                        : 'No significant momentum detected. Check back in 24 hours.'
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

function generateReasoning(
    growthPercent: number,
    freshness: { count: number; avgAge: number; highViewCount: number },
    trendLabel?: string
): string {
    const parts: string[] = [];

    if (trendLabel?.includes('Breakout')) {
        parts.push('Breakout trend - massive spike in interest');
    } else if (growthPercent >= 200) {
        parts.push(`${growthPercent}% growth in search interest`);
    } else if (growthPercent > 0) {
        parts.push(`Rising interest (+${growthPercent}%)`);
    }

    if (freshness.count === 0) {
        parts.push('No videos in last 7 days - first mover window open');
    } else if (freshness.count < 3) {
        parts.push(`Only ${freshness.count} recent videos - low competition`);
    }

    if (freshness.highViewCount > 0) {
        parts.push('Existing videos getting high views - demand confirmed');
    }

    return parts.join('. ') + '.';
}
