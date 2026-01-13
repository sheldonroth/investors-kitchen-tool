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
        // 1. Get top-performing videos in niche (INCREASED sample)
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: niche,
                type: 'video',
                maxResults: 30, // Increased from 20
                order: 'viewCount',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 10) {
            return NextResponse.json({ error: 'Not enough videos to analyze' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId);

        // 2. Get video stats
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds.join(','),
                key: YOUTUBE_API_KEY
            }
        });

        // 3. Analyze top 15 thumbnails (increased from 8)
        const videosToAnalyze = statsResponse.data.items.slice(0, 15);
        const analyses: ThumbnailAnalysis[] = [];

        for (const video of videosToAnalyze) {
            const thumbnailUrlHigh = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url;

            const analysis = await analyzeThumbnail(thumbnailUrlHigh, video.snippet.title);

            analyses.push({
                videoId: video.id,
                title: video.snippet.title,
                views: parseInt(video.statistics.viewCount || '0', 10),
                thumbnailUrl: thumbnailUrlHigh,
                analysis
            });

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 4. Identify CONVENTIONS (not "what works")
        const conventions: NicheConvention[] = [];
        const totalAnalyzed = analyses.length;

        // Calculate confidence based on sample size
        const getConfidence = (count: number): 'low' | 'medium' | 'high' => {
            if (totalAnalyzed >= 12) return count >= 8 ? 'high' : count >= 5 ? 'medium' : 'low';
            if (totalAnalyzed >= 8) return count >= 5 ? 'medium' : 'low';
            return 'low';
        };

        // Face presence
        const faceCount = analyses.filter(a => a.analysis.hasFace).length;
        const facePrevalence = Math.round((faceCount / totalAnalyzed) * 100);
        conventions.push({
            convention: 'Face in thumbnail',
            prevalence: facePrevalence,
            sampleSize: totalAnalyzed,
            confidence: getConfidence(faceCount),
            observation: facePrevalence >= 70
                ? `${facePrevalence}% of top videos include faces. This appears to be a niche norm.`
                : facePrevalence >= 40
                    ? `${facePrevalence}% include faces. Mixed convention in this niche.`
                    : `Only ${facePrevalence}% include faces. Non-face thumbnails are common here.`
        });

        // Text presence
        const textCount = analyses.filter(a => a.analysis.hasText).length;
        const textPrevalence = Math.round((textCount / totalAnalyzed) * 100);
        conventions.push({
            convention: 'Text overlay',
            prevalence: textPrevalence,
            sampleSize: totalAnalyzed,
            confidence: getConfidence(textCount),
            observation: textPrevalence >= 70
                ? `${textPrevalence}% use text overlays. Standard practice in this niche.`
                : textPrevalence >= 40
                    ? `${textPrevalence}% use text. Optional in this niche.`
                    : `Only ${textPrevalence}% use text. Visual-first thumbnails common here.`
        });

        // High contrast
        const highContrastCount = analyses.filter(a => a.analysis.contrast === 'high').length;
        const contrastPrevalence = Math.round((highContrastCount / totalAnalyzed) * 100);
        conventions.push({
            convention: 'High contrast',
            prevalence: contrastPrevalence,
            sampleSize: totalAnalyzed,
            confidence: getConfidence(highContrastCount),
            observation: `${contrastPrevalence}% use high contrast. ${contrastPrevalence >= 50 ? 'Common' : 'Less common'} in this niche.`
        });

        // Emotions (if faces present)
        if (faceCount >= 3) {
            const emotionCounts: Record<string, number> = {};
            analyses.forEach(a => {
                if (a.analysis.emotionIfFace && a.analysis.emotionIfFace !== 'n/a') {
                    emotionCounts[a.analysis.emotionIfFace] = (emotionCounts[a.analysis.emotionIfFace] || 0) + 1;
                }
            });
            const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
            if (topEmotion && topEmotion[1] >= 2) {
                const emotionPrevalence = Math.round((topEmotion[1] / faceCount) * 100);
                conventions.push({
                    convention: `${topEmotion[0].charAt(0).toUpperCase() + topEmotion[0].slice(1)} expression`,
                    prevalence: emotionPrevalence,
                    sampleSize: faceCount,
                    confidence: faceCount >= 5 ? 'medium' : 'low',
                    observation: `Of thumbnails with faces, ${emotionPrevalence}% show ${topEmotion[0]} expressions.`
                });
            }
        }

        return NextResponse.json({
            niche,
            thumbnailsAnalyzed: analyses.length,

            // REFRAMED: "Niche Conventions" not "What Works"
            conventions,

            topPerformers: analyses.slice(0, 6).map(a => ({
                title: a.title,
                views: a.views,
                thumbnailUrl: a.thumbnailUrl,
                features: [
                    a.analysis.hasFace ? 'Has face' : 'No face',
                    a.analysis.hasText ? `Text: ${a.analysis.textAmount}` : 'No text',
                    `${a.analysis.contrast} contrast`,
                    a.analysis.emotionIfFace !== 'n/a' ? a.analysis.emotionIfFace : null
                ].filter(Boolean)
            })),

            // HONEST methodology
            methodology: {
                approach: 'Analyzes thumbnails from top-performing videos to identify common patterns',
                sampleSize: analyses.length,
                limitations: [
                    'We observe CORRELATION, not CAUSATION',
                    'High views may be due to topic, title, algorithm, or existing audience - not just thumbnail',
                    'We do not have CTR data - cannot prove thumbnails drove clicks',
                    'Copying conventions does not guarantee results'
                ],
                interpretation: 'These are patterns OBSERVED in successful videos, not PROVEN to cause success'
            },

            insight: `Analyzed ${analyses.length} top-performing thumbnails. ${conventions.filter(c => c.confidence === 'high').length > 0
                    ? `High-confidence conventions: ${conventions.filter(c => c.confidence === 'high').map(c => c.convention.toLowerCase()).join(', ')}.`
                    : 'No high-confidence conventions detected. This niche may have varied visual styles.'
                }`
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
