import 'server-only';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { createAdminClient } from '@/utils/supabase/admin';
import { isGoogleLinked } from '@/utils/auth/googleUser';
import { getSession } from '@/utils/auth/session';

const GOOGLE_LINK_COOKIE = 'google_link';
const GOOGLE_LINK_FLASH_COOKIE = 'google_link_flash';
const GOOGLE_LINK_MAX_AGE_SEC = 60 * 10;

function getEncodedKey() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function setGoogleLinkCookie(userId: string): Promise<void> {
  const token = await new SignJWT({ userId, purpose: 'google_link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_LINK_MAX_AGE_SEC}s`)
    .sign(getEncodedKey());

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_LINK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_LINK_MAX_AGE_SEC,
  });
}

export async function getGoogleLinkUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_LINK_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    });
    if (payload.purpose !== 'google_link') return null;

    const { userId } = payload as { userId?: unknown };
    if (typeof userId === 'string') return userId;
    if (typeof userId === 'number') return String(userId);
    return null;
  } catch {
    return null;
  }
}

/**
 * Google 연동 대상 userId 를 결정합니다.
 * 1) prepareGoogleLink 가 설정한 쿠키
 * 2) OAuth 콜백 시점에도 유지되는 앱 세션 (쿠키 유실 fallback)
 */
export async function resolveGoogleLinkUserId(): Promise<string | null> {
  const fromCookie = await getGoogleLinkUserId();
  if (fromCookie) return fromCookie;

  const session = await getSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('security_question')
    .eq('id', session.userId)
    .maybeSingle();

  if (error || !user) return null;
  if (isGoogleLinked(user.security_question as string)) return null;

  return session.userId;
}

export async function clearGoogleLinkCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GOOGLE_LINK_COOKIE);
}

export type GoogleLinkFlash = {
  type: 'success' | 'error';
  message: string;
};

export async function setGoogleLinkFlash(
  message: string,
  type: GoogleLinkFlash['type'],
): Promise<void> {
  const token = await new SignJWT({ message, type, purpose: 'google_link_flash' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(getEncodedKey());

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_LINK_FLASH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60,
  });
}

/** Server Component 렌더 중 호출 — 읽기만 합니다. */
export async function getGoogleLinkFlash(): Promise<GoogleLinkFlash | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_LINK_FLASH_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    });
    if (payload.purpose !== 'google_link_flash') return null;

    const { message, type } = payload as {
      message?: unknown;
      type?: unknown;
    };
    if (typeof message !== 'string') return null;
    if (type !== 'success' && type !== 'error') return null;

    return { message, type };
  } catch {
    return null;
  }
}

/** Server Action / Route Handler 에서만 호출하세요. */
export async function deleteGoogleLinkFlashCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GOOGLE_LINK_FLASH_COOKIE);
}
