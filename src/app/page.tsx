'use client';

import { Suspense, useState } from 'react';

import Ball from '@/components/ball/Ball';
import BasicModal from '@/components/portalModal/basicModal/BasicModal';
import type { ReplayData, ReplayListItem } from '@/types/replay';
import {
  getOrCreateGuestIdentity,
  readStoredGuestId,
} from '@/utils/guestId';

export default function Home() {
  const [guestId, setGuestId] = useState<string | null>(() => readStoredGuestId());
  const [hasReplays, setHasReplays] = useState(false);
  const [replayModal, setReplayModal] = useState(false);
  const [replayItems, setReplayItems] = useState<ReplayListItem[]>([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState('');
  const [replayToPlay, setReplayToPlay] = useState<ReplayData | null>(null);

  const openReplayModal = async () => {
    const { guestId: displayId, userId } = getOrCreateGuestIdentity();
    setGuestId(displayId);
    setReplayModal(true);
    setReplayLoading(true);
    setReplayError('');
    try {
      const res = await fetch(
        `/api/game-replays?userId=${encodeURIComponent(userId)}`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        items?: ReplayListItem[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setReplayError(json.error ?? '목록을 불러오지 못했습니다');
        setReplayItems([]);
        return;
      }
      const items = json.items ?? [];
      setReplayItems(items);
      setHasReplays(items.length > 0);
    } catch (error) {
      setReplayError(
        error instanceof Error ? error.message : '목록을 불러오지 못했습니다',
      );
    } finally {
      setReplayLoading(false);
    }
  };

  const playReplayItem = async (id: string) => {
    setReplayError('');
    try {
      const res = await fetch(`/api/game-replays/${id}`);
      const json = (await res.json()) as {
        ok?: boolean;
        item?: { replay_data: ReplayData };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.item?.replay_data) {
        setReplayError(json.error ?? '기록을 불러오지 못했습니다');
        return;
      }
      setReplayModal(false);
      setReplayToPlay(json.item.replay_data);
    } catch (error) {
      setReplayError(
        error instanceof Error ? error.message : '기록을 불러오지 못했습니다',
      );
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-950 px-4 py-8 font-sans text-slate-100">
      <header className="relative w-full max-w-[640px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            PokeSuika
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            같은 공을 합쳐 수박을 만드세요
          </p>
        </div>

        <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-2">
          {guestId || hasReplays ? (
            <button
              type="button"
              className="rounded-full border border-amber-500/60 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
              onClick={() => void openReplayModal()}
            >
              기록보기
            </button>
          ) : null}

          {guestId ? (
            <div className="rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-right">
              <p className="text-[10px] text-slate-400">게스트로 플레이 중</p>
              <p className="text-xs font-semibold tabular-nums text-sky-300">
                {guestId}
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="rounded-full border border-slate-500 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:border-slate-300 hover:bg-slate-800"
              onClick={() => {
                /* 로그인: 추후 구현 */
              }}
            >
              로그인
            </button>
          )}
        </div>
      </header>

      <Suspense
        fallback={
          <div
            className="rounded-xl border border-slate-700 bg-slate-900/60"
            style={{ width: 400, height: 560 }}
          />
        }
      >
        <Ball
          onGuestSession={setGuestId}
          onReplaySaved={() => {
            const { guestId: displayId } = getOrCreateGuestIdentity();
            setGuestId(displayId);
            setHasReplays(true);
          }}
          replayToPlay={replayToPlay}
          onReplayFinished={() => setReplayToPlay(null)}
        />
      </Suspense>

      {replayModal ? (
        <BasicModal setOnModal={setReplayModal} dimClick className="gap-3">
          <h2 className="pr-8 text-lg font-bold text-white">플레이 기록</h2>
          <p className="text-xs text-slate-400">
            기록을 선택하면 보드에서 재생됩니다.
          </p>

          {replayLoading ? (
            <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : replayError ? (
            <p className="py-8 text-center text-sm text-rose-300">{replayError}</p>
          ) : replayItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              저장된 기록이 없습니다.
            </p>
          ) : (
            <ul className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {replayItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-left transition hover:border-sky-400 hover:bg-slate-800/80"
                    onClick={() => void playReplayItem(item.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        점수 {item.score}
                        {item.max_grade != null ? (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            최고단계 {item.max_grade + 1}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatTime(item.created_at)}
                        {item.duration_sec != null
                          ? ` · ${item.duration_sec}초`
                          : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-sky-300">
                      재생
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BasicModal>
      ) : null}
    </main>
  );
}
