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

interface NichePattern {
    pattern: string;
    prevalence: number;
    correlation: string;
    recommendation: string;
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

        // Fetch thumbnail image
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
    const thumbnailUrl = searchParams.get('thumbnail'); // Optional: user's thumbnail to score

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
                maxResults: 20,
                order: 'viewCount',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 5) {
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

        // 3. Analyze top 8 thumbnails (to manage API calls)
        const videosToAnalyze = statsResponse.data.items.slice(0, 8);
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

            // Delay between API calls
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 4. Identify patterns correlating with high views
        const patterns: NichePattern[] = [];
        const totalAnalyzed = analyses.length;

        // Face presence
        const faceCount = analyses.filter(a => a.analysis.hasFace).length;
        const facePrevalence = Math.round((faceCount / totalAnalyzed) * 100);
        patterns.push({
            pattern: 'Face in thumbnail',
            prevalence: facePrevalence,
            correlation: facePrevalence >= 60 ? 'Strong' : facePrevalence >= 40 ? 'Moderate' : 'Weak',
            recommendation: facePrevalence >= 60
                ? 'Include a face - top performers in this niche use faces'
                : 'Face optional in this niche'
        });

        // Text presence
        const textCount = analyses.filter(a => a.analysis.hasText).length;
        const textPrevalence = Math.round((textCount / totalAnalyzed) * 100);
        patterns.push({
            pattern: 'Text overlay',
            prevalence: textPrevalence,
            correlation: textPrevalence >= 60 ? 'Strong' : textPrevalence >= 40 ? 'Moderate' : 'Weak',
            recommendation: textPrevalence >= 60
                ? 'Add text overlay - standard in this niche'
                : 'Text optional - let visuals speak'
        });

        // High contrast
        const highContrastCount = analyses.filter(a => a.analysis.contrast === 'high').length;
        const contrastPrevalence = Math.round((highContrastCount / totalAnalyzed) * 100);
        patterns.push({
            pattern: 'High contrast',
            prevalence: contrastPrevalence,
            correlation: contrastPrevalence >= 50 ? 'Strong' : 'Moderate',
            recommendation: 'High contrast helps thumbnails pop in feeds'
        });

        // Emotions (if faces present)
        const emotionCounts: Record<string, number> = {};
        analyses.forEach(a => {
            if (a.analysis.emotionIfFace && a.analysis.emotionIfFace !== 'n/a') {
                emotionCounts[a.analysis.emotionIfFace] = (emotionCounts[a.analysis.emotionIfFace] || 0) + 1;
            }
        });
        const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
        if (topEmotion) {
            patterns.push({
                pattern: `${topEmotion[0]} expression`,
                prevalence: Math.round((topEmotion[1] / faceCount) * 100),
                correlation: 'Observed in top performers',
                recommendation: `When using faces, ${topEmotion[0]} expressions work well in this niche`
            });
        }

        // 5. Score user's thumbnail if provided
        let userThumbnailScore = null;
        if (thumbnailUrl) {
            const userAnalysis = await analyzeThumbnail(thumbnailUrl, 'User thumbnail');

            let score = 50; // Base score

            // Compare to niche patterns
            if (facePrevalence >= 60 && userAnalysis.hasFace) score += 15;
            if (facePrevalence < 40 && !userAnalysis.hasFace) score += 5;

            if (textPrevalence >= 60 && userAnalysis.hasText) score += 10;
            if (textPrevalence < 40 && !userAnalysis.hasText) score += 5;

            if (userAnalysis.contrast === 'high') score += 15;
            if (userAnalysis.contrast === 'medium') score += 5;

            score = Math.min(100, score);

            userThumbnailScore = {
                score,
                analysis: userAnalysis,
                feedback: generateFeedback(userAnalysis, patterns)
            };
        }

        return NextResponse.json({
            niche,
            thumbnailsAnalyzed: analyses.length,
            patterns,
            topPerformers: analyses.slice(0, 5).map(a => ({
                title: a.title,
                views: a.views,
                thumbnailUrl: a.thumbnailUrl,
                keyFeatures: [
                    a.analysis.hasFace ? 'Has face' : 'No face',
                    a.analysis.hasText ? `Text: ${a.analysis.textAmount}` : 'No text',
                    `${a.analysis.contrast} contrast`,
                    a.analysis.emotionIfFace !== 'n/a' ? a.analysis.emotionIfFace : null
                ].filter(Boolean)
            })),
            userThumbnailScore,
            insight: generateInsight(patterns)
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

function generateFeedback(
    userAnalysis: { hasFace: boolean; hasText: boolean; contrast: string; textAmount: string },
    patterns: NichePattern[]
): string[] {
    const feedback: string[] = [];

    const facePattern = patterns.find(p => p.pattern === 'Face in thumbnail');
    if (facePattern && facePattern.prevalence >= 60 && !userAnalysis.hasFace) {
        feedback.push(`Consider adding a face - ${facePattern.prevalence}% of top performers use faces`);
    }

    const textPattern = patterns.find(p => p.pattern === 'Text overlay');
    if (textPattern && textPattern.prevalence >= 60 && !userAnalysis.hasText) {
        feedback.push(`Add text overlay - standard in this niche (${textPattern.prevalence}%)`);
    }

    if (userAnalysis.contrast === 'low') {
        feedback.push('Increase contrast - your thumbnail may get lost in feeds');
    }

    if (userAnalysis.textAmount === 'heavy') {
        feedback.push('Reduce text amount - too much text can hurt readability at small sizes');
    }

    if (feedback.length === 0) {
        feedback.push('Your thumbnail aligns well with niche patterns!');
    }

    return feedback;
}

function generateInsight(patterns: NichePattern[]): string {
    const strongPatterns = patterns.filter(p => p.correlation === 'Strong');

    if (strongPatterns.length >= 2) {
        return `Strong patterns detected: ${strongPatterns.map(p => p.pattern.toLowerCase()).join(', ')}. Match these for best results.`;
    } else if (strongPatterns.length === 1) {
        return `Key pattern: ${strongPatterns[0].pattern.toLowerCase()} is standard in this niche.`;
    }
    return 'Thumbnail patterns vary in this niche - more creative freedom available.';
}
