import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface NichePattern {
    pattern: string;
    examples: string[];
    prevalence: number;
    avgViews: number;
}

interface TransferResult {
    pattern: string;
    sourceNiche: string;
    targetNiche: string;
    applicability: 'high' | 'medium' | 'low';
    adaptedExample: string;
    reasoning: string;
}

function extractTitlePatterns(titles: string[]): NichePattern[] {
    const patterns: Record<string, { count: number; example: string; totalViews: number; examples: string[] }> = {};

    // Pattern extraction rules
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

    titles.forEach((title) => {
        patternTests.forEach(({ name, test }) => {
            if (test(title)) {
                if (!patterns[name]) {
                    patterns[name] = { count: 0, example: title, totalViews: 0, examples: [] };
                }
                patterns[name].count++;
                patterns[name].examples.push(title);
            }
        });
    });

    return Object.entries(patterns)
        .map(([pattern, data]) => ({
            pattern,
            examples: data.examples.slice(0, 3),
            prevalence: Math.round((data.count / titles.length) * 100),
            avgViews: 0 // Would need views data to calculate
        }))
        .filter(p => p.prevalence >= 10) // At least 10% prevalence
        .sort((a, b) => b.prevalence - a.prevalence);
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
        // 1. Fetch top videos from source niche
        const sourceResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: sourceNiche,
                type: 'video',
                maxResults: 30,
                order: 'viewCount',
                key: YOUTUBE_API_KEY
            }
        });

        const sourceTitles = sourceResponse.data.items.map((item: { snippet: { title: string } }) => item.snippet.title);

        // 2. Fetch top videos from target niche
        const targetResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: targetNiche,
                type: 'video',
                maxResults: 30,
                order: 'viewCount',
                key: YOUTUBE_API_KEY
            }
        });

        const targetTitles = targetResponse.data.items.map((item: { snippet: { title: string } }) => item.snippet.title);

        // 3. Extract patterns from both niches
        const sourcePatterns = extractTitlePatterns(sourceTitles);
        const targetPatterns = extractTitlePatterns(targetTitles);

        // 4. Find transferable patterns (in source but not in target)
        const targetPatternNames = new Set(targetPatterns.map(p => p.pattern));
        const transferablePatterns = sourcePatterns.filter(p => !targetPatternNames.has(p.pattern));

        // 5. Use AI to generate adapted examples
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const transferResults: TransferResult[] = [];

        if (transferablePatterns.length > 0) {
            const patternsWithExamples = transferablePatterns.slice(0, 5).map(p =>
                `Pattern: "${p.pattern}" (${p.prevalence}% in ${sourceNiche})\nExamples: ${p.examples.join('; ')}`
            ).join('\n\n');

            const prompt = `You are analyzing YouTube title patterns from "${sourceNiche}" to adapt them for "${targetNiche}".

These patterns work well in ${sourceNiche} but are UNDERUSED in ${targetNiche}:

${patternsWithExamples}

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
                    transferResults.push({
                        pattern: t.pattern,
                        sourceNiche,
                        targetNiche,
                        applicability: t.applicability as 'high' | 'medium' | 'low',
                        adaptedExample: t.adaptedExample,
                        reasoning: t.reasoning
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
                commonPatterns: commonPatterns.length
            },

            transferOpportunities: transferResults.sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.applicability] - order[b.applicability];
            }),

            sourcePatterns: sourcePatterns.slice(0, 6).map(p => ({
                pattern: p.pattern,
                prevalence: `${p.prevalence}%`,
                example: p.examples[0]
            })),

            existingInTarget: targetPatterns.slice(0, 6).map(p => ({
                pattern: p.pattern,
                prevalence: `${p.prevalence}%`,
                example: p.examples[0]
            })),

            validated: commonPatterns.slice(0, 5).map(p => ({
                pattern: p.pattern,
                note: 'Works in both niches - safe to use'
            })),

            methodology: {
                approach: 'Pattern extraction from top-performing titles, cross-referenced between niches',
                limitations: [
                    'Patterns based on title structure, not content quality',
                    'Transfer success not guaranteed - audience may differ',
                    'Limited to 30 videos per niche for pattern detection',
                    'AI adaptations are suggestions, not proven'
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
