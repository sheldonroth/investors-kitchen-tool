import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface TitlePattern {
    pattern: string;
    prevalence: number;
    avgZScore: number;
    sampleSize: number;
    weight: number;
}

interface TitleCandidate {
    title: string;
    score: number;
    breakdown: {
        patternMatch: number;
        saturationPenalty: number;
        lengthScore: number;
        hookBonus: number;
    };
    confidence: number;
    step: number;
}

interface WalkResult {
    input: string;
    bestTitle: TitleCandidate;
    walkPath: TitleCandidate[];
    methodology: {
        algorithm: string;
        fitnessFunction: string;
        iterations: number;
        acceptanceCriteria: string;
        limitations: string[];
    };
    patterns: {
        positive: TitlePattern[];
        negative: TitlePattern[];
    };
    statistics: {
        sampleSize: number;
        outliersAnalyzed: number;
        patternConfidence: string;
    };
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

// Extract features from a title
function extractTitleFeatures(title: string): Record<string, boolean | number> {
    return {
        hasNumber: /\d/.test(title),
        hasQuestion: /\?/.test(title),
        hasExclamation: /!/.test(title),
        hasPipe: /\|/.test(title),
        hasDash: /-/.test(title),
        hasColon: /:/.test(title),
        hasParens: /\(|\)/.test(title),
        hasQuotes: /"/.test(title),
        hasAllCaps: /[A-Z]{3,}/.test(title),
        startsWithNumber: /^\d/.test(title),
        startsWithHow: /^how/i.test(title),
        startsWithWhy: /^why/i.test(title),
        startsWithWhat: /^what/i.test(title),
        hasListFormat: /\d+\s+(ways|tips|things|reasons|steps|mistakes)/i.test(title),
        hasBeginner: /beginner/i.test(title),
        hasUltimate: /ultimate/i.test(title),
        hasComplete: /complete/i.test(title),
        hasGuide: /guide/i.test(title),
        hasSecret: /secret/i.test(title),
        hasTruth: /truth/i.test(title),
        hasNever: /never/i.test(title),
        hasAlways: /always/i.test(title),
        hasMistake: /mistake/i.test(title),
        hasEasy: /easy/i.test(title),
        hasSimple: /simple/i.test(title),
        hasFast: /fast/i.test(title),
        hasYear: /202\d/i.test(title),
        wordCount: title.split(/\s+/).length,
        charCount: title.length,
    };
}

// Generate title mutations
function generateMutations(title: string, topWords: string[], hookWords: string[]): string[] {
    const mutations: string[] = [];
    const words = title.split(/\s+/);

    // Mutation 1: Add number prefix
    if (!/^\d/.test(title)) {
        mutations.push(`5 ${title}`);
        mutations.push(`7 ${title}`);
        mutations.push(`10 ${title}`);
    }

    // Mutation 2: Add question mark
    if (!title.includes('?')) {
        mutations.push(`${title}?`);
        mutations.push(`Why ${title}?`);
        mutations.push(`What is ${title}?`);
    }

    // Mutation 3: Add year
    if (!/202\d/.test(title)) {
        mutations.push(`${title} (2024)`);
        mutations.push(`${title} in 2024`);
    }

    // Mutation 4: Add hook words
    hookWords.forEach(hook => {
        if (!title.toLowerCase().includes(hook.toLowerCase())) {
            mutations.push(`${hook} ${title}`);
            mutations.push(`${title}: ${hook}`);
        }
    });

    // Mutation 5: Replace generic words with top performer words
    topWords.forEach(word => {
        if (!title.toLowerCase().includes(word.toLowerCase()) && words.length > 3) {
            // Replace first or last word
            const newWords1 = [...words];
            newWords1[0] = word.charAt(0).toUpperCase() + word.slice(1);
            mutations.push(newWords1.join(' '));

            const newWords2 = [...words];
            newWords2[newWords2.length - 1] = word;
            mutations.push(newWords2.join(' '));
        }
    });

    // Mutation 6: Reorder words
    if (words.length >= 3) {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        mutations.push(shuffled.join(' '));
    }

    // Mutation 7: Add list format
    if (!/\d+\s+(ways|tips|things)/.test(title)) {
        mutations.push(`5 Ways to ${title}`);
        mutations.push(`${title}: 7 Tips`);
    }

    // Mutation 8: Remove words (if too long)
    if (words.length > 6) {
        const shorter = words.slice(0, -2).join(' ');
        mutations.push(shorter);
    }

    // Filter out too long/short titles
    return mutations.filter(m => m.length >= 20 && m.length <= 80);
}

// Score a title based on learned patterns
function scoreTitleAgainstPatterns(
    title: string,
    positivePatterns: TitlePattern[],
    negativePatterns: TitlePattern[],
    optimalLength: { min: number; max: number },
    avgZScore: number
): { score: number; breakdown: { patternMatch: number; saturationPenalty: number; lengthScore: number; hookBonus: number }; confidence: number } {
    const features = extractTitleFeatures(title);

    // Pattern match score (0-40)
    let patternMatch = 0;
    let matchedPatterns = 0;
    positivePatterns.forEach(p => {
        const featureKey = p.pattern;
        if (features[featureKey] === true || (typeof features[featureKey] === 'number' && features[featureKey] > 0)) {
            patternMatch += p.weight * (p.avgZScore / Math.max(avgZScore, 1));
            matchedPatterns++;
        }
    });
    patternMatch = Math.min(40, patternMatch);

    // Saturation penalty (0-20)
    let saturationPenalty = 0;
    negativePatterns.forEach(p => {
        const featureKey = p.pattern;
        if (features[featureKey] === true) {
            saturationPenalty += p.weight;
        }
    });
    saturationPenalty = Math.min(20, saturationPenalty);

    // Length score (0-20)
    const wordCount = features.wordCount as number;
    const charCount = features.charCount as number;
    let lengthScore = 20;
    if (wordCount < optimalLength.min) lengthScore -= (optimalLength.min - wordCount) * 3;
    if (wordCount > optimalLength.max) lengthScore -= (wordCount - optimalLength.max) * 3;
    if (charCount > 60) lengthScore -= 5;
    if (charCount < 25) lengthScore -= 5;
    lengthScore = Math.max(0, lengthScore);

    // Hook bonus (0-20)
    let hookBonus = 0;
    if (features.hasNumber) hookBonus += 5;
    if (features.hasQuestion) hookBonus += 5;
    if (features.startsWithNumber) hookBonus += 5;
    if (features.hasYear) hookBonus += 3;
    if (features.hasListFormat) hookBonus += 2;
    hookBonus = Math.min(20, hookBonus);

    const score = patternMatch - saturationPenalty + lengthScore + hookBonus;
    const confidence = Math.min(100, Math.round((matchedPatterns / Math.max(positivePatterns.length, 1)) * 100));

    return {
        score: Math.max(0, Math.min(100, score)),
        breakdown: { patternMatch, saturationPenalty, lengthScore, hookBonus },
        confidence
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const niche = searchParams.get('niche');
    const iterations = Math.min(50, parseInt(searchParams.get('iterations') || '20', 10));
    const regionCode = searchParams.get('region') || 'US';

    if (!title || !niche) {
        return NextResponse.json({ error: 'Missing "title" and "niche" parameters' }, { status: 400 });
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
        if (items.length < 20) {
            return NextResponse.json({ error: 'Not enough videos to analyze' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // 2. Get video stats
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // 3. Calculate performance metrics
        const videos = statsResponse.data.items.map((v: {
            id: string;
            snippet: { title: string; publishedAt: string };
            statistics: { viewCount?: string };
        }) => {
            const views = parseInt(v.statistics.viewCount || '0', 10);
            const days = daysSinceUpload(v.snippet.publishedAt);
            const velocity = views / days;
            return {
                id: v.id,
                title: v.snippet.title,
                views,
                velocity,
                features: extractTitleFeatures(v.snippet.title)
            };
        });

        // 4. Calculate z-scores
        const velocities = videos.map((v: { velocity: number }) => v.velocity);
        const meanVelocity = calculateMean(velocities);
        const stdVelocity = calculateStdDev(velocities, meanVelocity);

        const videosWithZScore = videos.map((v: { velocity: number; title: string; features: Record<string, boolean | number> }) => ({
            ...v,
            zScore: stdVelocity > 0 ? (v.velocity - meanVelocity) / stdVelocity : 0
        }));

        // 5. Identify outliers (z-score > 1.5)
        const outliers = videosWithZScore.filter((v: { zScore: number }) => v.zScore > 1.5);
        const underperformers = videosWithZScore.filter((v: { zScore: number }) => v.zScore < -1);

        // 6. Extract positive patterns from outliers
        const positivePatterns: TitlePattern[] = [];
        const featureKeys = Object.keys(extractTitleFeatures('test'));

        featureKeys.forEach(key => {
            if (key === 'wordCount' || key === 'charCount') return;

            const outliersWithFeature = outliers.filter((v: { features: Record<string, boolean | number> }) => v.features[key] === true);
            const allWithFeature = videosWithZScore.filter((v: { features: Record<string, boolean | number> }) => v.features[key] === true);

            if (outliersWithFeature.length >= 2 && allWithFeature.length >= 3) {
                const prevalence = outliersWithFeature.length / outliers.length;
                const avgZScore = calculateMean(outliersWithFeature.map((v: { zScore: number }) => v.zScore));

                if (prevalence >= 0.2) {
                    positivePatterns.push({
                        pattern: key,
                        prevalence: Math.round(prevalence * 100),
                        avgZScore: Math.round(avgZScore * 100) / 100,
                        sampleSize: outliersWithFeature.length,
                        weight: Math.round(prevalence * avgZScore * 10)
                    });
                }
            }
        });

        // 7. Extract negative patterns from underperformers
        const negativePatterns: TitlePattern[] = [];

        featureKeys.forEach(key => {
            if (key === 'wordCount' || key === 'charCount') return;

            const underWithFeature = underperformers.filter((v: { features: Record<string, boolean | number> }) => v.features[key] === true);
            const allWithFeature = videosWithZScore.filter((v: { features: Record<string, boolean | number> }) => v.features[key] === true);

            if (underWithFeature.length >= 2 && allWithFeature.length >= 3) {
                const prevalence = underWithFeature.length / Math.max(underperformers.length, 1);

                if (prevalence >= 0.3) {
                    negativePatterns.push({
                        pattern: key,
                        prevalence: Math.round(prevalence * 100),
                        avgZScore: Math.round(calculateMean(underWithFeature.map((v: { zScore: number }) => v.zScore)) * 100) / 100,
                        sampleSize: underWithFeature.length,
                        weight: Math.round(prevalence * 5)
                    });
                }
            }
        });

        // 8. Calculate optimal word count from outliers
        const outlierWordCounts = outliers.map((v: { features: Record<string, boolean | number> }) => v.features.wordCount as number);
        const avgWordCount = calculateMean(outlierWordCounts);
        const optimalLength = {
            min: Math.max(3, Math.floor(avgWordCount - 2)),
            max: Math.ceil(avgWordCount + 2)
        };

        // 9. Extract top words from outliers
        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'this', 'that', 'i', 'you', 'my', 'your', 'how', 'what', 'why']);

        outliers.forEach((v: { title: string }) => {
            v.title.toLowerCase().split(/\s+/).forEach((word: string) => {
                const clean = word.replace(/[^a-z]/g, '');
                if (clean.length > 2 && !stopWords.has(clean)) {
                    wordCounts[clean] = (wordCounts[clean] || 0) + 1;
                }
            });
        });

        const topWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);

        const hookWords = ['Ultimate', 'Complete', 'Best', 'Top', 'Essential', 'Must-Know', 'Proven', 'Simple'];

        // 10. Random Walk Optimization
        const avgZScoreOutliers = calculateMean(outliers.map((v: { zScore: number }) => v.zScore));

        const startScore = scoreTitleAgainstPatterns(title, positivePatterns, negativePatterns, optimalLength, avgZScoreOutliers);

        let currentTitle = title;
        let currentScore = startScore;
        let bestTitle: TitleCandidate = {
            title,
            score: startScore.score,
            breakdown: startScore.breakdown,
            confidence: startScore.confidence,
            step: 0
        };

        const walkPath: TitleCandidate[] = [bestTitle];
        const temperature = 0.3; // Exploration parameter

        for (let i = 0; i < iterations; i++) {
            // Generate mutations
            const mutations = generateMutations(currentTitle, topWords, hookWords);

            if (mutations.length === 0) continue;

            // Pick a random mutation
            const candidateTitle = mutations[Math.floor(Math.random() * mutations.length)];
            const candidateScore = scoreTitleAgainstPatterns(candidateTitle, positivePatterns, negativePatterns, optimalLength, avgZScoreOutliers);

            // Accept/reject based on Metropolis criterion
            const delta = candidateScore.score - currentScore.score;
            const acceptProbability = delta > 0 ? 1 : Math.exp(delta / temperature);

            if (Math.random() < acceptProbability) {
                currentTitle = candidateTitle;
                currentScore = candidateScore;

                const candidate: TitleCandidate = {
                    title: candidateTitle,
                    score: candidateScore.score,
                    breakdown: candidateScore.breakdown,
                    confidence: candidateScore.confidence,
                    step: i + 1
                };

                walkPath.push(candidate);

                if (candidateScore.score > bestTitle.score) {
                    bestTitle = candidate;
                }
            }
        }

        // 11. Get top alternatives from walk
        const uniqueTitles = new Map<string, TitleCandidate>();
        walkPath.forEach(c => {
            if (!uniqueTitles.has(c.title) || uniqueTitles.get(c.title)!.score < c.score) {
                uniqueTitles.set(c.title, c);
            }
        });

        const topAlternatives = Array.from(uniqueTitles.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        // 12. Calculate confidence based on data quality
        const patternConfidence = outliers.length >= 10 ? 'high' : outliers.length >= 5 ? 'medium' : 'low';

        const result: WalkResult = {
            input: title,
            bestTitle,
            walkPath: topAlternatives,
            methodology: {
                algorithm: 'Metropolis-Hastings random walk with simulated annealing',
                fitnessFunction: 'Pattern match (40%) - Saturation penalty (20%) + Length optimization (20%) + Hook bonus (20%)',
                iterations,
                acceptanceCriteria: 'Accept improvements always; accept downgrades with probability exp(delta/temperature)',
                limitations: [
                    'Patterns learned from correlation, not causation',
                    `Based on ${outliers.length} outliers from ${videos.length} videos`,
                    'Optimal title depends on many factors beyond pattern matching',
                    'YouTube algorithm is not fully understood'
                ]
            },
            patterns: {
                positive: positivePatterns.sort((a, b) => b.weight - a.weight).slice(0, 5),
                negative: negativePatterns.sort((a, b) => b.weight - a.weight).slice(0, 5)
            },
            statistics: {
                sampleSize: videos.length,
                outliersAnalyzed: outliers.length,
                patternConfidence
            }
        };

        return NextResponse.json(result);

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `API Error: ${error.response.status}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
