import 'server-only';

import { randomUUID } from 'crypto';
import { hash } from 'bcrypt-ts';

import { createAdminClient } from '@/utils/supabase/admin';

export const GOOGLE_MARKER_PREFIX = '__oauth_google__:';
const SALT_ROUNDS = 10;

export class GoogleLinkError extends Error {
  constructor(
    public readonly code: 'ALREADY_LINKED' | 'ALREADY_LINKED_OTHER',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleLinkError';
  }
}

export function googleSecurityQuestion(sub: string): string {
  return `${GOOGLE_MARKER_PREFIX}${sub}`;
}

export function isGoogleLinked(securityQuestion: string): boolean {
  return securityQuestion.includes(GOOGLE_MARKER_PREFIX);
}

export function getGoogleSubFromSecurityQuestion(
  securityQuestion: string,
): string | null {
  const idx = securityQuestion.indexOf(GOOGLE_MARKER_PREFIX);
  if (idx === -1) return null;
  return securityQuestion.slice(idx + GOOGLE_MARKER_PREFIX.length);
}

export function getPasswordResetQuestion(securityQuestion: string): string {
  const markerIndex = securityQuestion.indexOf(`|${GOOGLE_MARKER_PREFIX}`);
  if (markerIndex === -1) return securityQuestion;
  return securityQuestion.slice(0, markerIndex);
}

function buildLinkedSecurityQuestion(
  currentSecurityQuestion: string,
  googleSub: string,
): string {
  const base = currentSecurityQuestion.split(`|${GOOGLE_MARKER_PREFIX}`)[0];
  return `${base}|${googleSecurityQuestion(googleSub)}`;
}

function sanitizeUserId(name: string): string {
  const trimmed = name.trim().slice(0, 20);
  if (trimmed.length >= 2) return trimmed;
  return `user_${randomUUID().slice(0, 8)}`;
}

async function resolveUniqueUserId(base: string): Promise<string> {
  const supabase = createAdminClient();
  let candidate = sanitizeUserId(base);
  let suffix = 0;

  while (suffix <= 99) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('user_id', candidate)
      .maybeSingle();

    if (!data) return candidate;

    suffix += 1;
    const trimmedBase = sanitizeUserId(base);
    candidate = `${trimmedBase.slice(0, Math.max(2, 17 - String(suffix).length))}_${suffix}`.slice(
      0,
      20,
    );
  }

  return `g_${randomUUID().slice(0, 8)}`;
}

async function findUserByGoogleSub(googleSub: string) {
  const supabase = createAdminClient();
  const marker = googleSecurityQuestion(googleSub);

  const { data, error } = await supabase
    .from('users')
    .select('id, user_id, security_question')
    .ilike('security_question', `%${marker}`)
    .maybeSingle();

  if (error) {
    console.error('[googleOAuth] lookup error:', error);
    throw new Error('Google 로그인 처리 중 오류가 발생했습니다.');
  }

  return data ?? null;
}

async function countUserRelatedRows(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  const checks = [
    supabase.from('teams').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('public_teams').select('*', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('team_likes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ];

  const results = await Promise.all(checks);
  return results.reduce((sum, { count, error }) => {
    if (error) {
      console.error('[googleOAuth] related row count error:', error);
      throw new Error('Google 연동 처리 중 오류가 발생했습니다.');
    }
    return sum + (count ?? 0);
  }, 0);
}

async function removeEmptyDuplicateGoogleUser(duplicateUserId: string): Promise<void> {
  const supabase = createAdminClient();
  const relatedCount = await countUserRelatedRows(supabase, duplicateUserId);

  if (relatedCount > 0) {
    throw new GoogleLinkError(
      'ALREADY_LINKED_OTHER',
      '이 Google 계정은 다른 사용자 데이터와 이미 연결되어 있습니다.',
    );
  }

  const { error } = await supabase.from('users').delete().eq('id', duplicateUserId);
  if (error) {
    console.error('[googleOAuth] duplicate user delete error:', error);
    throw new Error('Google 연동 처리 중 오류가 발생했습니다.');
  }
}

export type GoogleUserResult = {
  id: string;
  user_id: string;
};

export async function linkGoogleToUser(params: {
  userId: string;
  googleSub: string;
}): Promise<GoogleUserResult> {
  const { userId, googleSub } = params;
  const supabase = createAdminClient();

  const existingGoogleUser = await findUserByGoogleSub(googleSub);
  if (existingGoogleUser && String(existingGoogleUser.id) !== userId) {
    await removeEmptyDuplicateGoogleUser(String(existingGoogleUser.id));
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, user_id, security_question')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    throw new Error('연동할 사용자 정보를 찾을 수 없습니다.');
  }

  const currentSecurityQuestion = user.security_question as string;
  if (isGoogleLinked(currentSecurityQuestion)) {
    throw new GoogleLinkError(
      'ALREADY_LINKED',
      '이미 Google 계정과 연동되어 있습니다.',
    );
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      security_question: buildLinkedSecurityQuestion(
        currentSecurityQuestion,
        googleSub,
      ),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[googleOAuth] link update error:', updateError);
    throw new Error('Google 연동 처리 중 오류가 발생했습니다.');
  }

  return {
    id: String(user.id),
    user_id: user.user_id as string,
  };
}

export async function findOrCreateGoogleUser(params: {
  googleSub: string;
  name?: string | null;
  email?: string | null;
}): Promise<GoogleUserResult> {
  const { googleSub, name, email } = params;
  const existing = await findUserByGoogleSub(googleSub);

  if (existing) {
    return {
      id: String(existing.id),
      user_id: existing.user_id as string,
    };
  }

  const supabase = createAdminClient();
  const marker = googleSecurityQuestion(googleSub);
  const displayBase = name?.trim() || email?.split('@')[0] || 'google_user';
  const user_id = await resolveUniqueUserId(displayBase);
  const placeholderHash = await hash(randomUUID(), SALT_ROUNDS);

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({
      user_id,
      password_hash: placeholderHash,
      security_question: marker,
      security_answer_hash: placeholderHash,
    })
    .select('id, user_id')
    .single();

  if (insertError || !created) {
    console.error('[googleOAuth] insert error:', insertError);
    throw new Error('Google 로그인 처리 중 오류가 발생했습니다.');
  }

  return {
    id: String(created.id),
    user_id: created.user_id as string,
  };
}
