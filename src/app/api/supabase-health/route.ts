import { createAdminClient } from '@/utils/supabase/admin';

/**
 * GET /api/supabase-health
 * .env 의 Supabase URL·service_role 로 연결 가능한지 확인합니다.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    // 실제 테이블이 없어도 연결/인증은 확인 가능
    const { error } = await supabase.from('_health_check').select('*').limit(1);

    // 테이블 없음(42P01 / PGRST205)도 "연결 자체는 성공"으로 간주
    const connected =
      !error ||
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /relation|schema cache|does not exist/i.test(error.message);

    if (!connected) {
      return Response.json(
        {
          ok: false,
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
          error: error.message,
          code: error.code,
        },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      note: error
        ? `연결됨 (샘플 테이블 없음: ${error.code ?? 'unknown'})`
        : '연결됨',
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
