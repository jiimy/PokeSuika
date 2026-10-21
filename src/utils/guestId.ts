const GUEST_KEY = 'pokesuika:guest-id';
const GUEST_USER_UUID_KEY = 'pokesuika:guest-user-uuid';
const GUEST_PATTERN = /^guest\d{5}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuestIdentity = {
  /** 화면 표시용 (guest01234) */
  guestId: string;
  /** game_replays.user_id 에 저장·조회하는 UUID */
  userId: string;
};

/** 비로그인 게스트 표시 ID (예: guest01234). localStorage 에 유지. */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest00000';

  const existing = window.localStorage.getItem(GUEST_KEY);
  if (existing && GUEST_PATTERN.test(existing)) {
    return existing;
  }

  const n = Math.floor(Math.random() * 100_000);
  const id = `guest${String(n).padStart(5, '0')}`;
  window.localStorage.setItem(GUEST_KEY, id);
  return id;
}

/** 게스트용 안정 UUID (game_replays.user_id). */
export function getOrCreateGuestUserId(): string {
  if (typeof window === 'undefined') {
    return '00000000-0000-4000-8000-000000000000';
  }

  const existing = window.localStorage.getItem(GUEST_USER_UUID_KEY);
  if (existing && UUID_PATTERN.test(existing)) {
    return existing;
  }

  const id = crypto.randomUUID();
  window.localStorage.setItem(GUEST_USER_UUID_KEY, id);
  return id;
}

export function getOrCreateGuestIdentity(): GuestIdentity {
  return {
    guestId: getOrCreateGuestId(),
    userId: getOrCreateGuestUserId(),
  };
}

export function readStoredGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  const existing = window.localStorage.getItem(GUEST_KEY);
  return existing && GUEST_PATTERN.test(existing) ? existing : null;
}

export function readStoredGuestUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const existing = window.localStorage.getItem(GUEST_USER_UUID_KEY);
  return existing && UUID_PATTERN.test(existing) ? existing : null;
}
