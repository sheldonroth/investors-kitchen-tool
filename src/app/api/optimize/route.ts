import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Statistical helper functions
function calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    const diffMs = now.getTime() - uploadDate.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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
    // Statistical scores (added after processing)
    velocity?: number;      // views per day
    zScore?: number;        // statistical outlier score
    isStatOutlier?: boolean; // z-score > 2
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
        // Search YouTube for similar content
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

        // Get video statistics
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // Parse videos with statistical data
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
                velocity: Math.round(views / days) // views per day
            };
        });

        // === STATISTICAL OUTLIER DETECTION ===
        // Calculate z-scores based on velocity (views/day) for fair comparison
        const velocities = rawVideos.map(v => v.velocity || 0);
        const velocityMean = calculateMean(velocities);
        const velocityStdDev = calculateStdDev(velocities, velocityMean);

        // Add z-scores and mark statistical outliers (z > 2)
        const videos: VideoData[] = rawVideos.map(v => {
            const zScore = calculateZScore(v.velocity || 0, velocityMean, velocityStdDev);
            return {
                ...v,
                zScore: Math.round(zScore * 100) / 100,
                isStatOutlier: zScore > 2 // True statistical outlier
            };
        });

        // Sort by z-score (velocity-normalized) for true outliers
        const sortedByZScore = [...videos].sort((a, b) => (b.zScore || 0) - (a.zScore || 0));
        const statisticalOutliers = videos.filter(v => v.isStatOutlier);
        const topOutliers = sortedByZScore.slice(0, 5);

        // Calculate overall stats
        const overallAvg = videos.reduce((sum, v) => sum + v.views, 0) / videos.length;

        // Analyze duration buckets
        const categories = ['Shorts (<1 min)', 'Short (1-5 min)', 'Medium (5-10 min)', 'Long (10-20 min)', 'Very Long (>20 min)'];
        const durationStats: Record<string, { count: number; totalViews: number; avgViews: number }> = {};

        categories.forEach(cat => {
            durationStats[cat] = { count: 0, totalViews: 0, avgViews: 0 };
        });

        videos.forEach(video => {
            const stat = durationStats[video.lengthCategory];
            stat.count++;
            stat.totalViews += video.views;
        });

        // Find UNDERSERVED length (low competition + decent views = gap)
        let bestBucket = { bucket: '', multiplier: 0, avgViews: 0, isGap: false };
        const avgCountPerCat = videos.length / categories.length;

        categories.forEach(cat => {
            const stat = durationStats[cat];
            if (stat.count > 0) {
                stat.avgViews = Math.round(stat.totalViews / stat.count);
                const multiplier = stat.avgViews / overallAvg;
                const isUnderserved = stat.count < avgCountPerCat * 0.7;
                const hasDemand = stat.avgViews >= overallAvg * 0.8;

                // Prioritize underserved gaps with decent demand
                if (isUnderserved && hasDemand && multiplier > bestBucket.multiplier) {
                    bestBucket = { bucket: cat, multiplier: Math.round(multiplier * 10) / 10, avgViews: stat.avgViews, isGap: true };
                } else if (!bestBucket.isGap && multiplier > bestBucket.multiplier) {
                    bestBucket = { bucket: cat, multiplier: Math.round(multiplier * 10) / 10, avgViews: stat.avgViews, isGap: false };
                }
            }
        });

        // Analyze title patterns from OUTLIERS specifically
        const analysisVideos = topOutliers.length >= 3 ? topOutliers : sortedByZScore.slice(0, 5);
        const patternInsights = {
            usesNumbers: Math.round((analysisVideos.filter(v => /\d/.test(v.title)).length / analysisVideos.length) * 100),
            usesQuestions: Math.round((analysisVideos.filter(v => /\?/.test(v.title)).length / analysisVideos.length) * 100),
            usesEmoji: Math.round((analysisVideos.filter(v => /[\u{1F300}-\u{1F9FF}]/u.test(v.title)).length / analysisVideos.length) * 100),
            usesAllCaps: Math.round((analysisVideos.filter(v => /[A-Z]{3,}/.test(v.title)).length / analysisVideos.length) * 100),
            avgTitleLength: Math.round(analysisVideos.reduce((sum, v) => sum + v.title.length, 0) / analysisVideos.length)
        };

        // Extract power words from outliers
        const wordFreq: Record<string, number> = {};
        analysisVideos.forEach(v => {
            const words = v.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            words.forEach(word => {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            });
        });
        const topWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([word]) => word);

        // Identify saturated title patterns (what to AVOID)
        const saturatedPatterns: string[] = [];
        const titleCounts: Record<string, number> = {};
        videos.forEach(v => {
            const pattern = v.title.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
            titleCounts[pattern] = (titleCounts[pattern] || 0) + 1;
        });
        Object.entries(titleCounts)
            .filter(([_, count]) => count >= 3)
            .forEach(([pattern]) => saturatedPatterns.push(pattern));

        // ===== Calculate Saturation Score for Title Optimization =====
        const uniqueChannels = new Set(videos.map(v => v.channelId)).size;
        const channelConcentration = 1 - (uniqueChannels / videos.length);
        const avgDaysOld = videos.reduce((sum, v) => {
            const days = Math.floor((Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
        }, 0) / videos.length;
        const ageFactor = Math.min(avgDaysOld / 365, 1);
        const competitionFactor = Math.min(videos.length / 50, 1);
        const saturationRaw = (competitionFactor * 0.4) + (channelConcentration * 0.3) + (ageFactor * 0.3);
        const saturationScore = Math.round(saturationRaw * 100);
        const saturationLabel = saturationScore <= 30 ? 'Low' : saturationScore <= 60 ? 'Medium' : 'High';

        // Generate AI title suggestions using Gemini
        let titleSuggestions: { title: string; reasoning: string }[] = [];

        if (GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const outlierInfo = topOutliers.length >= 3
                    ? `OUTLIER TITLES (2x+ above average views - these are the WINNERS to learn from):\n${topOutliers.map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views, ${Math.round(v.views / overallAvg)}x avg)`).join('\n')}`
                    : `TOP PERFORMERS:\n${sortedByZScore.slice(0, 5).map((v, i) => `${i + 1}. "${v.title}" (${v.views.toLocaleString()} views, ${v.velocity}/day)`).join('\n')}`;

                const prompt = `You are a YouTube title strategist who finds UNSATURATED angles.

The user's video idea: "${idea}"

${outlierInfo}

SATURATED PATTERNS TO AVOID (overused in this niche):
${saturatedPatterns.length > 0 ? saturatedPatterns.map(p => `- "${p}..."`).join('\n') : '- None identified'}

OUTLIER PACKAGING PATTERNS (what WORKS):
- ${patternInsights.usesNumbers}% use numbers
- ${patternInsights.usesQuestions}% are questions
- ${patternInsights.usesAllCaps}% use ALL CAPS words
- Power words that appear in outliers: ${topWords.join(', ')}

NICHE SATURATION: ${saturationScore}/100 (${saturationLabel})
${saturationScore > 60
                        ? '⚠️ HIGH SATURATION: This niche is crowded. Focus on VERY specific angles, underserved sub-niches, or contrarian takes.'
                        : saturationScore > 30
                            ? '⚡ MEDIUM SATURATION: Room to compete, but differentiation matters. Find a unique hook.'
                            : '✅ LOW SATURATION: Great opportunity! Standard approaches can still work well.'}

YOUR STRATEGY:
1. LEARN from outlier packaging (their title structure, hooks, word choices)
2. AVOID the saturated patterns everyone else is using
3. ${saturationScore > 60 ? 'TARGET A SPECIFIC SUB-NICHE or contrarian angle' : 'FIND a unique angle that hasn\'t been overdone'}
4. Package it like a winner (using outlier patterns)

Generate 5 title variations that:
1. Use DIFFERENT angles from the saturated patterns
2. Package like outliers (use their proven patterns/structure)
3. Are 40-60 characters
4. Each takes a unique approach (contrarian, specific, curiosity gap, result-focused, personal)
5. ${saturationScore > 60 ? 'Target UNDERSERVED sub-niches within this topic' : 'Would STAND OUT in search results, not blend in'}

Return ONLY valid JSON in this exact format:
{"titles":[{"title":"...","reasoning":"Why this angle is unsaturated + how it uses outlier packaging"}]}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                // Parse JSON from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    titleSuggestions = parsed.titles || [];
                }
            } catch (error) {
                console.error('Gemini title generation failed:', error);
            }
        }

        // Fallback if Gemini fails
        if (titleSuggestions.length === 0) {
            titleSuggestions = [
                { title: `${idea} - Complete Guide`, reasoning: 'Classic how-to format' },
                { title: `5 ${idea} Tips You Need to Know`, reasoning: 'Listicle with number' },
                { title: `${idea} for Beginners (Step by Step)`, reasoning: 'Beginner-friendly approach' }
            ];
        }

        return NextResponse.json({
            idea,
            recommendedLength: {
                bucket: bestBucket.bucket,
                multiplier: bestBucket.multiplier,
                avgViews: bestBucket.avgViews,
                reason: `Videos in this length average ${bestBucket.multiplier}x more views than other lengths`
            },
            titleSuggestions,
            patternInsights: {
                ...patternInsights,
                topWords,
                saturatedPatterns: saturatedPatterns.slice(0, 5)
            },
            topOutliers: (topOutliers.length >= 3 ? topOutliers : sortedByZScore.slice(0, 3)).slice(0, 3).map(v => ({
                title: v.title,
                views: v.views,
                thumbnail: v.thumbnail,
                id: v.id,
                lengthCategory: v.lengthCategory,
                velocity: v.velocity,
                zScore: v.zScore,
                isStatOutlier: v.isStatOutlier
            })),
            // Saturation data
            saturation: {
                score: saturationScore,
                label: saturationLabel,
                factors: {
                    competition: Math.round(competitionFactor * 100),
                    channelConcentration: Math.round(channelConcentration * 100),
                    contentAge: Math.round(ageFactor * 100)
                }
            },
            // Statistical metrics
            statistics: {
                outlierCount: statisticalOutliers.length,
                outlierRate: Math.round((statisticalOutliers.length / videos.length) * 100),
                avgVelocity: Math.round(velocityMean),
                velocityStdDev: Math.round(velocityStdDev),
                sampleSize: videos.length,
                // Confidence score: based on sample size, outlier consistency, pattern clarity
                confidence: calculateConfidence(videos.length, statisticalOutliers.length, patternInsights)
            },
            totalAnalyzed: videos.length
        });

        function calculateConfidence(
            sampleSize: number,
            outlierCount: number,
            patterns: { usesNumbers: number; usesQuestions: number; usesAllCaps: number }
        ): { score: number; level: string; factors: string[] } {
            const factors: string[] = [];
            let score = 50; // Base score

            // Sample size factor (more samples = more confidence)
            if (sampleSize >= 40) { score += 15; factors.push('Strong sample size (40+ videos)'); }
            else if (sampleSize >= 25) { score += 10; factors.push('Good sample size (25+ videos)'); }
            else { score -= 10; factors.push('Limited sample size'); }

            // Outlier consistency (finding outliers = patterns exist)
            if (outlierCount >= 5) { score += 15; factors.push('Clear outlier pattern (5+ outliers)'); }
            else if (outlierCount >= 2) { score += 8; factors.push('Some outliers found'); }
            else { score -= 5; factors.push('Few statistical outliers'); }

            // Pattern clarity (strong patterns = more predictable)
            const maxPattern = Math.max(patterns.usesNumbers, patterns.usesQuestions, patterns.usesAllCaps);
            if (maxPattern >= 60) { score += 10; factors.push('Clear title pattern dominance'); }
            else if (maxPattern >= 40) { score += 5; factors.push('Moderate pattern clarity'); }

            // Cap score
            score = Math.min(95, Math.max(20, score));

            const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';
            return { score, level, factors };
        }

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({
                error: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            }, { status: error.response.status });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
