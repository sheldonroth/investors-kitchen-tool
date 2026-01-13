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
    features: {
        hasFace: boolean;
        hasText: boolean;
        dominantColors: string[];
        style: string;
        emotionalTone: string;
        visualDescription: string;
    };
}

async function analyzeThumbnailWithVision(thumbnailUrl: string, genAI: GoogleGenerativeAI): Promise<{
    hasFace: boolean;
    hasText: boolean;
    dominantColors: string[];
    style: string;
    emotionalTone: string;
    visualDescription: string;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const imageResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
        const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');

        const prompt = `Analyze this YouTube thumbnail. Return ONLY valid JSON:
{
    "hasFace": true/false,
    "hasText": true/false,
    "dominantColors": ["color1", "color2"],
    "style": "minimalist/busy/professional/casual/dramatic/informative",
    "emotionalTone": "excited/calm/urgent/curious/serious/playful",
    "visualDescription": "brief 10-word description of the thumbnail"
}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
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
        dominantColors: [],
        style: 'unknown',
        emotionalTone: 'unknown',
        visualDescription: 'Analysis failed'
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const thumbnailUrl = searchParams.get('thumbnail');
    const niche = searchParams.get('niche');

    if (!thumbnailUrl || !niche) {
        return NextResponse.json({ error: 'Missing "thumbnail" or "niche" parameter' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY || !GEMINI_API_KEY) {
        return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        // 1. Analyze the input thumbnail
        const inputAnalysis = await analyzeThumbnailWithVision(thumbnailUrl, genAI);

        // 2. Get top-performing videos in the niche
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

        const videoIds = searchResponse.data.items
            .map((item: { id: { videoId: string } }) => item.id.videoId)
            .join(',');

        // 3. Get video stats
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        // 4. Analyze top 12 competitor thumbnails (increased from 8 for better statistics)
        const competitors: ThumbnailAnalysis[] = [];
        const topVideos = statsResponse.data.items.slice(0, 12);

        for (const video of topVideos) {
            const thumbUrl = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url;
            const features = await analyzeThumbnailWithVision(thumbUrl, genAI);

            competitors.push({
                videoId: video.id,
                title: video.snippet.title,
                views: parseInt(video.statistics.viewCount || '0', 10),
                thumbnailUrl: thumbUrl,
                features
            });

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 5. Calculate novelty score
        // Compare input thumbnail to competitor patterns
        const faceRate = competitors.filter(c => c.features.hasFace).length / competitors.length;
        const textRate = competitors.filter(c => c.features.hasText).length / competitors.length;

        // Style distribution
        const styleCounts: Record<string, number> = {};
        competitors.forEach(c => {
            styleCounts[c.features.style] = (styleCounts[c.features.style] || 0) + 1;
        });
        const dominantStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        // Emotional tone distribution
        const toneCounts: Record<string, number> = {};
        competitors.forEach(c => {
            toneCounts[c.features.emotionalTone] = (toneCounts[c.features.emotionalTone] || 0) + 1;
        });
        const dominantTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        // Calculate novelty dimensions
        const noveltyFactors = {
            faceNovelty: inputAnalysis.hasFace !== (faceRate >= 0.5) ? 1 : 0,
            textNovelty: inputAnalysis.hasText !== (textRate >= 0.5) ? 1 : 0,
            styleNovelty: inputAnalysis.style !== dominantStyle ? 1 : 0,
            toneNovelty: inputAnalysis.emotionalTone !== dominantTone ? 1 : 0
        };

        const rawNovelty = (noveltyFactors.faceNovelty + noveltyFactors.textNovelty +
            noveltyFactors.styleNovelty + noveltyFactors.toneNovelty) / 4;

        // Optimal novelty is around 40-60% (different but not alien)
        const noveltyScore = Math.round(rawNovelty * 100);

        let noveltyAssessment: string;
        let recommendation: string;

        if (noveltyScore >= 75) {
            noveltyAssessment = 'Very Different';
            recommendation = 'May stand out too much. Consider adding some familiar elements.';
        } else if (noveltyScore >= 50) {
            noveltyAssessment = 'Optimally Novel';
            recommendation = 'Good balance of differentiation and genre recognition.';
        } else if (noveltyScore >= 25) {
            noveltyAssessment = 'Somewhat Familiar';
            recommendation = 'Consider adding unique elements to stand out more.';
        } else {
            noveltyAssessment = 'Very Similar';
            recommendation = 'May blend in with competitors. Add distinctive visual elements.';
        }

        // 6. Generate specific suggestions
        const suggestions: string[] = [];

        if (faceRate >= 0.7 && !inputAnalysis.hasFace) {
            suggestions.push('Consider adding a face - 70%+ of top performers use faces');
        } else if (faceRate <= 0.3 && inputAnalysis.hasFace) {
            suggestions.push('Face-free thumbnails dominate this niche - consider removing');
        }

        if (textRate >= 0.7 && !inputAnalysis.hasText) {
            suggestions.push('Add text overlay - common in top performers');
        } else if (textRate <= 0.3 && inputAnalysis.hasText) {
            suggestions.push('This niche favors visual-only thumbnails');
        }

        if (inputAnalysis.style !== dominantStyle) {
            suggestions.push(`Your ${inputAnalysis.style} style differs from the dominant ${dominantStyle} style`);
        }

        return NextResponse.json({
            input: {
                thumbnailUrl,
                analysis: inputAnalysis
            },

            novelty: {
                score: noveltyScore,
                assessment: noveltyAssessment,
                recommendation,
                factors: noveltyFactors
            },

            nichePatterns: {
                faceUsage: `${Math.round(faceRate * 100)}%`,
                textUsage: `${Math.round(textRate * 100)}%`,
                dominantStyle,
                dominantTone,
                competitorsAnalyzed: competitors.length
            },

            suggestions,

            topCompetitors: competitors.slice(0, 4).map(c => ({
                title: c.title,
                views: c.views,
                thumbnailUrl: c.thumbnailUrl,
                style: c.features.style,
                description: c.features.visualDescription
            })),

            methodology: {
                approach: 'Visual analysis using AI to compare thumbnail features against top performers',
                limitations: [
                    'Novelty is not the same as effectiveness',
                    'Analysis based on visual features, not actual CTR',
                    'Optimal novelty varies by niche',
                    'AI interpretation may vary'
                ]
            }
        });

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json({ error: `API Error: ${error.response.status}` }, { status: error.response.status });
        }
        console.error('Novelty analysis error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
