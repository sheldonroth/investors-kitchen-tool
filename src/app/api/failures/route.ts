import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface FailurePattern {
    pattern: string;
    failureRate: number;
    avgUnderperformance: number;
    examples: string[];
    advice: string;
}

interface VideoAnalysis {
    id: string;
    title: string;
    views: number;
    channelSubs: number;
    expectedViews: number;
    actualToExpected: number;
    isUnderperformer: boolean;
    daysOld: number;
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function extractTitlePatterns(title: string): string[] {
    const patterns: string[] = [];

    // Numeric patterns
    if (/^\d+/.test(title)) patterns.push('starts_with_number');
    if (/\d+ ways/i.test(title)) patterns.push('X_ways');
    if (/\d+ tips/i.test(title)) patterns.push('X_tips');
    if (/\d+ things/i.test(title)) patterns.push('X_things');
    if (/\d+ reasons/i.test(title)) patterns.push('X_reasons');

    // Format patterns
    if (/how to/i.test(title)) patterns.push('how_to');
    if (/what is/i.test(title)) patterns.push('what_is');
    if (/why /i.test(title)) patterns.push('why');
    if (/\?/.test(title)) patterns.push('question');
    if (/!/.test(title)) patterns.push('exclamation');
    if (/\|/.test(title)) patterns.push('pipe_separator');
    if (/-/.test(title)) patterns.push('dash_separator');

    // Hook patterns
    if (/beginner/i.test(title)) patterns.push('beginner');
    if (/easy/i.test(title)) patterns.push('easy');
    if (/simple/i.test(title)) patterns.push('simple');
    if (/complete guide/i.test(title)) patterns.push('complete_guide');
    if (/ultimate/i.test(title)) patterns.push('ultimate');
    if (/best/i.test(title)) patterns.push('best');
    if (/top \d+/i.test(title)) patterns.push('top_X');
    if (/worst/i.test(title)) patterns.push('worst');
    if (/never/i.test(title)) patterns.push('never');
    if (/always/i.test(title)) patterns.push('always');
    if (/secret/i.test(title)) patterns.push('secret');
    if (/hack/i.test(title)) patterns.push('hack');
    if (/mistake/i.test(title)) patterns.push('mistake');
    if (/wrong/i.test(title)) patterns.push('wrong');
    if (/truth/i.test(title)) patterns.push('truth');
    if (/revealed/i.test(title)) patterns.push('revealed');
    if (/shocking/i.test(title)) patterns.push('shocking');

    // Length patterns
    const wordCount = title.split(/\s+/).length;
    if (wordCount <= 3) patterns.push('short_title');
    else if (wordCount >= 10) patterns.push('long_title');

    // Case patterns
    if (/[A-Z]{4,}/.test(title)) patterns.push('all_caps_words');
    if (title === title.toUpperCase()) patterns.push('all_caps_title');

    return patterns;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');
    const regionCode = searchParams.get('region') || 'US';

    if (!niche) {
        return NextResponse.json({ error: 'Missing "niche" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Get videos in this niche
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: niche,
                type: 'video',
                maxResults: 50,
                regionCode,
                order: 'relevance',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 10) {
            return NextResponse.json({ error: 'Not enough videos to analyze' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId);

        // 2. Get video statistics
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds.join(','),
                key: YOUTUBE_API_KEY
            }
        });

        // 3. Get channel statistics for each video
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

        // 4. Analyze each video
        const analyses: VideoAnalysis[] = [];
        const patternCounts: Record<string, { total: number; underperformers: number; totalRatio: number }> = {};

        statsResponse.data.items.forEach((item: {
            id: string;
            snippet: { title: string; channelId: string; publishedAt: string };
            statistics: { viewCount?: string };
        }) => {
            const views = parseInt(item.statistics.viewCount || '0', 10);
            const subs = channelSubs[item.snippet.channelId] || 1;
            const daysOld = daysSinceUpload(item.snippet.publishedAt);

            // Expected views based on subscriber count (rough heuristic)
            // Small channels: ~10% of subs, Big channels: ~5% of subs
            const expectedViewsRatio = subs > 100000 ? 0.03 : subs > 10000 ? 0.05 : 0.10;
            const expectedViews = Math.max(subs * expectedViewsRatio, 1000);

            const actualToExpected = views / expectedViews;
            const isUnderperformer = actualToExpected < 0.5 && daysOld > 7; // <50% of expected after 1 week

            const analysis: VideoAnalysis = {
                id: item.id,
                title: item.snippet.title,
                views,
                channelSubs: subs,
                expectedViews: Math.round(expectedViews),
                actualToExpected: Math.round(actualToExpected * 100) / 100,
                isUnderperformer,
                daysOld
            };
            analyses.push(analysis);

            // Track patterns
            const patterns = extractTitlePatterns(item.snippet.title);
            patterns.forEach(pattern => {
                if (!patternCounts[pattern]) {
                    patternCounts[pattern] = { total: 0, underperformers: 0, totalRatio: 0 };
                }
                patternCounts[pattern].total++;
                patternCounts[pattern].totalRatio += actualToExpected;
                if (isUnderperformer) {
                    patternCounts[pattern].underperformers++;
                }
            });
        });

        // 5. Identify failure patterns (patterns with high underperformance rate)
        const failurePatterns: FailurePattern[] = [];

        Object.entries(patternCounts)
            .filter(([_, data]) => data.total >= 3) // Need at least 3 examples
            .forEach(([pattern, data]) => {
                const failureRate = data.underperformers / data.total;
                const avgPerformance = data.totalRatio / data.total;

                // Consider it a failure pattern if >40% underperform OR avg performance <0.7
                if (failureRate > 0.4 || avgPerformance < 0.7) {
                    const examples = analyses
                        .filter(a => extractTitlePatterns(a.title).includes(pattern) && a.isUnderperformer)
                        .slice(0, 3)
                        .map(a => a.title);

                    failurePatterns.push({
                        pattern: pattern.replace(/_/g, ' ').toUpperCase(),
                        failureRate: Math.round(failureRate * 100),
                        avgUnderperformance: Math.round((1 - avgPerformance) * 100),
                        examples,
                        advice: generateAdvice(pattern)
                    });
                }
            });

        // Sort by failure rate
        failurePatterns.sort((a, b) => b.failureRate - a.failureRate);

        // 6. Calculate overall statistics
        const underperformers = analyses.filter(a => a.isUnderperformer);
        const underperformanceRate = Math.round((underperformers.length / analyses.length) * 100);

        return NextResponse.json({
            niche,
            totalAnalyzed: analyses.length,
            underperformerCount: underperformers.length,
            underperformanceRate,
            failurePatterns: failurePatterns.slice(0, 8),
            topUnderperformers: underperformers
                .sort((a, b) => a.actualToExpected - b.actualToExpected)
                .slice(0, 5)
                .map(a => ({
                    title: a.title,
                    views: a.views,
                    expectedViews: a.expectedViews,
                    performance: `${Math.round(a.actualToExpected * 100)}% of expected`,
                    videoId: a.id
                })),
            insight: failurePatterns.length > 0
                ? `Avoid these ${failurePatterns.length} title patterns to reduce failure risk by up to ${failurePatterns[0].failureRate}%`
                : 'No clear failure patterns detected in this niche'
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

function generateAdvice(pattern: string): string {
    const adviceMap: Record<string, string> = {
        'easy': 'Viewers may doubt "easy" claims. Be specific about why it\'s easy.',
        'simple': 'Similar to "easy", can feel like clickbait. Show proof in thumbnail.',
        'beginner': 'Oversaturated in many niches. Try "for busy people" or specific personas.',
        'how_to': 'Extremely competitive. Add unique angle or specific outcome.',
        'complete_guide': 'Often too long for retention. Consider splitting into series.',
        'ultimate': 'Overused word. Show proof of comprehensiveness instead.',
        'best': 'Viewers expect objectivity. Back up with data or credentials.',
        'top_X': 'Format fatigue. Most will scroll past without compelling thumbnail.',
        'long_title': 'Gets cut off in search. Front-load the hook.',
        'short_title': 'May lack context for search. Add descriptive keywords.',
        'all_caps_words': 'Can feel spammy. Use sparingly for emphasis.',
        'all_caps_title': 'Reads as shouting. Avoid entirely.',
        'question': 'Works well for curiosity gap, but needs compelling answer preview.',
        'X_ways': 'Listicle fatigue. Consider unique framing.',
        'X_tips': 'Very competitive format. Need stronger hook.',
        'X_things': 'Generic. Be more specific about the promise.',
        'hack': 'Word has lost impact. Try "shortcut" or show result.',
        'secret': 'Can feel clickbaity. Deliver genuine value.',
        'shocking': 'Usually doesn\'t live up to the hype. Avoid unless truly surprising.',
        'mistake': 'Works well but oversaturated. Be specific about which mistake.',
        'truth': 'Implies controversy. Make sure content delivers.',
        'never': 'Absolute language can backfire if nuance is needed.',
        'always': 'Absolute language can backfire if nuance is needed.',
    };

    return adviceMap[pattern] || 'Consider alternative framing to stand out.';
}
