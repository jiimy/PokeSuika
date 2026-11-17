import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/utils/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function collectCallerUserIds(request: NextRequest): Set<string> {
  const userIds = new Set<string>();
  const userId = request.nextUrl.searchParams.get('userId');
  const userIdsParam = request.nextUrl.searchParams.get('userIds');
  if (userId && UUID_PATTERN.test(userId)) userIds.add(userId);
  if (userIdsParam) {
    for (const id of userIdsParam.split(',')) {
      const trimmed = id.trim();
      if (UUID_PATTERN.test(trimmed)) userIds.add(trimmed);
    }
  }
  return userIds;
}

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
        'id, score, max_grade, duration_sec, created_at, user_id, replay_data',
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

/**
 * DELETE /api/game-replays/:id?userId=&userIds=
 * 본인(게스트 UUID 히스토리 포함) 기록만 삭제
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return Response.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const callerIds = collectCallerUserIds(request);
    if (callerIds.size === 0) {
      return Response.json(
        { ok: false, error: 'userId required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from('game_replays')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[DELETE /api/game-replays/:id]', fetchError);
      return Response.json(
        { ok: false, error: fetchError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return Response.json({ ok: false, error: 'not found' }, { status: 404 });
    }
    if (!existing.user_id || !callerIds.has(existing.user_id)) {
      return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('game_replays')
      .delete()
      .eq('id', id)
      .eq('user_id', existing.user_id);

    if (deleteError) {
      console.error('[DELETE /api/game-replays/:id]', deleteError);
      return Response.json(
        { ok: false, error: deleteError.message },
        { status: 500 },
      );
    }

    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '리플레이 삭제 실패';
    console.error('[DELETE /api/game-replays/:id]', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
