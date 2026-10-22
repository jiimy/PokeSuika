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
 * game_replays.user_id → auth.users FK 를 통과시키기 위해
 * 게스트 UUID 가 없으면 auth 유저를 만든다.
 */
async function ensureAuthUserForGuest(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  guestId: string | null,
) {
  const existing = await supabase.auth.admin.getUserById(userId);
  if (existing.data.user) return;

  const emailLocal = userId.replace(/-/g, '').slice(0, 16);
  const { error } = await supabase.auth.admin.createUser({
    id: userId,
    email: `guest_${emailLocal}@pokesuika.local`,
    email_confirm: true,
    user_metadata: {
      guest: true,
      guestId: guestId ?? undefined,
    },
  });

  if (error && !/already|registered|exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

/**
 * GET /api/game-replays?userId=<uuid>
 * 게스트·로그인 모두 user_id 로 조회
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { ok: false, error: 'userId required' },
        { status: 400 },
      );
    }
    if (!UUID_PATTERN.test(userId)) {
      return Response.json({ ok: false, error: 'invalid userId' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('game_replays')
      .select('id, score, max_grade, duration_sec, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

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
 * 게스트도 user_id(UUID)에 저장. 필요 시 auth.users 에 게스트 계정 생성.
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
    await ensureAuthUserForGuest(supabase, userId, guestId);

    const { data, error } = await supabase
      .from('game_replays')
      .insert({
        user_id: userId,
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
