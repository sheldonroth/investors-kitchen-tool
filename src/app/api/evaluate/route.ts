import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logModifiedZScore, characterReadability, meanDifferenceCI } from '@/lib/stats';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    return (hours * 3600) + (minutes * 60) + seconds;
}

function categorizeDuration(seconds: number): string {
    if (seconds < 60) return 'Shorts (<1 min)';
    if (seconds < 300) return 'Short (1-5 min)';
    if (seconds < 600) return 'Medium (5-10 min)';
    if (seconds < 1200) return 'Long (10-20 min)';
    return 'Very Long (>20 min)';
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    const diffMs = now.getTime() - uploadDate.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

// Flesch-Kincaid Readability Analysis
function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    let count = vowelGroups ? vowelGroups.length : 1;

    // Adjust for silent e
    if (word.endsWith('e')) count--;
    // Adjust for le endings
    if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word.charAt(word.length - 3))) count++;

    return Math.max(1, count);
}

function calculateReadability(text: string): {
    gradeLevel: number;
    readingEase: number;
    label: string;
    interpretation: string;
} {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (words.length === 0 || sentences.length === 0) {
        return { gradeLevel: 0, readingEase: 100, label: 'Unknown', interpretation: 'Cannot analyze' };
    }

    const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;

    // Flesch-Kincaid Grade Level
    const gradeLevel = Math.round((0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59) * 10) / 10;

    // Flesch Reading Ease (0-100, higher = easier)
    const readingEase = Math.round((206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord) * 10) / 10;

    let label: string;
    let interpretation: string;

    if (gradeLevel <= 5) {
        label = 'Very Easy';
        interpretation = 'Accessible to everyone. May lack specificity.';
    } else if (gradeLevel <= 8) {
        label = 'Easy';
        interpretation = 'Optimal for broad YouTube audience.';
    } else if (gradeLevel <= 10) {
        label = 'Moderate';
        interpretation = 'Good balance of clarity and depth.';
    } else if (gradeLevel <= 12) {
        label = 'Challenging';
        interpretation = 'May limit audience reach.';
    } else {
        label = 'Complex';
        interpretation = 'Potentially too complex for casual viewers.';
    }

    return { gradeLevel, readingEase, label, interpretation };
}

// Calculate confidence based on sample size and data quality
function calculateConfidence(sampleSize: number, outlierCount: number, trendsAvailable: boolean): {
    level: 'low' | 'medium' | 'high';
    score: number;
    factors: string[];
} {
    const factors: string[] = [];
    let score = 50; // Base

    // Sample size factor
    if (sampleSize >= 40) {
        score += 20;
        factors.push('Good sample size');
    } else if (sampleSize >= 20) {
        score += 10;
        factors.push('Moderate sample size');
    } else {
        factors.push('Limited sample size');
    }

    // Outlier clarity factor
    if (outlierCount >= 3) {
        score += 15;
        factors.push('Clear performance patterns');
    } else if (outlierCount >= 1) {
        score += 5;
        factors.push('Some performance patterns');
    } else {
        factors.push('No clear winners to learn from');
    }

    // Trends data factor
    if (trendsAvailable) {
        score += 15;
        factors.push('Trends data available');
    } else {
        factors.push('Trends data unavailable');
    }

    score = Math.min(100, score);
    const level = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';

    return { level, score, factors };
}

interface VideoData {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    views: number;
    thumbnail: string;
    durationSec: number;
    lengthCategory: string;
    velocity: number;
    zScore?: number;
    isOutlier?: boolean;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idea = searchParams.get('idea');
    const regionCode = searchParams.get('region') || 'US';

    if (!idea) {
        return NextResponse.json({ error: 'Missing "idea" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // ===== 1. FETCH DATA =====
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: idea,
                type: 'video',
                maxResults: 50,
                regionCode,
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length === 0) {
            return NextResponse.json({ error: 'No videos found for this idea' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // Parse videos with velocity
        const rawVideos: VideoData[] = statsResponse.data.items.map((item: {
            id: string;
            snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            contentDetails: { duration: string };
            statistics: { viewCount?: string };
        }) => {
            const durationSec = parseDuration(item.contentDetails.duration);
            const views = parseInt(item.statistics.viewCount || '0', 10);
            const days = daysSinceUpload(item.snippet.publishedAt);
            return {
                id: item.id,
                title: item.snippet.title,
                channelId: item.snippet.channelId,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                views,
                thumbnail: item.snippet.thumbnails.high?.url || '',
                durationSec,
                lengthCategory: categorizeDuration(durationSec),
                velocity: Math.round(views / days)
            };
        });

        // Calculate z-scores using log-modified method (robust to outliers)
        const velocities = rawVideos.map(v => v.velocity);

        const videos: VideoData[] = rawVideos.map(v => {
            // Use log-modified z-score (MAD-based, handles right-skewed data)
            const zScore = logModifiedZScore(v.velocity, velocities);
            return {
                ...v,
                zScore: Math.round(zScore * 100) / 100,
                isOutlier: zScore > 1.5 // More conservative threshold (z > 1.5)
            };
        });

        const outliers = videos.filter(v => v.isOutlier);
        const topOutliers = [...videos].sort((a, b) => (b.zScore || 0) - (a.zScore || 0)).slice(0, 5);
        const overallAvg = videos.reduce((sum, v) => sum + v.views, 0) / videos.length;

        // ===== 2. CALCULATE SATURATION (Signal 1) =====
        const uniqueChannels = new Set(videos.map(v => v.channelId)).size;
        const channelConcentration = 1 - (uniqueChannels / videos.length);
        const avgDaysOld = videos.reduce((sum, v) => {
            return sum + daysSinceUpload(v.publishedAt);
        }, 0) / videos.length;
        const ageFactor = Math.min(avgDaysOld / 365, 1);
        const competitionFactor = Math.min(videos.length / 50, 1);
        const saturationRaw = (competitionFactor * 0.4) + (channelConcentration * 0.3) + (ageFactor * 0.3);
        const saturationScore = Math.round(saturationRaw * 100);
        const saturationLabel = saturationScore <= 30 ? 'Low' : saturationScore <= 60 ? 'Medium' : 'High';

        // ===== 3. CALCULATE DEMAND (Signal 2) =====
        let demandScore = 50; // Default when Trends unavailable
        let trendingTopics: { keyword: string; growth?: string }[] = [];
        let trendsAvailable = false;

        try {
            const interestData = await googleTrends.interestOverTime({ keyword: idea, geo: regionCode });
            const parsed = JSON.parse(interestData);
            const timelineData = parsed?.default?.timelineData || [];
            if (timelineData.length >= 2) {
                trendsAvailable = true;
                const recent = timelineData.slice(-4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                const older = timelineData.slice(0, 4).reduce((s: number, d: { value: number[] }) => s + d.value[0], 0) / 4;
                // More conservative scoring - normalize to 0-100 range
                demandScore = older > 0 ? Math.round(Math.min(100, (recent / Math.max(older, 1)) * 50)) : 50;
            }

            const relatedQueries = await googleTrends.relatedQueries({ keyword: idea, geo: regionCode });
            const relatedData = JSON.parse(relatedQueries);
            const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];
            trendingTopics = rising.slice(0, 5).map((item: { query: string; formattedValue: string }) => ({
                keyword: item.query,
                growth: item.formattedValue
            }));
        } catch {
            // Trends API may fail, continue with defaults
        }

        // ===== 4. CALCULATE PERFORMANCE CLARITY (Signal 3) =====
        // How clearly can we identify what works?
        const outlierRate = outliers.length / videos.length;
        const performanceClarity = Math.round(Math.min(100, outlierRate * 500 + (outliers.length >= 3 ? 30 : 0)));

        // ===== 5. CALCULATE CONFIDENCE =====
        const confidence = calculateConfidence(videos.length, outliers.length, trendsAvailable);

        // ===== 6. MARKET ASSESSMENT (replacing single viability score) =====
        // Show 3 separate signals instead of combining into one arbitrary score
        const marketAssessment = {
            competition: {
                score: saturationScore,
                label: saturationLabel,
                interpretation: saturationScore <= 30
                    ? 'Room to compete'
                    : saturationScore <= 60
                        ? 'Differentiation needed'
                        : 'Crowded - find unique angle'
            },
            interest: {
                score: demandScore,
                label: demandScore >= 60 ? 'Growing' : demandScore >= 40 ? 'Stable' : 'Declining',
                interpretation: demandScore >= 60
                    ? 'Rising search interest'
                    : demandScore >= 40
                        ? 'Steady interest'
                        : 'Low or declining interest',
                dataAvailable: trendsAvailable
            },
            learnable: {
                score: performanceClarity,
                label: performanceClarity >= 60 ? 'Clear' : performanceClarity >= 30 ? 'Some' : 'Unclear',
                interpretation: performanceClarity >= 60
                    ? 'Clear patterns to learn from'
                    : performanceClarity >= 30
                        ? 'Some patterns visible'
                        : 'Hard to identify what works',
                outliersFound: outliers.length
            }
        };

        // Generate a summary verdict based on the signals
        const signals = [
            saturationScore <= 50, // Low-medium competition
            demandScore >= 40, // Stable or growing interest
            performanceClarity >= 30 // Some patterns to learn from
        ];
        const positiveSignals = signals.filter(Boolean).length;

        const verdict = positiveSignals >= 3
            ? { assessment: 'Favorable', message: 'Multiple positive signals' }
            : positiveSignals >= 2
                ? { assessment: 'Mixed', message: 'Some positive signals, proceed with strategy' }
                : { assessment: 'Challenging', message: 'Consider a different angle or niche' };

        // ===== 7. FIND BEST LENGTH =====
        const lengthStats: Record<string, { count: number; totalViews: number }> = {};
        videos.forEach(v => {
            if (!lengthStats[v.lengthCategory]) {
                lengthStats[v.lengthCategory] = { count: 0, totalViews: 0 };
            }
            lengthStats[v.lengthCategory].count++;
            lengthStats[v.lengthCategory].totalViews += v.views;
        });

        let bestLength = { bucket: 'Medium (5-10 min)', avgViews: overallAvg, multiplier: 1, sampleSize: 0 };
        Object.entries(lengthStats).forEach(([bucket, stats]) => {
            // Require minimum 5 samples instead of 3 for reliability
            if (stats.count >= 5) {
                const avgViews = stats.totalViews / stats.count;
                const multiplier = avgViews / overallAvg;
                if (multiplier > bestLength.multiplier) {
                    bestLength = {
                        bucket,
                        avgViews: Math.round(avgViews),
                        multiplier: Math.round(multiplier * 10) / 10,
                        sampleSize: stats.count
                    };
                }
            }
        });

        // ===== 8. ANALYZE TITLE PATTERNS =====
        const analysisVideos = topOutliers.length >= 3 ? topOutliers : videos.slice(0, 10);
        const patternInsights = {
            usesNumbers: Math.round((analysisVideos.filter(v => /\d/.test(v.title)).length / analysisVideos.length) * 100),
            usesQuestions: Math.round((analysisVideos.filter(v => /\?/.test(v.title)).length / analysisVideos.length) * 100),
            usesAllCaps: Math.round((analysisVideos.filter(v => /[A-Z]{3,}/.test(v.title)).length / analysisVideos.length) * 100),
            avgTitleLength: Math.round(analysisVideos.reduce((s, v) => s + v.title.length, 0) / analysisVideos.length),
            basedOn: analysisVideos.length,
            source: topOutliers.length >= 3 ? 'outliers' : 'top performers'
        };

        // Find top words
        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'this', 'that', 'i', 'you', 'my', 'your', 'how', 'what', 'why']);
        analysisVideos.forEach(v => {
            v.title.toLowerCase().split(/\s+/).forEach(word => {
                const clean = word.replace(/[^a-z]/g, '');
                if (clean.length > 2 && !stopWords.has(clean)) {
                    wordCounts[clean] = (wordCounts[clean] || 0) + 1;
                }
            });
        });
        const topWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word]) => word);

        // Find saturated patterns
        const saturatedPatterns: string[] = [];
        const titleStarts: Record<string, number> = {};
        videos.forEach(v => {
            const start = v.title.split(' ').slice(0, 3).join(' ').toLowerCase();
            titleStarts[start] = (titleStarts[start] || 0) + 1;
        });
        Object.entries(titleStarts)
            .filter(([_, count]) => count >= 3)
            .forEach(([pattern]) => saturatedPatterns.push(pattern));

        // ===== 8.5. READABILITY ANALYSIS (Character-level, better for titles) =====
        const underperformers = videos.filter(v => (v.zScore || 0) < -0.5);

        // Use character-level readability (not Flesch-Kincaid - titles aren't sentences)
        const outlierReadability = topOutliers.map(v => characterReadability(v.title));
        const underperformerReadability = underperformers.slice(0, 10).map(v => characterReadability(v.title));

        const outlierScores = outlierReadability.map(r => r.score);
        const underperformerScores = underperformerReadability.map(r => r.score);

        const avgOutlierScore = outlierScores.length > 0
            ? Math.round(outlierScores.reduce((sum, s) => sum + s, 0) / outlierScores.length)
            : 0;
        const avgUnderperformerScore = underperformerScores.length > 0
            ? Math.round(underperformerScores.reduce((sum, s) => sum + s, 0) / underperformerScores.length)
            : 0;

        // Calculate confidence interval for the difference
        const readabilityCI = meanDifferenceCI(outlierScores, underperformerScores);

        const readabilityInsight = {
            optimalScore: avgOutlierScore,
            outlierAvg: avgOutlierScore,
            underperformerAvg: avgUnderperformerScore,
            difference: readabilityCI.difference,
            statisticallySignificant: readabilityCI.significant,
            confidenceInterval: { lower: readabilityCI.lowerBound, upper: readabilityCI.upperBound },
            interpretation: avgOutlierScore >= 60
                ? 'Top performers use simple, accessible language'
                : avgOutlierScore >= 40
                    ? 'Moderate vocabulary works in this niche'
                    : 'This niche tolerates complex titles',
            recommendation: readabilityCI.significant && readabilityCI.difference > 5
                ? 'Simpler titles correlate with better performance (statistically significant)'
                : readabilityCI.significant && readabilityCI.difference < -5
                    ? 'More sophisticated language correlates with better performance'
                    : 'Readability difference not statistically significant',
            sampleSize: { outliers: topOutliers.length, underperformers: underperformers.length },
            sampleSufficient: readabilityCI.sampleSufficient
        };

        // ===== 9. GENERATE TITLE SUGGESTIONS =====
        let titleSuggestions: { title: string; reasoning: string }[] = [];

        if (GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const outlierInfo = topOutliers.length >= 3
                    ? `OUTLIER TITLES:\n${topOutliers.map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views)`).join('\n')}`
                    : `TOP PERFORMERS:\n${videos.slice(0, 5).map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views)`).join('\n')}`;

                const prompt = `You are a YouTube title strategist.

VIDEO IDEA: "${idea}"

${outlierInfo}

MARKET CONDITIONS:
- Competition: ${saturationScore}/100 (${saturationLabel})
- Search Interest: ${demandScore}/100 (${trendsAvailable ? 'measured' : 'estimated'})
${saturationScore > 60 ? 'HIGH COMPETITION: Focus on specific sub-niches or contrarian angles.' : saturationScore > 30 ? 'MEDIUM: Differentiation recommended.' : 'LOW: Standard approaches viable.'}

SATURATED PATTERNS TO AVOID:
${saturatedPatterns.length > 0 ? saturatedPatterns.slice(0, 5).map(p => `- "${p}..."`).join('\n') : '- None detected'}

PATTERNS FROM TOP PERFORMERS:
- ${patternInsights.usesNumbers}% use numbers
- ${patternInsights.usesQuestions}% are questions  
- Common words: ${topWords.slice(0, 5).join(', ')}

Generate 5 title variations (40-60 chars each) that:
1. AVOID saturated patterns
2. USE patterns from winners
3. Each takes a UNIQUE angle

Return ONLY JSON: {"titles":[{"title":"...","reasoning":"..."}]}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    titleSuggestions = parsed.titles || [];
                }
            } catch (error) {
                console.error('Gemini failed:', error);
            }
        }

        // Fallback titles
        if (titleSuggestions.length === 0) {
            titleSuggestions = [
                { title: `${idea} - Complete Guide`, reasoning: 'Classic format' },
                { title: `5 ${idea} Tips You Need`, reasoning: 'Listicle with number' },
                { title: `${idea} for Beginners`, reasoning: 'Beginner-friendly' }
            ];
        }

        // ===== 10. BUILD RESPONSE =====
        return NextResponse.json({
            idea,

            // Market signals (decomposed, not combined)
            market: marketAssessment,
            verdict,

            // Confidence in our analysis
            confidence,

            // Title suggestions
            titleSuggestions,

            // Recommended length with sample size
            recommendedLength: bestLength,

            // Supporting data
            saturation: {
                score: saturationScore,
                label: saturationLabel,
                factors: {
                    competition: Math.round(competitionFactor * 100),
                    channelConcentration: Math.round(channelConcentration * 100),
                    contentAge: Math.round(ageFactor * 100)
                }
            },

            demand: {
                score: demandScore,
                dataAvailable: trendsAvailable,
                trending: trendingTopics
            },

            outliers: {
                count: outliers.length,
                rate: Math.round((outliers.length / videos.length) * 100),
                top: topOutliers.slice(0, 3).map(v => ({
                    title: v.title,
                    views: v.views,
                    thumbnail: v.thumbnail,
                    id: v.id,
                    velocity: v.velocity,
                    zScore: v.zScore
                }))
            },

            patterns: {
                ...patternInsights,
                topWords,
                saturatedPatterns: saturatedPatterns.slice(0, 5)
            },

            // Readability analysis
            readability: readabilityInsight,

            // Data quality indicators
            dataQuality: {
                sampleSize: videos.length,
                outliersDetected: outliers.length,
                trendsAvailable,
                disclaimer: 'Based on available public data. Not a guarantee of performance.'
            }
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
