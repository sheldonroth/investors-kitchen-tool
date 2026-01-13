import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface TrendingOpportunity {
    topic: string;
    trendSignal: string;
    trendPhase: 'rising' | 'peaking' | 'unknown';
    recentVideosCount: number;
    avgVideoAge: number;
    supplyGap: boolean;
    opportunityLevel: 'strong' | 'moderate' | 'speculative';
    reasoning: string;
    dataAge: string;
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
                order: 'date',
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
        const risingTopics: { query: string; growth: string; isBreakout: boolean }[] = [];

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
                    growth: item.formattedValue,
                    isBreakout: item.formattedValue.includes('Breakout')
                });
            });
        } catch {
            // Trends may fail
        }

        // 2. Get autocomplete suggestions
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

        // 3. Combine topics
        const topicsToCheck = new Set<string>();
        risingTopics.forEach(t => topicsToCheck.add(t.query));
        autocompleteSuggestions.forEach(s => topicsToCheck.add(s));

        // 4. Analyze each topic
        const opportunities: TrendingOpportunity[] = [];
        const topicsArray = Array.from(topicsToCheck).slice(0, 12);

        for (const topic of topicsArray) {
            const freshness = await checkVideoFreshness(topic);
            const risingInfo = risingTopics.find(r => r.query === topic);

            // Parse growth
            let growthPercent = 0;
            let isBreakout = false;
            if (risingInfo?.growth) {
                if (risingInfo.growth.includes('Breakout')) {
                    growthPercent = 500;
                    isBreakout = true;
                } else {
                    const match = risingInfo.growth.match(/\+?(\d+)/);
                    if (match) growthPercent = parseInt(match[1], 10);
                }
            }

            // Determine trend phase (HONEST: we can't truly know this)
            let trendPhase: 'rising' | 'peaking' | 'unknown' = 'unknown';
            if (growthPercent > 0 && freshness.count < 5) {
                trendPhase = 'rising'; // Growing interest, low supply
            } else if (isBreakout && freshness.count >= 5) {
                trendPhase = 'peaking'; // Breakout with lots of recent videos = may be saturating
            }

            // Determine opportunity level
            let opportunityLevel: 'strong' | 'moderate' | 'speculative' = 'speculative';
            let reasoning = '';

            const supplyGap = freshness.count < 5 && growthPercent > 0;

            if (growthPercent >= 100 && freshness.count < 3 && freshness.highViewCount > 0) {
                opportunityLevel = 'strong';
                reasoning = `${growthPercent >= 500 ? 'Breakout' : 'Strong'} growth (+${growthPercent}%), only ${freshness.count} recent videos, existing videos getting views.`;
            } else if (growthPercent >= 50 && freshness.count < 5) {
                opportunityLevel = 'moderate';
                reasoning = `Growing interest (+${growthPercent}%), ${freshness.count} recent videos. Window appears open.`;
            } else if (risingInfo) {
                opportunityLevel = 'speculative';
                reasoning = `Detected in rising queries (${risingInfo.growth}). ${freshness.count} recent videos. Validate before investing.`;
            } else {
                reasoning = `Found via autocomplete. ${freshness.count} recent videos. Demand signal unclear.`;
            }

            opportunities.push({
                topic,
                trendSignal: risingInfo?.growth || 'Autocomplete only',
                trendPhase,
                recentVideosCount: freshness.count,
                avgVideoAge: freshness.avgAge,
                supplyGap,
                opportunityLevel,
                reasoning,
                // HONEST: Show data age
                dataAge: 'Trend data is 3-7 days old (Google Trends weekly granularity)'
            });

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Sort by opportunity level
        const levelOrder = { strong: 0, moderate: 1, speculative: 2 };
        opportunities.sort((a, b) => levelOrder[a.opportunityLevel] - levelOrder[b.opportunityLevel]);

        // Categorize
        const strong = opportunities.filter(o => o.opportunityLevel === 'strong');
        const moderate = opportunities.filter(o => o.opportunityLevel === 'moderate');
        const speculative = opportunities.filter(o => o.opportunityLevel === 'speculative');

        return NextResponse.json({
            seedTopic,
            topicsScanned: topicsArray.length,

            opportunities: opportunities.slice(0, 10),

            byLevel: {
                strong: strong.slice(0, 3),
                moderate: moderate.slice(0, 4),
                speculative: speculative.slice(0, 3)
            },

            summary: {
                strongCount: strong.length,
                moderateCount: moderate.length,
                speculativeCount: speculative.length
            },

            // HONEST methodology
            methodology: {
                dataSource: 'Google Trends rising queries + YouTube autocomplete',
                dataFreshness: 'Trend data has weekly granularity (3-7 days old, not real-time)',
                opportunityLevels: {
                    strong: 'High growth + low supply + proven views on existing videos',
                    moderate: 'Growth signal + supply gap, but less certainty',
                    speculative: 'Signal detected but unvalidated - test before investing'
                },
                limitations: [
                    'Breakout trends may already be saturating by the time detected',
                    'Cannot determine if trend is rising, peaking, or declining with certainty',
                    'Autocomplete presence does not guarantee video demand'
                ]
            },

            insight: strong.length > 0
                ? `Found ${strong.length} strong opportunities with proven signals. Top pick: "${strong[0].topic}"`
                : moderate.length > 0
                    ? `Found ${moderate.length} moderate opportunities. Validate demand before heavy investment.`
                    : 'No strong momentum signals detected. Try a different or broader topic.'
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
