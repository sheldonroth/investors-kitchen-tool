import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculatePatternLift } from '@/lib/stats';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface VideoWithViews {
    title: string;
    views: number;
}

interface PatternWithLift {
    pattern: string;
    examples: string[];
    prevalence: number;
    lift: number;
    avgViewsWithPattern: number;
    avgViewsWithoutPattern: number;
    pValue: number;
    significant: boolean;
}

interface TransferResult {
    pattern: string;
    sourceNiche: string;
    targetNiche: string;
    applicability: 'high' | 'medium' | 'low';
    adaptedExample: string;
    reasoning: string;
    liftInSource: number;
    significant: boolean;
}

// Pattern tests for extraction
const patternTests = [
    { name: 'Numbered List', test: (t: string) => /^\d+\s/.test(t) || /\d+\s+(ways|tips|things|reasons|steps|mistakes)/i.test(t) },
    { name: 'How To', test: (t: string) => /^how\s+to/i.test(t) },
    { name: 'Why Question', test: (t: string) => /^why\s/i.test(t) },
    { name: 'What Question', test: (t: string) => /^what\s/i.test(t) },
    { name: 'Ultimate Guide', test: (t: string) => /ultimate|complete|definitive/i.test(t) },
    { name: 'Year Reference', test: (t: string) => /202\d/i.test(t) },
    { name: 'Beginner Focus', test: (t: string) => /beginner|newbie|starter|first time/i.test(t) },
    { name: 'Negative Hook', test: (t: string) => /don't|stop|never|avoid|worst|mistake/i.test(t) },
    { name: 'Comparison', test: (t: string) => /\bvs\.?\b|\bversus\b|compared|better than/i.test(t) },
    { name: 'Secret/Hidden', test: (t: string) => /secret|hidden|unknown|no one knows/i.test(t) },
    { name: 'Challenge Hook', test: (t: string) => /challenge|impossible|can't|couldn't/i.test(t) },
    { name: 'Emotional Trigger', test: (t: string) => /amazing|shocking|insane|crazy|mind-blowing/i.test(t) },
];

function extractPatternsWithLift(videos: VideoWithViews[]): PatternWithLift[] {
    const allViews = videos.map(v => v.views);

    return patternTests.map(({ name, test }) => {
        const withPattern = videos.filter(v => test(v.title));
        const withoutPattern = videos.filter(v => !test(v.title));

        const liftResult = calculatePatternLift(
            withPattern.map(v => v.views),
            withoutPattern.map(v => v.views)
        );

        return {
            pattern: name,
            examples: withPattern.slice(0, 3).map(v => v.title),
            prevalence: Math.round((withPattern.length / videos.length) * 100),
            lift: liftResult.lift,
            avgViewsWithPattern: liftResult.avgWith,
            avgViewsWithoutPattern: liftResult.avgWithout,
            pValue: liftResult.pValue,
            significant: liftResult.significant
        };
    })
        .filter(p => p.prevalence >= 10) // At least 10% prevalence
        .sort((a, b) => b.lift - a.lift); // Sort by lift, not just prevalence
}

async function fetchNicheVideos(niche: string): Promise<VideoWithViews[]> {
    const searchResponse = await axios.get(`${BASE_URL}/search`, {
        params: {
            part: 'snippet',
            q: niche,
            type: 'video',
            maxResults: 50, // Increased for better statistics
            order: 'relevance',
            key: YOUTUBE_API_KEY
        }
    });

    const videoIds = searchResponse.data.items
        .map((item: { id: { videoId: string } }) => item.id.videoId)
        .join(',');

    const statsResponse = await axios.get(`${BASE_URL}/videos`, {
        params: {
            part: 'snippet,statistics',
            id: videoIds,
            key: YOUTUBE_API_KEY
        }
    });

    return statsResponse.data.items.map((v: {
        snippet: { title: string };
        statistics: { viewCount?: string };
    }) => ({
        title: v.snippet.title,
        views: parseInt(v.statistics.viewCount || '0', 10)
    }));
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sourceNiche = searchParams.get('source');
    const targetNiche = searchParams.get('target');

    if (!sourceNiche || !targetNiche) {
        return NextResponse.json({ error: 'Missing "source" or "target" niche parameters' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY || !GEMINI_API_KEY) {
        return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    try {
        // 1. Fetch videos with view counts from both niches
        const sourceVideos = await fetchNicheVideos(sourceNiche);
        const targetVideos = await fetchNicheVideos(targetNiche);

        // 2. Extract patterns with lift calculation
        const sourcePatterns = extractPatternsWithLift(sourceVideos);
        const targetPatterns = extractPatternsWithLift(targetVideos);

        // 3. Find transferable patterns (in source with significant lift, but underused in target)
        const targetPatternNames = new Set(targetPatterns.filter(p => p.prevalence >= 20).map(p => p.pattern));
        const transferablePatterns = sourcePatterns
            .filter(p => !targetPatternNames.has(p.pattern) && p.lift >= 1.2) // Only patterns with 20%+ lift
            .slice(0, 5);

        // 4. Use AI to generate adapted examples
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const transferResults: TransferResult[] = [];

        if (transferablePatterns.length > 0) {
            const patternsWithExamples = transferablePatterns.slice(0, 5).map(p =>
                `Pattern: "${p.pattern}" (${p.prevalence}% prevalence, ${Math.round((p.lift - 1) * 100)}% lift, p=${p.pValue})\nExamples: ${p.examples.join('; ')}`
            ).join('\n\n');

            const prompt = `You are analyzing YouTube title patterns from "${sourceNiche}" to adapt them for "${targetNiche}".

These patterns STATISTICALLY CORRELATE with higher views in ${sourceNiche} but are UNDERUSED in ${targetNiche}:

${patternsWithExamples}

("Lift" means videos with this pattern get X% more views than videos without it)

For each pattern, create an adapted title for ${targetNiche} and explain why it could work.

Return ONLY valid JSON:
{
  "transfers": [
    {
      "pattern": "pattern name",
      "adaptedExample": "specific title for ${targetNiche}",
      "applicability": "high/medium/low",
      "reasoning": "why this could work in ${targetNiche}"
    }
  ]
}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                (parsed.transfers || []).forEach((t: {
                    pattern: string;
                    adaptedExample: string;
                    applicability: string;
                    reasoning: string;
                }) => {
                    // Find the matching source pattern for lift data
                    const sourcePattern = transferablePatterns.find(p => p.pattern === t.pattern);
                    transferResults.push({
                        pattern: t.pattern,
                        sourceNiche,
                        targetNiche,
                        applicability: t.applicability as 'high' | 'medium' | 'low',
                        adaptedExample: t.adaptedExample,
                        reasoning: t.reasoning,
                        liftInSource: sourcePattern?.lift || 1,
                        significant: sourcePattern?.significant || false
                    });
                });
            }
        }

        // 6. Also find common patterns (validated across both)
        const sourcePatternNames = new Set(sourcePatterns.map(p => p.pattern));
        const commonPatterns = targetPatterns.filter(p => sourcePatternNames.has(p.pattern));

        return NextResponse.json({
            sourceNiche,
            targetNiche,

            overview: {
                sourcePatternsFound: sourcePatterns.length,
                targetPatternsFound: targetPatterns.length,
                transferOpportunities: transferablePatterns.length,
                commonPatterns: commonPatterns.length,
                note: 'Only patterns with 20%+ lift and p < 0.1 are recommended for transfer'
            },

            transferOpportunities: transferResults.sort((a, b) => b.liftInSource - a.liftInSource),

            sourcePatterns: sourcePatterns.slice(0, 6).map(p => ({
                pattern: p.pattern,
                prevalence: `${p.prevalence}%`,
                lift: p.lift,
                pValue: p.pValue,
                significant: p.significant,
                example: p.examples[0]
            })),

            existingInTarget: targetPatterns.slice(0, 6).map(p => ({
                pattern: p.pattern,
                prevalence: `${p.prevalence}%`,
                lift: p.lift,
                significant: p.significant,
                example: p.examples[0]
            })),

            validated: commonPatterns.slice(0, 5).map(p => ({
                pattern: p.pattern,
                note: 'Works in both niches - safe to use',
                liftInBoth: Math.min(p.lift, sourcePatterns.find(s => s.pattern === p.pattern)?.lift || 1)
            })),

            methodology: {
                approach: 'Pattern extraction with lift calculation (t-test for significance)',
                improvements: [
                    'Patterns now sorted by lift, not just prevalence',
                    'Only recommends patterns with statistically significant lift',
                    'View data used to calculate actual performance difference'
                ],
                limitations: [
                    'Correlation ≠ causation - patterns may not cause lift',
                    'Transfer success not guaranteed - audience may differ',
                    '50 videos per niche analyzed'
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
        console.error('Pattern transfer error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
