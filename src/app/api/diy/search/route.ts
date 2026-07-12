import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

const SEARCH_CACHE = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1]) || 0;
  const m = parseInt(match[2]) || 0;
  const s = parseInt(match[3]) || 0;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    if (!q) {
      return NextResponse.json({ error: 'Missing query param ?q=' }, { status: 400 });
    }

    const pageToken = searchParams.get('pageToken') || '';
    const normalized = q.toLowerCase().trim();
    const cacheKey = `search_${normalized}_${pageToken}`;

    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    // Build YouTube Data API search URL
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '12');
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json();
      console.error('YouTube API error:', err);
      return NextResponse.json(
        { error: 'YouTube search failed' },
        { status: 502 }
      );
    }

    const searchData = await res.json();

    // If no results, return empty
    if (!searchData.items?.length) {
      const emptyResult = { videos: [], nextPageToken: null };
      SEARCH_CACHE.set(cacheKey, { data: emptyResult, ts: Date.now() });
      return NextResponse.json(emptyResult);
    }

    // Fetch video details (duration) in a second batch call
    const videoIds = searchData.items
      .map((item: any) => item.id?.videoId)
      .filter(Boolean)
      .join(',');

    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'contentDetails,snippet');
    detailsUrl.searchParams.set('id', videoIds);
    detailsUrl.searchParams.set('key', apiKey);

    const detailsRes = await fetch(detailsUrl.toString());
    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };

    const detailsMap = new Map<string, any>(
      (detailsData.items || []).map((v: any) => [v.id, v])
    );

    const videos = searchData.items.map((item: any) => {
      const detail: any = detailsMap.get(item.id?.videoId);
      const duration = detail
        ? parseDuration(detail.contentDetails?.duration)
        : '';

      return {
        id: item.id?.videoId,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.medium?.url,
        channel: item.snippet?.channelTitle,
        duration,
        publishedAt: item.snippet?.publishedAt,
      };
    });

    const result = {
      videos,
      nextPageToken: searchData.nextPageToken || null,
    };

    SEARCH_CACHE.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('API /api/diy/search crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
