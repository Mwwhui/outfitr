import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNUSED_THRESHOLD = 30; // score above this → flagged unused
const WEAR_LOG_DAYS = 90; // look back window

export async function POST(req: Request) {
  let userId: string | undefined;

  // Accept userId from body (for internal fire-and-forget calls from outfit_plans)
  try {
    const body = await req.json();
    userId = body.userId;
  } catch {
    // body not JSON — ignore
  }

  if (!userId) {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Fetch all user's clothes
  const { data: clothes, error: clothesError } = await supabase
    .from('clothes')
    .select('id, user_id, name, type, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.available');

  if (clothesError || !clothes) {
    console.error('score-unused clothes error:', clothesError);
    return NextResponse.json(
      { error: 'Failed to fetch clothes' },
      { status: 500 },
    );
  }

  // 2. Fetch wear logs from last 90 days
  const since = new Date();
  since.setDate(since.getDate() - WEAR_LOG_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: wearLogs, error: logsError } = await supabase
    .from('wear_logs')
    .select('cloth_id, worn_at')
    .eq('user_id', userId)
    .gte('worn_at', sinceStr);

  if (logsError) {
    console.error('score-unused wear_logs error:', logsError);
    return NextResponse.json(
      { error: 'Failed to fetch wear logs' },
      { status: 500 },
    );
  }

  // 3. Build a map: cloth_id → { count, lastWornAt }
  const wearMap = new Map<string, { count: number; lastWornAt: string }>();

  for (const log of wearLogs ?? []) {
    const existing = wearMap.get(log.cloth_id);
    if (!existing) {
      wearMap.set(log.cloth_id, { count: 1, lastWornAt: log.worn_at });
    } else {
      existing.count += 1;
      if (log.worn_at > existing.lastWornAt) {
        existing.lastWornAt = log.worn_at;
      }
    }
  }

  // 4. Score each item and build update rows
  const today = new Date().toISOString().slice(0, 10);

  const updates = clothes.map((item) => {
    const wear = wearMap.get(item.id);
    const wearCount = wear?.count ?? 0;
    const lastWornAt = wear?.lastWornAt ?? null;

    // Days since last worn — if never worn, use days since item was added
    const referenceDate = lastWornAt ?? item.created_at.slice(0, 10);
    const daysSince = Math.floor(
      (new Date(today).getTime() - new Date(referenceDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Score: stale items with low wear count score higher
    // Never worn items get a high score immediately
    const unusedScore =
      wearCount === 0 ? daysSince : Math.round(daysSince * (1 / wearCount));

    return {
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      type: item.type,
      created_at: item.created_at,
      wear_count: wearCount,
      last_worn_at: lastWornAt,
      unused_score: unusedScore,
      unused: unusedScore > UNUSED_THRESHOLD,
    };
  });

  // 5. Batch update all items in Supabase
  const { error: updateError } = await supabase
    .from('clothes')
    .upsert(updates, { onConflict: 'id' });

  if (updateError) {
    console.error('score-unused upsert error:', updateError);
    return NextResponse.json(
      { error: 'Failed to update scores' },
      { status: 500 },
    );
  }

  // Return a summary
  const flaggedCount = updates.filter((u) => u.unused).length;

  return NextResponse.json({
    success: true,
    total: updates.length,
    flagged_unused: flaggedCount,
  });
}
