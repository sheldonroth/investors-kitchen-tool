import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface TopicAnalysis {
    topic: string;
    demand: {
        avgViews: number;
        totalViews: number;
        searchInterest: number;
        velocityAvg: number;
    };
    supply: {
        videoCount: number;
        qualityVideoCount: number;
        dominantChannelSize: string;
        avgAge: number;
    };
    gapIndicator: number;
    signalStrength: 'strong' | 'moderate' | 'weak';
    interpretation: string;
    sampleVideos: {
        title: string;
        views: number;
        velocity: number;
        thumbnail: string;
        id: string;
        channelSubs: number;
    }[];
}

function daysSince(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function categorizeChannelSize(subs: number): string {
    if (subs >= 1000000) return 'large';
    if (subs >= 100000) return 'medium';
    if (subs >= 10000) return 'small';
    return 'micro';
}

async function analyzeTopicDepth(topic: string, regionCode: string): Promise<TopicAnalysis | null> {
    try {
        // Get videos for this topic
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: topic,
                type: 'video',
                maxResults: 15,
                regionCode,
                order: 'relevance',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 5) return null;

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // Get video stats
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // Get channel stats
        const channelIds = [...new Set(statsResponse.data.items.map((v: { snippet: { channelId: string } }) => v.snippet.channelId))];

        const channelResponse = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'statistics',
                id: (channelIds as string[]).join(','),
                key: YOUTUBE_API_KEY
            }
        });

        const channelSubs: Record<string, number> = {};
        channelResponse.data.items.forEach((ch: { id: string; statistics: { subscriberCount?: string } }) => {
            channelSubs[ch.id] = parseInt(ch.statistics.subscriberCount || '0', 10);
        });

        // Calculate metrics
        let totalViews = 0;
        let totalVelocity = 0;
        let totalAge = 0;
        let qualityCount = 0;
        const channelSizes: string[] = [];
        const sampleVideos: TopicAnalysis['sampleVideos'] = [];

        statsResponse.data.items.forEach((video: {
            id: string;
            snippet: { title: string; channelId: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            statistics: { viewCount?: string };
        }) => {
            const views = parseInt(video.statistics.viewCount || '0', 10);
            const days = daysSince(video.snippet.publishedAt);
            const velocity = views / days;
            const subs = channelSubs[video.snippet.channelId] || 0;

            totalViews += views;
            totalVelocity += velocity;
            totalAge += days;

            const channelSize = categorizeChannelSize(subs);
            channelSizes.push(channelSize);

            // Quality video = good velocity relative to channel size
            const expectedVelocity = subs > 0 ? subs * 0.001 : 100;
            if (velocity > expectedVelocity * 2) qualityCount++;

            if (sampleVideos.length < 3) {
                sampleVideos.push({
                    title: video.snippet.title,
                    views,
                    velocity: Math.round(velocity),
                    thumbnail: video.snippet.thumbnails.high?.url || '',
                    id: video.id,
                    channelSubs: subs
                });
            }
        });

        const videoCount = statsResponse.data.items.length;
        const avgViews = totalViews / videoCount;
        const avgVelocity = totalVelocity / videoCount;
        const avgAge = totalAge / videoCount;

        // Determine dominant channel size
        const sizeCount: Record<string, number> = {};
        channelSizes.forEach(s => { sizeCount[s] = (sizeCount[s] || 0) + 1; });
        const dominantSize = Object.entries(sizeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

        // Get search interest
        let searchInterest = 50;
        try {
            const interestData = await googleTrends.interestOverTime({ keyword: topic });
            const parsed = JSON.parse(interestData);
            const timelineData = parsed?.default?.timelineData || [];
            if (timelineData.length > 0) {
                const recent = timelineData.slice(-4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                searchInterest = Math.round(recent);
            }
        } catch {
            // Trends may fail
        }

        // Calculate gap indicator
        // FIXED: Use floor on supply to prevent division explosion
        // Formula: (demand proxy) / (supply proxy + floor)
        const demandProxy = Math.log10(avgViews + 1) * 20 + searchInterest * 0.3 + Math.log10(avgVelocity + 1) * 15;
        const supplyFloor = 5; // Minimum supply to prevent instability
        const supplyProxy = Math.max(videoCount, supplyFloor) + qualityCount * 2;

        const gapIndicator = Math.round((demandProxy / supplyProxy) * 10);
        const clampedGap = Math.min(100, Math.max(0, gapIndicator));

        // Determine signal strength based on data quality
        let signalStrength: 'strong' | 'moderate' | 'weak' = 'weak';
        let interpretation = '';

        if (avgViews >= 50000 && dominantSize !== 'large' && searchInterest >= 40) {
            signalStrength = 'strong';
            interpretation = `Good views (${Math.round(avgViews).toLocaleString()} avg), ${dominantSize} channels dominating, search interest present. Opportunity for quality entry.`;
        } else if (avgViews >= 10000 && searchInterest >= 30) {
            signalStrength = 'moderate';
            interpretation = `Moderate views (${Math.round(avgViews).toLocaleString()} avg). ${dominantSize === 'large' ? 'Large channels dominating - harder to compete.' : 'Room for quality content.'}`;
        } else {
            signalStrength = 'weak';
            interpretation = `Lower view averages (${Math.round(avgViews).toLocaleString()}). ${searchInterest < 30 ? 'Search interest also low.' : ''} Validate demand before investing.`;
        }

        return {
            topic,
            demand: {
                avgViews: Math.round(avgViews),
                totalViews,
                searchInterest,
                velocityAvg: Math.round(avgVelocity)
            },
            supply: {
                videoCount,
                qualityVideoCount: qualityCount,
                dominantChannelSize: dominantSize,
                avgAge: Math.round(avgAge)
            },
            gapIndicator: clampedGap,
            signalStrength,
            interpretation,
            sampleVideos
        };
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const seed = searchParams.get('seed');
    const regionCode = searchParams.get('region') || 'US';

    if (!seed) {
        return NextResponse.json({ error: 'Missing "seed" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // Get related topics
        const relatedTopics: string[] = [seed];

        try {
            const autocompleteResponse = await axios.get(
                `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seed)}`
            );
            const matches = autocompleteResponse.data.toString().match(/\["([^"]+)"/g);
            if (matches) {
                const suggestions = matches.slice(1, 6).map((m: string) => m.replace(/\["|"/g, ''));
                relatedTopics.push(...suggestions);
            }

            const relatedQueries = await googleTrends.relatedQueries({ keyword: seed, geo: regionCode });
            const relatedData = JSON.parse(relatedQueries);
            const topQueries = relatedData?.default?.rankedList?.[0]?.rankedKeyword || [];
            topQueries.slice(0, 3).forEach((item: { query: string }) => {
                if (!relatedTopics.includes(item.query)) {
                    relatedTopics.push(item.query);
                }
            });
        } catch {
            // Continue with seed only
        }

        // Analyze each topic
        const analyses: TopicAnalysis[] = [];
        for (const topic of relatedTopics.slice(0, 8)) {
            const analysis = await analyzeTopicDepth(topic, regionCode);
            if (analysis) {
                analyses.push(analysis);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Sort by signal strength then gap indicator
        const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
        analyses.sort((a, b) => {
            if (strengthOrder[a.signalStrength] !== strengthOrder[b.signalStrength]) {
                return strengthOrder[a.signalStrength] - strengthOrder[b.signalStrength];
            }
            return b.gapIndicator - a.gapIndicator;
        });

        // Categorize
        const strongSignals = analyses.filter(a => a.signalStrength === 'strong');
        const moderateSignals = analyses.filter(a => a.signalStrength === 'moderate');

        // Calculate market overview
        const avgGap = analyses.length > 0
            ? Math.round(analyses.reduce((s, a) => s + a.gapIndicator, 0) / analyses.length)
            : 0;

        return NextResponse.json({
            seed,

            marketOverview: {
                topicsAnalyzed: analyses.length,
                avgGapIndicator: avgGap,
                strongSignals: strongSignals.length,
                moderateSignals: moderateSignals.length
            },

            opportunities: analyses,

            topPicks: strongSignals.slice(0, 3),

            methodology: {
                gapIndicator: 'Ratio of demand signals (views, search interest, velocity) to supply signals (video count, quality videos)',
                supplyFloor: 'Minimum supply of 5 used to prevent inflated scores from low-data topics',
                signalStrength: {
                    strong: 'Good view averages, smaller channels dominating, measurable search interest',
                    moderate: 'Decent metrics but competition from larger channels or less certain demand',
                    weak: 'Low metrics - may indicate lack of demand, not opportunity'
                },
                channelSizeContext: 'Shows if niche is dominated by large (1M+), medium (100K+), small (10K+), or micro channels',
                limitations: [
                    'Gap indicator is a heuristic, not a prediction of success',
                    'High demand topics may still be hard to compete in if dominated by established creators',
                    'We cannot validate that making a video will capture the indicated demand'
                ]
            },

            insight: strongSignals.length > 0
                ? `Found ${strongSignals.length} topics with strong opportunity signals. Best: "${strongSignals[0].topic}" (mostly ${strongSignals[0].supply.dominantChannelSize} channels)`
                : moderateSignals.length > 0
                    ? `Found ${moderateSignals.length} moderate opportunities. Validate before heavy investment.`
                    : 'No strong gap signals detected. Try more specific topic angles.'
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
