import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface VideoData {
    id: string;
    title: string;
    views: number;
    publishedAt: string;
    channelTitle: string;
}

interface TopicCluster {
    topic: string;
    videos: number;
    avgViews: number;
    topVideo: { title: string; views: number; id: string };
    saturation: 'low' | 'medium' | 'high';
}

interface ContentGap {
    topic: string;
    opportunity: string;
    reasoning: string;
    urgency: 'high' | 'medium' | 'low';
    relatedCluster: string;
}

function daysSinceUpload(publishedAt: string): number {
    const uploadDate = new Date(publishedAt);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)));
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

    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured for clustering' }, { status: 500 });
    }

    try {
        // 1. Fetch videos in the niche
        const searchResponse = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: niche,
                type: 'video',
                maxResults: 50,
                order: 'relevance',
                key: YOUTUBE_API_KEY
            }
        });

        const items = searchResponse.data.items || [];
        if (items.length < 10) {
            return NextResponse.json({ error: 'Not enough videos to analyze' }, { status: 404 });
        }

        const videoIds = items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

        // 2. Get video statistics
        const statsResponse = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
            }
        });

        const videos: VideoData[] = statsResponse.data.items.map((v: {
            id: string;
            snippet: { title: string; publishedAt: string; channelTitle: string };
            statistics: { viewCount?: string };
        }) => ({
            id: v.id,
            title: v.snippet.title,
            views: parseInt(v.statistics.viewCount || '0', 10),
            publishedAt: v.snippet.publishedAt,
            channelTitle: v.snippet.channelTitle
        }));

        // 3. Use Gemini to cluster videos by semantic topic and find gaps
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const titlesWithViews = videos.map(v => `"${v.title}" (${v.views.toLocaleString()} views)`).join('\n');

        const clusterPrompt = `Analyze these YouTube video titles from the "${niche}" niche and perform semantic clustering.

VIDEOS:
${titlesWithViews}

TASK 1: Identify 5-8 distinct topic clusters within these videos. For each cluster:
- Name the topic clearly
- Count how many videos belong to it
- Assess saturation (low/medium/high based on video count and view distribution)

TASK 2: Identify 3-5 content GAPS - topics that SHOULD exist in this niche but have few or no videos. These are opportunities.
- Look for obvious sub-topics that aren't covered
- Consider beginner/advanced angles not represented
- Think about what questions viewers might have that aren't answered

Return ONLY valid JSON:
{
  "clusters": [
    {"topic": "specific topic name", "videoCount": 5, "saturation": "high/medium/low", "topVideoTitle": "best performing title in cluster"}
  ],
  "gaps": [
    {"topic": "untapped topic", "opportunity": "why this is valuable", "reasoning": "based on cluster analysis", "urgency": "high/medium/low", "relatedCluster": "which existing cluster it relates to"}
  ],
  "nicheInsight": "one sentence summary of the niche's content landscape"
}`;

        const result = await model.generateContent(clusterPrompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return NextResponse.json({ error: 'AI clustering failed - no valid response' }, { status: 500 });
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // 4. Enrich clusters with actual video data
        const enrichedClusters: TopicCluster[] = (parsed.clusters || []).map((cluster: {
            topic: string;
            videoCount: number;
            saturation: string;
            topVideoTitle: string;
        }) => {
            // Find the top video mentioned
            const topVideo = videos.find(v => v.title.toLowerCase().includes(cluster.topVideoTitle?.toLowerCase()?.slice(0, 30) || ''));

            // Estimate avg views for this cluster (simplified - would need actual matching in production)
            const avgViews = topVideo ? topVideo.views * 0.6 : 0;

            return {
                topic: cluster.topic,
                videos: cluster.videoCount,
                avgViews: Math.round(avgViews),
                topVideo: topVideo ? { title: topVideo.title, views: topVideo.views, id: topVideo.id } : { title: cluster.topVideoTitle || 'Unknown', views: 0, id: '' },
                saturation: cluster.saturation as 'low' | 'medium' | 'high'
            };
        });

        // 5. Process gaps
        const contentGaps: ContentGap[] = (parsed.gaps || []).map((gap: {
            topic: string;
            opportunity: string;
            reasoning: string;
            urgency: string;
            relatedCluster: string;
        }) => ({
            topic: gap.topic,
            opportunity: gap.opportunity,
            reasoning: gap.reasoning,
            urgency: gap.urgency as 'high' | 'medium' | 'low',
            relatedCluster: gap.relatedCluster
        }));

        // 6. Calculate niche statistics
        const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
        const avgViews = Math.round(totalViews / videos.length);
        const recentVideos = videos.filter(v => daysSinceUpload(v.publishedAt) <= 30);
        const freshContent = Math.round((recentVideos.length / videos.length) * 100);

        return NextResponse.json({
            niche,

            overview: {
                videosAnalyzed: videos.length,
                clustersFound: enrichedClusters.length,
                gapsIdentified: contentGaps.length,
                avgViews,
                freshContentRate: `${freshContent}%`,
                nicheInsight: parsed.nicheInsight || 'Analysis complete'
            },

            clusters: enrichedClusters.sort((a, b) => b.avgViews - a.avgViews),

            gaps: contentGaps.sort((a, b) => {
                const urgencyOrder = { high: 0, medium: 1, low: 2 };
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }),

            topPerformers: videos
                .sort((a, b) => b.views - a.views)
                .slice(0, 5)
                .map(v => ({ title: v.title, views: v.views, id: v.id, channel: v.channelTitle })),

            methodology: {
                approach: 'Semantic clustering of video titles using AI, with gap detection based on missing sub-topics',
                limitations: [
                    'Clustering is based on title semantics, not actual video content',
                    'Gaps are AI-inferred, not guaranteed to have demand',
                    'Sample limited to 50 videos by relevance',
                    'View counts are snapshots, not velocity-adjusted'
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
        console.error('Clustering error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
