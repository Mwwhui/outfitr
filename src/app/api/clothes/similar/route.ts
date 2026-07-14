import { supabaseServer } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { normalizeColor, colorSimilarity } from '@/lib/colorNorm';

interface SimilarItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  similarity: number;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const color = searchParams.get('color');
  const exclude_id = searchParams.get('exclude_id');

  if (!type) {
    return NextResponse.json(
      { error: 'type is required' },
      { status: 400 },
    );
  }

  const user_id = session.user.id;

  const typeLower = type.toLowerCase();

  try {
    // Fetch user items, cap at 50 to avoid transferring huge wardrobes
    // Filter by type in JS for case-insensitive matching
    let query = supabase
      .from('clothes')
      .select('id, name, type, color, image_url')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available')
      .limit(200);

    if (exclude_id) {
      query = query.neq('id', exclude_id);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error('Supabase error /api/clothes/similar:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ similar: [], count: 0 });
    }

    // Filter by type (case-insensitive) and score by color similarity
    const scored: SimilarItem[] = items
      .filter((item) => item.type?.toLowerCase() === typeLower)
      .map((item) => {
        const sim = color ? colorSimilarity(color, item.color || '') : 0;
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          color: item.color,
          image_url: item.image_url,
          similarity: sim,
        };
      })
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 25); // Cap results at 25

    return NextResponse.json({
      similar: scored,
      count: scored.length,
    });
  } catch (err) {
    console.error('API /api/clothes/similar crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
