import { type NextRequest } from 'next/server';

import type { ReplayData, SaveReplayPayload } from '@/types/replay';
import { createAdminClient } from '@/utils/supabase/admin';

const GUEST_PATTERN = /^guest\d{5}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_LIMIT = 200;

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
 * 게스트 UUID 가 없으면 auth 유저를 만든다. 있으면 guestId 메타데이터를 맞춘다.
 */
async function ensureAuthUserForGuest(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  guestId: string | null,
) {
  const existing = await supabase.auth.admin.getUserById(userId);
  if (existing.data.user) {
    if (
      guestId &&
      existing.data.user.user_metadata?.guestId !== guestId
    ) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existing.data.user.user_metadata,
          guest: true,
          guestId,
        },
      });
    }
    return;
  }

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

/** 같은 표시용 guestId 로 만들어진 auth 유저 UUID 모으기 */
async function findAuthUserIdsByGuestId(
  supabase: ReturnType<typeof createAdminClient>,
  guestId: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      if (user.user_metadata?.guestId === guestId) {
        ids.push(user.id);
      }
    }
    if (data.users.length < 100) break;
  }
  return ids;
}

/**
 * GET /api/game-replays?userId=<uuid>&userIds=a,b&guestId=guest01234
 * userId / userIds / guestId(메타데이터 매칭) 를 합쳐 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const userIdsParam = request.nextUrl.searchParams.get('userIds');
    const guestId = request.nextUrl.searchParams.get('guestId');

    const userIds = new Set<string>();
    if (userId && UUID_PATTERN.test(userId)) userIds.add(userId);
    if (userIdsParam) {
      for (const id of userIdsParam.split(',')) {
        const trimmed = id.trim();
        if (UUID_PATTERN.test(trimmed)) userIds.add(trimmed);
      }
    }
    if (guestId && !GUEST_PATTERN.test(guestId)) {
      return Response.json({ ok: false, error: 'invalid guestId' }, { status: 400 });
    }

    if (userIds.size === 0 && !guestId) {
      return Response.json(
        { ok: false, error: 'userId or guestId required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    if (guestId) {
      const linked = await findAuthUserIdsByGuestId(supabase, guestId);
      for (const id of linked) userIds.add(id);
    }

    if (userIds.size === 0) {
      return Response.json(
        { ok: true, items: [] },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data, error } = await supabase
      .from('game_replays')
      .select('id, score, max_grade, duration_sec, created_at, user_id')
      .in('user_id', [...userIds])
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    if (error) {
      console.error('[GET /api/game-replays]', error);
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return Response.json(
      { ok: true, items: data ?? [], total: data?.length ?? 0 },
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
