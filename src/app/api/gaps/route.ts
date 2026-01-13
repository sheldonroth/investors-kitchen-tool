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
        searchInterest: number; // 0-100 from Trends
        velocityAvg: number;    // views per day
    };
    supply: {
        videoCount: number;
        qualityVideoCount: number;  // outliers with high velocity
        channelConcentration: number; // how dominated by few channels
        avgAge: number;  // days - older = stale supply
    };
    opportunityScore: number;  // The arbitrage signal
    opportunityGrade: string;  // A, B, C, D, F
    arbitrageSignal: string;   // Human readable insight
    sampleVideos: {
        title: string;
        views: number;
        velocity: number;
        thumbnail: string;
        id: string;
    }[];
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
}

async function analyzeTopicDepth(topic: string, regionCode: string): Promise<TopicAnalysis | null> {
    try {
        // 1. Get YouTube data for this topic
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: topic,
                type: 'video',
                maxResults: 25,
                regionCode,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 5) return null;

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const videos = statsResponse.data.items.map((item: {
            id: string;
            snippet: { title: string; channelId: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            statistics: { viewCount?: string };
        }) => {
            const views = parseInt(item.statistics.viewCount || '0', 10);
            const days = daysSinceUpload(item.snippet.publishedAt);
            return {
                id: item.id,
                title: item.snippet.title,
                channelId: item.snippet.channelId,
                views,
                velocity: Math.round(views / days),
                age: days,
                thumbnail: item.snippet.thumbnails.high?.url || ''
            };
        });

        // 2. Calculate DEMAND metrics
        const totalViews = videos.reduce((sum: number, v: { views: number }) => sum + v.views, 0);
        const avgViews = Math.round(totalViews / videos.length);
        const avgVelocity = Math.round(videos.reduce((sum: number, v: { velocity: number }) => sum + v.velocity, 0) / videos.length);

        // Get search interest from Trends (0-100)
        let searchInterest = 50; // default
        try {
            const interestData = await googleTrends.interestOverTime({ keyword: topic, geo: regionCode });
            const parsed = JSON.parse(interestData);
            const timelineData = parsed?.default?.timelineData || [];
            if (timelineData.length > 0) {
                const recentInterest = timelineData.slice(-4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                searchInterest = Math.round(recentInterest);
            }
        } catch {
            // Trends may fail, use default
        }

        // 3. Calculate SUPPLY metrics
        const videoCount = videos.length;

        // Quality videos = those with velocity > 2x average (outliers)
        const qualityThreshold = avgVelocity * 2;
        const qualityVideos = videos.filter((v: { velocity: number }) => v.velocity > qualityThreshold);
        const qualityVideoCount = qualityVideos.length;

        // Channel concentration (fewer unique channels = more dominated)
        const uniqueChannels = new Set(videos.map((v: { channelId: string }) => v.channelId)).size;
        const channelConcentration = Math.round((1 - uniqueChannels / videos.length) * 100);

        // Average age of content
        const avgAge = Math.round(videos.reduce((sum: number, v: { age: number }) => sum + v.age, 0) / videos.length);

        // 4. Calculate OPPORTUNITY SCORE (Content Arbitrage)
        // Formula: (Demand / Supply) adjusted for quality
        // High demand + low quality supply = HIGH opportunity

        const demandScore = (avgViews / 10000) * 0.4 + (searchInterest / 100) * 0.3 + (avgVelocity / 1000) * 0.3;
        const supplyScore = (videoCount / 25) * 0.3 + (qualityVideoCount / 10) * 0.5 + ((100 - channelConcentration) / 100) * 0.2;

        // Opportunity = Demand / Supply (higher is better)
        // Adjust for content freshness (old content = opportunity for new)
        const freshnessBonus = Math.min(avgAge / 180, 1) * 0.2; // Up to 20% bonus for stale content

        let opportunityRaw = (demandScore / Math.max(supplyScore, 0.1)) + freshnessBonus;
        const opportunityScore = Math.round(Math.min(100, opportunityRaw * 25));

        // Grade it
        const opportunityGrade = opportunityScore >= 80 ? 'A' :
            opportunityScore >= 65 ? 'B' :
                opportunityScore >= 50 ? 'C' :
                    opportunityScore >= 35 ? 'D' : 'F';

        // Generate arbitrage signal
        let arbitrageSignal = '';
        if (opportunityScore >= 80) {
            arbitrageSignal = '🔥 Strong Arbitrage: High demand, weak quality supply. Move fast.';
        } else if (opportunityScore >= 65) {
            arbitrageSignal = '📈 Good Opportunity: Demand exceeds supply. Differentiation recommended.';
        } else if (opportunityScore >= 50) {
            arbitrageSignal = '⚡ Moderate Gap: Some room to compete with right angle.';
        } else if (opportunityScore >= 35) {
            arbitrageSignal = '⚠️ Crowded Market: Supply meets demand. Need unique value prop.';
        } else {
            arbitrageSignal = '🛑 Oversupplied: Quality content already serves this market well.';
        }

        // Add specific insights
        if (qualityVideoCount <= 2 && avgViews > 50000) {
            arbitrageSignal += ' Few quality videos despite high views.';
        }
        if (avgAge > 180 && searchInterest > 50) {
            arbitrageSignal += ' Content is stale but interest remains.';
        }
        if (channelConcentration > 60) {
            arbitrageSignal += ' Market dominated by few players.';
        }

        return {
            topic,
            demand: {
                avgViews,
                totalViews,
                searchInterest,
                velocityAvg: avgVelocity
            },
            supply: {
                videoCount,
                qualityVideoCount,
                channelConcentration,
                avgAge
            },
            opportunityScore,
            opportunityGrade,
            arbitrageSignal,
            sampleVideos: videos.slice(0, 3).map((v: { title: string; views: number; velocity: number; thumbnail: string; id: string }) => ({
                title: v.title,
                views: v.views,
                velocity: v.velocity,
                thumbnail: v.thumbnail,
                id: v.id
            }))
        };

    } catch (error) {
        console.error(`Failed to analyze topic: ${topic}`, error);
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
        // 1. Get related topics to explore
        const relatedTopics: string[] = [seed];

        // Add autocomplete suggestions
        try {
            const autocompleteResponse = await axios.get(
                `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seed)}`
            );
            const matches = autocompleteResponse.data.toString().match(/\["([^"]+)"/g);
            if (matches) {
                const suggestions = matches.slice(1, 6).map((m: string) => m.replace(/\["|"/g, ''));
                relatedTopics.push(...suggestions);
            }
        } catch {
            // Autocomplete may fail
        }

        // Add Google Trends related queries
        try {
            const relatedQueries = await googleTrends.relatedQueries({ keyword: seed, geo: regionCode });
            const relatedData = JSON.parse(relatedQueries);
            const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];
            const top = relatedData?.default?.rankedList?.[0]?.rankedKeyword || [];

            rising.slice(0, 3).forEach((item: { query: string }) => {
                if (!relatedTopics.includes(item.query)) relatedTopics.push(item.query);
            });
            top.slice(0, 2).forEach((item: { query: string }) => {
                if (!relatedTopics.includes(item.query)) relatedTopics.push(item.query);
            });
        } catch {
            // Trends may fail
        }

        // Limit to avoid API quota issues
        const topicsToAnalyze = relatedTopics.slice(0, 8);

        // 2. Analyze each topic for arbitrage opportunity
        const analyses: TopicAnalysis[] = [];

        for (const topic of topicsToAnalyze) {
            const analysis = await analyzeTopicDepth(topic, regionCode);
            if (analysis) {
                analyses.push(analysis);
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 3. Sort by opportunity score (highest arbitrage first)
        analyses.sort((a, b) => b.opportunityScore - a.opportunityScore);

        // 4. Identify the best opportunities
        const topOpportunities = analyses.filter(a => a.opportunityScore >= 50);
        const marketOverview = {
            totalAnalyzed: analyses.length,
            averageOpportunity: Math.round(analyses.reduce((s, a) => s + a.opportunityScore, 0) / analyses.length),
            bestOpportunity: analyses[0]?.opportunityScore || 0,
            strongOpportunities: analyses.filter(a => a.opportunityGrade === 'A' || a.opportunityGrade === 'B').length
        };

        return NextResponse.json({
            seed,
            marketOverview,
            opportunities: analyses,
            topPicks: topOpportunities.slice(0, 3),
            investorInsight: topOpportunities.length >= 2
                ? `Found ${topOpportunities.length} undervalued content opportunities in this market.`
                : topOpportunities.length === 1
                    ? 'One viable opportunity identified. Consider the top pick.'
                    : 'Market appears fairly valued. Consider adjacent niches.'
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
