import { NextResponse } from 'next/server';

const SEARCH_CACHE = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing query param ?q=' }, { status: 400 });
  }

  const normalized = q.toLowerCase().trim();
  const cacheKey = `search_${normalized}`;

  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', `${normalized} upcycling DIY tutorial`);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '12');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('relevanceLanguage', 'en');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errBody = await res.text();
      console.error('YouTube API error:', res.status, errBody);
      return NextResponse.json({ error: 'YouTube API request failed' }, { status: 502 });
    }

    const data = await res.json();

    const videos = (data.items || []).map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }>; publishedAt: string } }) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      publishedAt: item.snippet.publishedAt,
    }));

    const result = {
      videos,
      totalResults: data.pageInfo?.totalResults || 0,
    };

    SEARCH_CACHE.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('YouTube search crashed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
