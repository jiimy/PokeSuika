import { type NextRequest } from 'next/server';

import type { ReplayData, SaveReplayPayload } from '@/types/replay';
import { createAdminClient } from '@/utils/supabase/admin';

const GUEST_PATTERN = /^guest\d{5}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isReplayData(value: unknown): value is ReplayData {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReplayData;
  return (
    v.version === '1.0' &&
    typeof v.seed === 'number' &&
    Array.isArray(v.skills) &&
    Array.isArray(v.actions)
  );
}

/**
 * GET /api/game-replays?userId=<uuid>
 * 게스트·로그인 모두 user_id 로 조회
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const guestId = request.nextUrl.searchParams.get('guestId');

    if (!userId && !guestId) {
      return Response.json(
        { ok: false, error: 'userId or guestId required' },
        { status: 400 },
      );
    }
    if (userId && !UUID_PATTERN.test(userId)) {
      return Response.json({ ok: false, error: 'invalid userId' }, { status: 400 });
    }
    if (guestId && !GUEST_PATTERN.test(guestId)) {
      return Response.json({ ok: false, error: 'invalid guestId' }, { status: 400 });
    }

    const supabase = createAdminClient();
    let query = supabase
      .from('game_replays')
      .select('id, score, max_grade, duration_sec, created_at, guest_id, user_id')
      .order('created_at', { ascending: false })
      .limit(50);

    // 게스트여도 user_id 우선 조회
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (guestId) {
      query = query.eq('guest_id', guestId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/game-replays]', error);
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return Response.json(
      { ok: true, items: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '리플레이 목록 조회 실패';
    console.error('[GET /api/game-replays]', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/game-replays
 * 게스트도 user_id(UUID)에 저장. guest_id 는 표시용.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SaveReplayPayload>;
    const score = Number(body.score ?? 0);
    const maxGrade = Number(body.maxGrade ?? 0);
    const durationSec = Number(body.durationSec ?? 0);
    const replayData = body.replayData;
    const guestId =
      typeof body.guestId === 'string' && GUEST_PATTERN.test(body.guestId)
        ? body.guestId
        : null;
    const userId =
      typeof body.userId === 'string' && UUID_PATTERN.test(body.userId)
        ? body.userId
        : null;

    if (!isReplayData(replayData)) {
      return Response.json(
        { ok: false, error: 'invalid replay_data' },
        { status: 400 },
      );
    }
    if (!userId) {
      return Response.json(
        { ok: false, error: 'userId (uuid) required' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(score) || score < 0) {
      return Response.json({ ok: false, error: 'invalid score' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_replays')
      .insert({
        user_id: userId,
        guest_id: guestId,
        score: Math.floor(score),
        max_grade: Math.floor(maxGrade),
        duration_sec: Math.max(0, Math.floor(durationSec)),
        replay_data: replayData,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[POST /api/game-replays]', error);
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return Response.json(
      { ok: true, id: data.id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '리플레이 저장에 실패했습니다.';
    console.error('[POST /api/game-replays]', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
