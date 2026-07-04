import { NextResponse } from 'next/server';

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
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    // Step 1: Search
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', `${normalized} upcycling DIY tutorial`);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '12');
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('key', apiKey);
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      console.error('YouTube search error:', searchRes.status, errBody);
      return NextResponse.json({ error: 'YouTube API request failed' }, { status: 502 });
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];

    // Step 2: Fetch durations from Videos API
    const videoIds = items
      .map((item: { id: { videoId: string } }) => item.id?.videoId)
      .filter(Boolean);

    const durationMap = new Map<string, string>();
    if (videoIds.length > 0) {
      try {
        const vidUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        vidUrl.searchParams.set('part', 'contentDetails');
        vidUrl.searchParams.set('id', videoIds.join(','));
        vidUrl.searchParams.set('key', apiKey);

        const vidRes = await fetch(vidUrl.toString());
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          for (const vid of vidData.items || []) {
            if (vid.id && vid.contentDetails?.duration) {
              durationMap.set(vid.id, parseDuration(vid.contentDetails.duration));
            }
          }
        }
      } catch {
        // durations silently fail, results still returned
      }
    }

    const videos = items.map(
      (item: {
        id: { videoId: string };
        snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }>; publishedAt: string };
      }) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        publishedAt: item.snippet.publishedAt,
        duration: durationMap.get(item.id.videoId) || '',
      }),
    );

    const result = {
      videos,
      totalResults: searchData.pageInfo?.totalResults || 0,
      nextPageToken: searchData.nextPageToken || null,
    };

    SEARCH_CACHE.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('YouTube search crashed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
