import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface ThumbnailAnalysis {
    videoId: string;
    title: string;
    views: number;
    thumbnailUrl: string;
    analysis: {
        hasFace: boolean;
        hasText: boolean;
        textAmount: string;
        dominantColors: string[];
        contrast: string;
        emotionIfFace: string;
        compositionNotes: string;
    };
}

interface NicheConvention {
    convention: string;
    prevalence: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
    observation: string;
}

async function analyzeThumbnail(thumbnailUrl: string, title: string): Promise<{
    hasFace: boolean;
    hasText: boolean;
    textAmount: string;
    dominantColors: string[];
    contrast: string;
    emotionIfFace: string;
    compositionNotes: string;
}> {
    if (!GEMINI_API_KEY) {
        return {
            hasFace: false,
            hasText: false,
            textAmount: 'unknown',
            dominantColors: [],
            contrast: 'unknown',
            emotionIfFace: 'n/a',
            compositionNotes: 'AI analysis unavailable'
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const imageResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
        const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');

        const prompt = `Analyze this YouTube thumbnail image. Return ONLY valid JSON:
{
  "hasFace": true/false,
  "hasText": true/false,
  "textAmount": "none"/"minimal"/"moderate"/"heavy",
  "dominantColors": ["color1", "color2"],
  "contrast": "low"/"medium"/"high",
  "emotionIfFace": "excited"/"surprised"/"serious"/"happy"/"neutral"/"n/a",
  "compositionNotes": "brief observation about layout/design"
}

Video title for context: "${title}"`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64
                }
            }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('Thumbnail analysis failed:', error);
    }

    return {
        hasFace: false,
        hasText: false,
        textAmount: 'unknown',
        dominantColors: [],
        contrast: 'unknown',
        emotionIfFace: 'n/a',
        compositionNotes: 'Analysis failed'
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');

    if (!niche) {
        return NextResponse.json({ error: 'Missing "niche" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
        return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    try {
        // 1. Get top-performing videos in niche
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: niche,
                type: 'video',
                maxResults: 40,
                order: 'viewCount',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 10) {
            return NextResponse.json({ error: 'Not enough videos to analyze' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId);

        // 2. Get video stats AND contentDetails for duration
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics,contentDetails',
                id: videoIds.join(','),
                key: YOUTUBE_API_KEY
            }
        });

        // 3. Parse duration and separate Shorts from Long-form
        const parseDuration = (isoDuration: string): number => {
            const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return 0;
            const hours = parseInt(match[1] || '0', 10);
            const minutes = parseInt(match[2] || '0', 10);
            const seconds = parseInt(match[3] || '0', 10);
            return hours * 3600 + minutes * 60 + seconds;
        };

        const allVideos = statsResponse.data.items.map((v: {
            id: string;
            snippet: { title: string; thumbnails: { high?: { url: string }; default?: { url: string } } };
            statistics: { viewCount?: string };
            contentDetails: { duration: string };
        }) => ({
            id: v.id,
            title: v.snippet.title,
            views: parseInt(v.statistics.viewCount || '0', 10),
            thumbnailUrl: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
            duration: parseDuration(v.contentDetails.duration),
            isShort: parseDuration(v.contentDetails.duration) <= 60
        }));

        const shorts = allVideos.filter((v: { isShort: boolean }) => v.isShort);
        const longForm = allVideos.filter((v: { isShort: boolean }) => !v.isShort);

        // 4. Analyze thumbnails for each format (max 8 each)
        const analyzeFormat = async (videos: typeof allVideos, formatName: string) => {
            const toAnalyze = videos.slice(0, 8);
            const analyses: ThumbnailAnalysis[] = [];

            for (const video of toAnalyze) {
                const analysis = await analyzeThumbnail(video.thumbnailUrl, video.title);
                analyses.push({
                    videoId: video.id,
                    title: video.title,
                    views: video.views,
                    thumbnailUrl: video.thumbnailUrl,
                    analysis
                });
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Calculate conventions
            const conventions: NicheConvention[] = [];
            const total = analyses.length;

            if (total < 3) {
                return {
                    format: formatName,
                    videosAnalyzed: total,
                    conventions: [],
                    topPerformers: [],
                    note: `Only ${total} ${formatName} videos found. Need at least 3 for pattern analysis.`
                };
            }

            const getConfidence = (count: number): 'low' | 'medium' | 'high' => {
                if (total >= 6) return count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low';
                return count >= 3 ? 'medium' : 'low';
            };

            // Face presence
            const faceCount = analyses.filter(a => a.analysis.hasFace).length;
            conventions.push({
                convention: 'Face in thumbnail',
                prevalence: Math.round((faceCount / total) * 100),
                sampleSize: total,
                confidence: getConfidence(faceCount),
                observation: faceCount >= total * 0.7
                    ? `Faces are standard for ${formatName} in this niche.`
                    : faceCount >= total * 0.4
                        ? `Mixed usage of faces in ${formatName}.`
                        : `Faces are uncommon in ${formatName} for this niche.`
            });

            // Text presence
            const textCount = analyses.filter(a => a.analysis.hasText).length;
            conventions.push({
                convention: 'Text overlay',
                prevalence: Math.round((textCount / total) * 100),
                sampleSize: total,
                confidence: getConfidence(textCount),
                observation: textCount >= total * 0.7
                    ? `Text overlays are standard for ${formatName}.`
                    : `Text is ${textCount >= total * 0.4 ? 'mixed' : 'uncommon'} for ${formatName}.`
            });

            // Contrast
            const highContrastCount = analyses.filter(a => a.analysis.contrast === 'high').length;
            conventions.push({
                convention: 'High contrast',
                prevalence: Math.round((highContrastCount / total) * 100),
                sampleSize: total,
                confidence: getConfidence(highContrastCount),
                observation: `${highContrastCount >= total * 0.5 ? 'Common' : 'Less common'} in ${formatName}.`
            });

            return {
                format: formatName,
                videosAnalyzed: total,
                conventions,
                topPerformers: analyses.slice(0, 4).map(a => ({
                    title: a.title,
                    views: a.views,
                    thumbnailUrl: a.thumbnailUrl,
                    features: [
                        a.analysis.hasFace ? 'Face' : null,
                        a.analysis.hasText ? 'Text' : null,
                        a.analysis.contrast === 'high' ? 'High contrast' : null
                    ].filter(Boolean)
                }))
            };
        };

        const shortsAnalysis = await analyzeFormat(shorts, 'Shorts');
        const longFormAnalysis = await analyzeFormat(longForm, 'Long-form');

        return NextResponse.json({
            niche,
            videoTypesFound: {
                shorts: shorts.length,
                longForm: longForm.length
            },

            // Separate analysis by format
            shorts: shortsAnalysis,
            longForm: longFormAnalysis,

            // HONEST methodology
            methodology: {
                approach: 'Analyzes thumbnails separately for Shorts (≤60s) and Long-form videos',
                limitations: [
                    'We observe CORRELATION, not CAUSATION',
                    'High views may be due to topic, title, algorithm - not thumbnail',
                    'No CTR data available - cannot prove thumbnails drove clicks',
                    'Shorts and Long-form have different discovery mechanics'
                ],
                interpretation: 'Patterns OBSERVED in successful videos, not PROVEN to cause success'
            },

            insight: `Found ${shorts.length} Shorts and ${longForm.length} Long-form videos. Analyzed conventions separately since thumbnail strategies differ by format.`
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
