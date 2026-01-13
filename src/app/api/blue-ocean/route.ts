import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Proven formats based on observable patterns (NO FAKE RETENTION RATES)
const CONTENT_FORMATS = [
    { format: 'ASMR', description: 'Relaxing, sensory content' },
    { format: 'Timelapse', description: 'Compressed time visuals' },
    { format: 'POV', description: 'First-person perspective' },
    { format: 'Day in the life', description: 'Personal documentary' },
    { format: 'Challenge', description: 'Goal-based entertainment' },
    { format: 'Before and after', description: 'Transformation content' },
    { format: 'Speedrun', description: 'Fastest completion' },
    { format: 'Tier list', description: 'Ranking content' },
    { format: 'Explained', description: 'Educational breakdown' },
    { format: 'vs', description: 'Comparison content' },
    { format: 'No talking', description: 'Silent demonstration' },
    { format: 'Tour', description: 'Walking through space' },
];

interface LowCompetitionCombination {
    combination: string;
    format: string;
    topic: string;
    existingVideos: number;
    avgViewsIfExists: number;
    baseDemand: number;
    opportunityType: 'untested' | 'underserved' | 'emerging';
    riskLevel: 'high' | 'medium' | 'low';
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

async function checkBaseDemand(topic: string): Promise<number> {
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
    return 0; // Return 0 if we can't measure (honest)
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
        // 1. Check base demand for the seed topic first
        const baseDemand = await checkBaseDemand(seedTopic);

        // 2. Get related topics from autocomplete
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

        // 3. For each format × topic combination, check supply
        const combinations: LowCompetitionCombination[] = [];
        const topicsToCheck = relatedTopics.slice(0, 4);

        for (const topic of topicsToCheck) {
            // Check demand for this specific topic
            const topicDemand = topic === seedTopic ? baseDemand : await checkBaseDemand(topic);

            for (const formatInfo of CONTENT_FORMATS.slice(0, 8)) {
                const combo = `${formatInfo.format} ${topic}`;

                const supply = await checkTopicSupply(combo);

                // Determine opportunity type and risk
                let opportunityType: 'untested' | 'underserved' | 'emerging';
                let riskLevel: 'high' | 'medium' | 'low';
                let reasoning: string;

                if (supply.count === 0) {
                    opportunityType = 'untested';
                    // HONEST: Zero videos could mean no demand OR untapped opportunity
                    riskLevel = topicDemand >= 30 ? 'medium' : 'high';
                    reasoning = topicDemand >= 30
                        ? `No existing videos but base topic has ${topicDemand}/100 search interest. Worth testing.`
                        : `No existing videos AND low measurable demand. High risk - may indicate no audience.`;
                } else if (supply.count < 5) {
                    opportunityType = 'underserved';
                    riskLevel = supply.avgViews >= 10000 ? 'low' : topicDemand >= 30 ? 'medium' : 'high';
                    reasoning = supply.avgViews >= 10000
                        ? `Only ${supply.count} videos exist, averaging ${supply.avgViews.toLocaleString()} views. Proven demand, low supply.`
                        : `Few videos exist (${supply.count}). ${topicDemand >= 30 ? 'Base topic has interest.' : 'Demand unconfirmed.'}`;
                } else if (supply.count < 10) {
                    opportunityType = 'emerging';
                    riskLevel = supply.avgViews >= 10000 ? 'low' : 'medium';
                    reasoning = `${supply.count} videos averaging ${supply.avgViews.toLocaleString()} views. Room for quality entries.`;
                } else {
                    // Skip saturated combinations
                    continue;
                }

                combinations.push({
                    combination: combo,
                    format: formatInfo.format,
                    topic,
                    existingVideos: supply.count,
                    avgViewsIfExists: supply.avgViews,
                    baseDemand: topicDemand,
                    opportunityType,
                    riskLevel,
                    reasoning
                });

                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Sort by risk level (low first) and then by existing proof (avgViews)
        combinations.sort((a, b) => {
            const riskOrder = { low: 0, medium: 1, high: 2 };
            if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
                return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
            }
            return b.avgViewsIfExists - a.avgViewsIfExists;
        });

        // Categorize results
        const lowRisk = combinations.filter(c => c.riskLevel === 'low');
        const mediumRisk = combinations.filter(c => c.riskLevel === 'medium');
        const highRisk = combinations.filter(c => c.riskLevel === 'high');

        return NextResponse.json({
            seedTopic,
            baseDemand,
            totalCombinationsChecked: topicsToCheck.length * 8,

            // REFRAMED: "Low Competition Experiments" not "Blue Oceans"
            combinations: combinations.slice(0, 12),

            // Categorized by risk
            byRisk: {
                low: lowRisk.slice(0, 4),
                medium: mediumRisk.slice(0, 4),
                high: highRisk.slice(0, 4)
            },

            summary: {
                lowRiskCount: lowRisk.length,
                mediumRiskCount: mediumRisk.length,
                highRiskCount: highRisk.length
            },

            // ADDED: Honest methodology
            methodology: {
                approach: 'Combines content formats with topic variations to find low-supply combinations',
                riskLevels: {
                    low: 'Proven demand exists (existing videos have good views)',
                    medium: 'Some signal exists but unproven',
                    high: 'No existing videos AND no measurable demand - may not work'
                },
                disclaimer: 'Low competition may indicate untapped opportunity OR lack of audience demand. We cannot distinguish with certainty.'
            },

            insight: lowRisk.length > 0
                ? `Found ${lowRisk.length} low-risk combinations with proven demand. Best bet: "${lowRisk[0].combination}"`
                : mediumRisk.length > 0
                    ? `Found ${mediumRisk.length} medium-risk experiments worth testing. Validate demand before investing heavily.`
                    : 'No low-competition combinations found with proven demand. Consider a more specific topic angle.',

            formatsUsed: CONTENT_FORMATS.slice(0, 8).map(f => f.format)
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
