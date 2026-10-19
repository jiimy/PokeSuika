import 'server-only';

import { cookies } from 'next/headers';
import { decodeJwt, SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일
/** 만료 7일 전부터 JWT·쿠키를 갱신합니다. */
const SESSION_REFRESH_BEFORE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  user_id: string;
};

function assertSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  }
}

function getEncodedKey() {
  assertSecret();
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

function shouldRefreshSession(token: string): boolean {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp !== 'number') return true;

    const remaining = exp - Math.floor(Date.now() / 1000);
    return remaining < SESSION_REFRESH_BEFORE_SEC;
  } catch {
    return false;
  }
}

/** payload 를 JWT 로 서명합니다. (HS256, 30일 만료) */
export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: String(payload.userId),
    user_id: payload.user_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getEncodedKey());
}

/** JWT 를 검증하고 payload 를 반환합니다. 실패 시 null. */
export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    });
    const { userId, user_id } = payload as {
      userId?: unknown;
      user_id?: unknown;
    };
    if (
      (typeof userId === 'string' || typeof userId === 'number') &&
      typeof user_id === 'string'
    ) {
      return { userId: String(userId), user_id };
    }
    return null;
  } catch {
    return null;
  }
}

/** 세션 JWT 를 HttpOnly 쿠키로 저장합니다. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/** 현재 요청의 세션 payload 를 반환합니다. 유효하면 만료 전 갱신합니다. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = await decryptSession(token);
  if (!payload || !token) return null;

  if (shouldRefreshSession(token)) {
    await createSession(payload);
  }

  return payload;
}

/** 앱 세션 + NextAuth 쿠키를 삭제합니다. (로그아웃) */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);

  const nextAuthCookies = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
  ];

  for (const name of nextAuthCookies) {
    cookieStore.delete(name);
  }
}
