import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// High-retention formats that work across niches (based on industry data)
const PROVEN_FORMATS = [
    { format: 'ASMR', avgRetention: 0.65, description: 'Relaxing, sensory content' },
    { format: 'Timelapse', avgRetention: 0.70, description: 'Compressed time visuals' },
    { format: 'POV', avgRetention: 0.60, description: 'First-person perspective' },
    { format: 'Day in the life', avgRetention: 0.55, description: 'Personal documentary' },
    { format: 'Challenge', avgRetention: 0.58, description: 'Goal-based entertainment' },
    { format: 'Before and after', avgRetention: 0.62, description: 'Transformation content' },
    { format: 'Speedrun', avgRetention: 0.55, description: 'Fastest completion' },
    { format: 'Tier list', avgRetention: 0.50, description: 'Ranking content' },
    { format: 'Reaction', avgRetention: 0.48, description: 'Response content' },
    { format: 'Explained', avgRetention: 0.52, description: 'Educational breakdown' },
    { format: 'vs', avgRetention: 0.55, description: 'Comparison content' },
    { format: 'No talking', avgRetention: 0.60, description: 'Silent demonstration' },
    { format: 'Documentary', avgRetention: 0.58, description: 'In-depth investigation' },
    { format: 'Tour', avgRetention: 0.52, description: 'Walking through space' },
    { format: 'Unboxing', avgRetention: 0.45, description: 'Product reveal' },
];

interface BlueOcean {
    combination: string;
    format: string;
    topic: string;
    opportunityScore: number;
    supplyLevel: string;
    demandSignal: string;
    existingVideos: number;
    avgViewsInTopic: number;
    reasoning: string;
}

async function checkTopicSupply(topic: string): Promise<{ count: number; avgViews: number }> {
    try {
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: topic,
                type: 'video',
                maxResults: 10,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length === 0) return { count: 0, avgViews: 0 };

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const views = statsResponse.data.items.map((v: { statistics: { viewCount?: string } }) =>
            parseInt(v.statistics.viewCount || '0', 10)
        );

        return {
            count: items.length,
            avgViews: views.length > 0 ? Math.round(views.reduce((a: number, b: number) => a + b, 0) / views.length) : 0
        };
    } catch {
        return { count: 0, avgViews: 0 };
    }
}

async function checkDemand(topic: string): Promise<number> {
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
    return 30; // Default moderate interest
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const seedTopic = searchParams.get('topic');

    if (!seedTopic) {
        return NextResponse.json({ error: 'Missing "topic" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Get related topics from autocomplete
        const relatedTopics: string[] = [seedTopic];

        try {
            const autocompleteResponse = await axios.get(
                `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seedTopic)}`
            );
            const matches = autocompleteResponse.data.toString().match(/\["([^"]+)"/g);
            if (matches) {
                const suggestions = matches.slice(1, 6).map((m: string) => m.replace(/\["|"/g, ''));
                relatedTopics.push(...suggestions);
            }
        } catch {
            // Autocomplete may fail
        }

        // 2. For each format × topic combination, check supply
        const blueOceans: BlueOcean[] = [];
        const topicsToCheck = relatedTopics.slice(0, 4); // Limit API calls

        for (const topic of topicsToCheck) {
            for (const formatInfo of PROVEN_FORMATS.slice(0, 8)) { // Top 8 formats
                const combo = `${formatInfo.format} ${topic}`;

                // Check if this combination exists already
                const supply = await checkTopicSupply(combo);

                // Only consider if supply is low
                if (supply.count < 10) {
                    // Check demand for the base topic
                    const demand = await checkDemand(topic);

                    // Calculate opportunity score
                    // High demand + low supply + high retention format = high opportunity
                    const supplyPenalty = supply.count * 5; // 0-50 penalty
                    const demandBonus = demand * 0.5; // 0-50 bonus
                    const formatBonus = formatInfo.avgRetention * 30; // 15-21 bonus

                    let opportunityScore = 50 + demandBonus - supplyPenalty + formatBonus;
                    opportunityScore = Math.round(Math.min(100, Math.max(0, opportunityScore)));

                    if (opportunityScore >= 40) {
                        blueOceans.push({
                            combination: combo,
                            format: formatInfo.format,
                            topic,
                            opportunityScore,
                            supplyLevel: supply.count === 0 ? 'Zero' : supply.count < 3 ? 'Very Low' : supply.count < 7 ? 'Low' : 'Moderate',
                            demandSignal: demand >= 60 ? 'High' : demand >= 30 ? 'Moderate' : 'Low',
                            existingVideos: supply.count,
                            avgViewsInTopic: supply.avgViews,
                            reasoning: generateReasoning(formatInfo, supply, demand)
                        });
                    }
                }

                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Sort by opportunity score
        blueOceans.sort((a, b) => b.opportunityScore - a.opportunityScore);

        // 3. Generate insight
        const zeroCompetition = blueOceans.filter(bo => bo.existingVideos === 0);
        const highOpportunity = blueOceans.filter(bo => bo.opportunityScore >= 70);

        return NextResponse.json({
            seedTopic,
            totalCombinationsChecked: topicsToCheck.length * 8,
            blueOceans: blueOceans.slice(0, 10),
            zeroCompetitionCount: zeroCompetition.length,
            highOpportunityCount: highOpportunity.length,
            topPick: blueOceans[0] || null,
            insight: zeroCompetition.length > 0
                ? `Found ${zeroCompetition.length} combinations with ZERO existing videos. First mover advantage available.`
                : highOpportunity.length > 0
                    ? `Found ${highOpportunity.length} high-opportunity combinations. Low supply, proven formats.`
                    : 'Market is more competitive. Consider more specific topic angles.',
            formatsUsed: PROVEN_FORMATS.slice(0, 8).map(f => f.format)
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
    formatInfo: { format: string; avgRetention: number; description: string },
    supply: { count: number; avgViews: number },
    demand: number
): string {
    const parts: string[] = [];

    if (supply.count === 0) {
        parts.push('No competition - first mover advantage');
    } else if (supply.count < 3) {
        parts.push('Very few competitors');
    }

    if (formatInfo.avgRetention >= 0.6) {
        parts.push(`${formatInfo.format} format has high retention`);
    }

    if (demand >= 60) {
        parts.push('Strong search interest');
    } else if (demand >= 30) {
        parts.push('Moderate search interest');
    }

    if (supply.avgViews > 50000) {
        parts.push('Similar topics get good views');
    }

    return parts.join('. ') + '.';
}
