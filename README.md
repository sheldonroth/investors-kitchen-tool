# Investor's Kitchen - YouTube Market Analyzer

Analyze YouTube content to find **video lengths** and **market holes** for your niche.

## Features

- 🔍 Search YouTube for any topic
- 📊 Analyze video length distribution
- 🕳️ Detect market holes (underserved content lengths with high potential)
- 📈 View average views per length category

## Setup

1. Clone the repo
2. Create `.env.local` with your YouTube API Key:
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```
3. Install dependencies: `npm install`
4. Run locally: `npm run dev`

## Deploy to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Add `YOUTUBE_API_KEY` environment variable in Vercel dashboard
4. Deploy!

## Tech Stack

- Next.js 15
- Tailwind CSS
- YouTube Data API v3
