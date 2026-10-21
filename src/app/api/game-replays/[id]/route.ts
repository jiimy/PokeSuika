import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/utils/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/game-replays/:id
 * 단일 리플레이 상세 (재생용)
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return Response.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_replays')
      .select(
        'id, score, max_grade, duration_sec, created_at, guest_id, user_id, replay_data',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/game-replays/:id]', error);
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return Response.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    return Response.json(
      { ok: true, item: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '리플레이 조회 실패';
    console.error('[GET /api/game-replays/:id]', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
