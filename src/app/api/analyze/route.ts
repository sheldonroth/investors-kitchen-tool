import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import googleTrends from 'google-trends-api';
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
    if (seconds < 60) return 'Short (<1 min)';
    if (seconds < 300) return 'Short (1-5 min)';
    if (seconds < 600) return 'Medium (5-10 min)';
    if (seconds < 1200) return 'Long (10-20 min)';
    return 'Very Long (>20 min)';
}

interface VideoData {
    id: string;
    title: string;
    channelTitle: string;
    publishedAt: string;
    views: number;
    likes: number;
    duration: string;
    durationSec: number;
    lengthCategory: string;
    thumbnail: string;
}

interface DurationBucket {
    range: string;
    count: number;
    totalViews: number;
    avgViews: number;
    videos: VideoData[];
}

// ===== IMPROVEMENT 1: YouTube Autocomplete API =====
async function getYouTubeAutocomplete(query: string): Promise<string[]> {
    try {
        const response = await axios.get('https://suggestqueries.google.com/complete/search', {
            params: {
                client: 'youtube',
                ds: 'yt',
                q: query
            },
            responseType: 'text'
        });

        // Parse JSONP response
        const text = response.data;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed[1]) {
            return parsed[1].map((item: string[]) => item[0]).slice(0, 8);
        }
        return [];
    } catch {
        return [];
    }
}

// ===== IMPROVEMENT 2: Google Trends Integration =====
async function getTrendData(query: string): Promise<{ direction: string; change: number; emoji: string } | null> {
    try {
        const result = await googleTrends.interestOverTime({
            keyword: query,
            startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            geo: 'US'
        });

        const data = JSON.parse(result);
        const timeline = data.default?.timelineData;

        if (!timeline || timeline.length < 2) return null;

        const recent = timeline.slice(-4).reduce((s: number, t: { value: number[] }) => s + t.value[0], 0) / 4;
        const older = timeline.slice(0, 4).reduce((s: number, t: { value: number[] }) => s + t.value[0], 0) / 4;

        const change = older > 0 ? Math.round(((recent - older) / older) * 100) : 0;

        let direction: 'rising' | 'stable' | 'declining';
        let emoji: string;

        if (change > 20) {
            direction = 'rising';
            emoji = '📈';
        } else if (change < -20) {
            direction = 'declining';
            emoji = '📉';
        } else {
            direction = 'stable';
            emoji = '➡️';
        }

        return { direction, change, emoji };
    } catch {
        return null;
    }
}

// ===== IMPROVEMENT 3: Gemini Pro Thumbnail Analysis =====
interface GeminiThumbnailAnalysis {
    hasFaces: boolean;
    faceCount: number;
    dominantColors: string[];
    hasText: boolean;
    detectedLabels: string[];
    geminiInsights?: string;
}

async function analyzeThumbnails(thumbnailUrls: string[], query: string): Promise<GeminiThumbnailAnalysis | null> {
    if (!GEMINI_API_KEY || thumbnailUrls.length === 0) return null;

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Fetch thumbnails as base64
        const imagePromises = thumbnailUrls.slice(0, 3).map(async (url) => {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const base64 = Buffer.from(response.data).toString('base64');
                return {
                    inlineData: {
                        data: base64,
                        mimeType: 'image/jpeg'
                    }
                };
            } catch {
                return null;
            }
        });

        const allImages = await Promise.all(imagePromises);
        const images = allImages.filter((img): img is { inlineData: { data: string; mimeType: string } } => img !== null);
        if (images.length === 0) return null;

        const prompt = `Analyze these ${images.length} YouTube thumbnails for the search query "${query}".

Respond in this exact JSON format only, no other text:
{
  "hasFaces": true/false,
  "faceCount": number,
  "dominantColors": ["color1", "color2", "color3"],
  "hasText": true/false,
  "detectedLabels": ["label1", "label2", "label3", "label4", "label5"],
  "insights": "2-3 sentences about what makes these thumbnails effective and what a competitor could do differently"
}`;

        const result = await model.generateContent([prompt, ...images]);
        const text = result.response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            hasFaces: parsed.hasFaces ?? false,
            faceCount: parsed.faceCount ?? 0,
            dominantColors: parsed.dominantColors ?? [],
            hasText: parsed.hasText ?? false,
            detectedLabels: parsed.detectedLabels ?? [],
            geminiInsights: parsed.insights
        };
    } catch (error) {
        console.error('Gemini thumbnail analysis failed:', error);
        return null;
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const maxResults = Math.min(parseInt(searchParams.get('max') || '50'), 50);

    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // Run parallel API calls for better performance
        const [searchResponse, autocompleteResults, trendsData] = await Promise.all([
            axios.get(`${BASE_URL}/search`, {
                params: {
                    part: 'snippet',
                    q: query,
                    type: 'video',
                    maxResults,
                    key: YOUTUBE_API_KEY
                }
            }),
            getYouTubeAutocomplete(query),
            getTrendData(query)
        ]);

        const items = searchResponse.data.items;
        if (!items || items.length === 0) {
            return NextResponse.json({ videos: [], analysis: null });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // Get detailed statistics
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const videos: VideoData[] = statsResponse.data.items.map((item: {
            id: string;
            snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails: { high?: { url: string } } };
            contentDetails: { duration: string };
            statistics: { viewCount?: string; likeCount?: string };
        }) => {
            const durationSec = parseDuration(item.contentDetails.duration);
            return {
                id: item.id,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                views: parseInt(item.statistics.viewCount || '0', 10),
                likes: parseInt(item.statistics.likeCount || '0', 10),
                duration: item.contentDetails.duration,
                durationSec,
                lengthCategory: categorizeDuration(durationSec),
                thumbnail: item.snippet.thumbnails.high?.url || ''
            };
        });

        // Sort by views for top performer analysis
        const sortedByViews = [...videos].sort((a, b) => b.views - a.views);
        const topThumbnails = sortedByViews.slice(0, 5).map(v => v.thumbnail);

        // Analyze thumbnails (runs async, may be null if no Vision API key)
        const thumbnailAnalysis = await analyzeThumbnails(topThumbnails, query);

        // Duration bucket analysis
        const durationBuckets: Record<string, DurationBucket> = {};
        const categories = ['Short (<1 min)', 'Short (1-5 min)', 'Medium (5-10 min)', 'Long (10-20 min)', 'Very Long (>20 min)'];

        categories.forEach(cat => {
            durationBuckets[cat] = { range: cat, count: 0, totalViews: 0, avgViews: 0, videos: [] };
        });

        videos.forEach(video => {
            const bucket = durationBuckets[video.lengthCategory];
            bucket.count++;
            bucket.totalViews += video.views;
            bucket.videos.push(video);
        });

        // Calculate baselines
        const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
        const overallAvgViews = totalViews / videos.length;
        const avgCountPerCategory = videos.length / categories.length;

        // Calculate averages and scores for each category
        const analysis = categories.map(cat => {
            const bucket = durationBuckets[cat];
            bucket.avgViews = bucket.count > 0 ? Math.round(bucket.totalViews / bucket.count) : 0;

            const competitionScore = bucket.count > 0 ? 1 - (bucket.count / videos.length) : 1;
            const demandScore = overallAvgViews > 0 ? bucket.avgViews / overallAvgViews : 0;
            const opportunityScore = competitionScore * demandScore;

            return {
                ...bucket,
                competitionScore: Math.round(competitionScore * 100),
                demandScore: Math.round(demandScore * 100),
                opportunityScore: Math.round(opportunityScore * 100)
            };
        });

        // Find market holes
        const holes = analysis
            .filter(a => {
                const isLowCompetition = a.count < avgCountPerCategory * 0.8;
                const isHighDemand = a.avgViews >= overallAvgViews;
                return isLowCompetition && isHighDemand && a.count > 0;
            })
            .map(a => {
                const isVeryLowComp = a.count < avgCountPerCategory * 0.5;
                const isVeryHighDemand = a.avgViews > overallAvgViews * 1.5;

                let type: 'hot' | 'opportunity' = 'opportunity';
                let emoji = '✅';

                if (isVeryLowComp && isVeryHighDemand) {
                    type = 'hot';
                    emoji = '🔥';
                }

                return {
                    range: a.range,
                    type,
                    emoji,
                    reason: `${a.count} videos (${Math.round((a.count / videos.length) * 100)}% of results) with ${a.avgViews.toLocaleString()} avg views`,
                    opportunityScore: a.opportunityScore
                };
            })
            .sort((a, b) => b.opportunityScore - a.opportunityScore);

        // ===== IMPROVED: Optimization Warning =====
        const maxCount = Math.max(...analysis.map(a => a.count));
        const concentrationPct = (maxCount / videos.length) * 100;
        const dominantCategory = analysis.find(a => a.count === maxCount);
        const dominantCategoryName = dominantCategory?.range || '';
        const dominantHasHighestAvgViews = dominantCategory?.avgViews === Math.max(...analysis.map(a => a.avgViews));

        // Only warn if dominant category doesn't have highest avg views (true over-optimization)
        const optimizationWarning = (concentrationPct > 50 && !dominantHasHighestAvgViews) ? {
            warning: true,
            concentrationPct: Math.round(concentrationPct),
            dominantCategory: dominantCategoryName,
            message: `${Math.round(concentrationPct)}% of videos are ${dominantCategoryName}, but it's NOT the best performer`,
            suggestion: `The highest avg views come from a different length — consider diversifying`
        } : null;

        // ===== IMPROVED: Momentum with Google Trends =====
        const now = new Date();
        const daysSince = (dateStr: string) => Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        const avgUploadAge = Math.round(videos.reduce((sum, v) => sum + daysSince(v.publishedAt), 0) / videos.length);
        const recentVideos = videos.filter(v => daysSince(v.publishedAt) < 30);
        const recentPct = Math.round((recentVideos.length / videos.length) * 100);

        // Use Google Trends if available, fallback to upload recency
        const momentum = trendsData ? {
            status: trendsData.direction,
            emoji: trendsData.emoji,
            trendChange: trendsData.change,
            avgUploadAgeDays: avgUploadAge,
            recentPct,
            message: `${trendsData.change > 0 ? '+' : ''}${trendsData.change}% search interest over 90 days`,
            source: 'google_trends'
        } : {
            status: recentPct > 30 ? 'rising' : avgUploadAge < 180 ? 'stable' : 'declining',
            emoji: recentPct > 30 ? '📈' : avgUploadAge < 180 ? '➡️' : '📉',
            trendChange: null,
            avgUploadAgeDays: avgUploadAge,
            recentPct,
            message: `${recentPct}% of top results uploaded in last 30 days`,
            source: 'upload_recency'
        };

        // Title patterns
        const titlePatterns = {
            hasNumber: Math.round((videos.filter(v => /\d/.test(v.title)).length / videos.length) * 100),
            hasQuestion: Math.round((videos.filter(v => /\?/.test(v.title)).length / videos.length) * 100),
            hasEmoji: Math.round((videos.filter(v => /[\u{1F300}-\u{1F9FF}]/u.test(v.title)).length / videos.length) * 100),
            allCaps: Math.round((videos.filter(v => /[A-Z]{3,}/.test(v.title)).length / videos.length) * 100),
            avgTitleLength: Math.round(videos.reduce((s, v) => s + v.title.length, 0) / videos.length)
        };

        // ===== IMPROVED: Thumbnail Prompt based on Vision Analysis =====
        const isShortForm = dominantCategoryName.includes('Short');
        let thumbnailPrompt = `Create a YouTube thumbnail for "${query}":\n`;

        if (thumbnailAnalysis) {
            // Use actual Vision API insights
            thumbnailPrompt += `\nBased on analysis of top-performing thumbnails:\n`;
            thumbnailPrompt += `- Faces: ${thumbnailAnalysis.hasFaces ? `YES (avg ${Math.round(thumbnailAnalysis.faceCount / 5)} per thumbnail)` : 'Few/none used'}\n`;
            thumbnailPrompt += `- Text overlays: ${thumbnailAnalysis.hasText ? 'Common in top performers' : 'Minimal text preferred'}\n`;
            thumbnailPrompt += `- Common themes: ${thumbnailAnalysis.detectedLabels.join(', ')}\n`;
            thumbnailPrompt += `- Color palette: ${thumbnailAnalysis.dominantColors.join(', ')}\n`;
            thumbnailPrompt += `\nSuggested approach:\n`;
            thumbnailPrompt += `- ${thumbnailAnalysis.hasFaces ? 'Include an expressive face' : 'Focus on subject matter, no face needed'}\n`;
            thumbnailPrompt += `- ${thumbnailAnalysis.hasText ? 'Add bold text hook (2-4 words)' : 'Let visuals speak, minimal text'}\n`;
            thumbnailPrompt += `- Style: ${isShortForm ? 'Bold, vertical-friendly, punchy' : 'Detailed, curiosity-driven'}\n`;
        } else {
            // Fallback to pattern-based generation
            thumbnailPrompt += `- Style: ${isShortForm ? 'Bold, minimal, punchy text overlay' : 'Detailed, curiosity-driven visual story'}\n`;
            thumbnailPrompt += `- Colors: High contrast, ${overallAvgViews > 100000 ? 'vibrant saturated colors' : 'clean modern pastels'}\n`;
            thumbnailPrompt += `- Composition: ${titlePatterns.hasNumber > 50 ? 'Large number as focal point' : 'Single clear subject, rule of thirds'}\n`;
            thumbnailPrompt += `- Text: ${titlePatterns.allCaps > 30 ? 'ALL CAPS hook, max 3 words' : 'Title case, short phrase'}\n`;
            thumbnailPrompt += `- Face: ${query.toLowerCase().includes('tutorial') ? 'Optional pointing gesture' : 'Expressive reaction'}\n`;
        }

        return NextResponse.json({
            query,
            totalVideos: videos.length,
            overallAvgViews: Math.round(overallAvgViews),
            videos,
            lengthAnalysis: analysis,
            marketHoles: holes,
            optimizationWarning,
            relatedQueries: autocompleteResults,
            momentum,
            titlePatterns,
            thumbnailAnalysis,
            thumbnailPrompt
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
