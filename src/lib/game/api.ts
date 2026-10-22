import { supabase } from "@/lib/supabase";
import type { Question } from "@/lib/questions/types";
import type { Answer, Phase, Player, Room, SetRow } from "./types";
import { writeStored } from "./useStored";

// ---------------------------------------------------------------------------
// Keys the browser keeps so a person can prove they own a set, a room, or a
// seat. Nothing here is an account; closing the tab keeps the key, clearing
// site data loses it, and that's the whole model.
// ---------------------------------------------------------------------------

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: writeStored,
};

export const storageKey = {
  edit: (setId: string) => `retake:set:${setId}`,
  host: (code: string) => `retake:host:${code}`,
  seat: (code: string) => `retake:seat:${code}`,
};

export interface Seat {
  playerId: string;
  playerKey: string;
  name: string;
}

export function parseSeat(raw: string | null): Seat | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Seat;
  } catch {
    return null;
  }
}

export const keys = {
  editKey: (setId: string) => store.get(storageKey.edit(setId)),
  hostKey: (code: string) => store.get(storageKey.host(code)),
  seat: (code: string): Seat | null => parseSeat(store.get(storageKey.seat(code))),
};

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export async function createSet(title: string, questions: Question[], sourceName?: string): Promise<string> {
  const { data, error } = await supabase().rpc("create_set", {
    p_title: title,
    p_questions: questions,
    p_source_name: sourceName ?? null,
  });
  if (error) throw error;
  store.set(storageKey.edit(data.id), data.edit_key);
  return data.id as string;
}

export async function updateSet(id: string, title: string, questions: Question[]): Promise<void> {
  const editKey = keys.editKey(id);
  if (!editKey) throw new Error("This set was made on another device, so it can't be edited here.");
  const { error } = await supabase().rpc("update_set", { p_id: id, p_edit_key: editKey, p_title: title, p_questions: questions });
  if (error) throw error;
}

export async function getSet(id: string): Promise<SetRow | null> {
  const { data, error } = await supabase().from("sets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SetRow | null;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function createRoom(setId: string, seconds: number): Promise<string> {
  const { data, error } = await supabase().rpc("create_room", { p_set_id: setId, p_seconds: seconds });
  if (error) throw error;
  store.set(storageKey.host(data.code), data.host_key);
  return data.code as string;
}

export async function getRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase().from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

export async function setPhase(code: string, phase: Phase, index?: number): Promise<void> {
  const hostKey = keys.hostKey(code);
  if (!hostKey) throw new Error("Only the device that started this game can run it.");
  const { error } = await supabase().rpc("host_set_phase", {
    p_code: code,
    p_host_key: hostKey,
    p_phase: phase,
    p_index: index ?? null,
  });
  if (error) throw error;
}

export async function listPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await supabase().from("players").select("*").eq("room_id", roomId).order("joined_at");
  if (error) throw error;
  return data as Player[];
}

export async function listAnswers(roomId: string): Promise<Answer[]> {
  const { data, error } = await supabase().from("answers").select("*").eq("room_id", roomId);
  if (error) throw error;
  return data as Answer[];
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function joinRoom(code: string, name: string): Promise<{ playerId: string; name: string }> {
  const { data, error } = await supabase().rpc("join_room", { p_code: code, p_name: name });
  if (error) throw error;
  const seat = { playerId: data.player_id, playerKey: data.player_key, name: data.name };
  store.set(storageKey.seat(code.toUpperCase()), JSON.stringify(seat));
  return { playerId: seat.playerId, name: seat.name };
}

export async function submitAnswer(
  code: string,
  questionIndex: number,
  choice: string,
): Promise<{ correct: boolean; points: number; answer: string | null }> {
  const seat = keys.seat(code.toUpperCase());
  if (!seat) throw new Error("You're not in this game.");
  const { data, error } = await supabase().rpc("submit_answer", {
    p_code: code,
    p_player_key: seat.playerKey,
    p_question_index: questionIndex,
    p_choice: choice,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/**
 * Subscribe to everything that changes in one room. Returns an unsubscribe.
 * Each callback gets the full fresh row set so callers never have to merge
 * partial events themselves.
 */
export function watchRoom(
  room: Room,
  handlers: {
    onRoom?: (room: Room) => void;
    onPlayers?: (players: Player[]) => void;
    onAnswers?: (answers: Answer[]) => void;
  },
): () => void {
  const sb = supabase();
  let playersTimer: ReturnType<typeof setTimeout> | null = null;
  let answersTimer: ReturnType<typeof setTimeout> | null = null;

  // Refetching on each event is simpler than merging, and a class of 30
  // never produces enough events to make it expensive.
  const refreshPlayers = () => {
    if (playersTimer) clearTimeout(playersTimer);
    playersTimer = setTimeout(() => listPlayers(room.id).then((p) => handlers.onPlayers?.(p)).catch(() => {}), 80);
  };
  const refreshAnswers = () => {
    if (answersTimer) clearTimeout(answersTimer);
    answersTimer = setTimeout(() => listAnswers(room.id).then((a) => handlers.onAnswers?.(a)).catch(() => {}), 80);
  };

  // A phase change is the moment everyone looks at the screen, so make
  // sure the players and answers under it are fresh too, even if a realtime
  // event for them was dropped.
  let lastPhaseKey = `${room.phase}:${room.current_index}`;
  const onRoom = (r: Room) => {
    handlers.onRoom?.(r);
    const key = `${r.phase}:${r.current_index}`;
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      refreshPlayers();
      refreshAnswers();
    }
  };

  const channel = sb
    .channel(`room:${room.code}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
      onRoom(payload.new as Room);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, refreshPlayers)
    .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${room.id}` }, refreshAnswers)
    .subscribe((status, err) => {
      if (status !== "SUBSCRIBED") console.debug("retake realtime", status, err?.message ?? "");
    });

  // Belt and braces: realtime can drop on flaky school wifi, so poll the room
  // row slowly too. Phases change every ~20s, so 4s polling is plenty.
  const poll = setInterval(() => {
    getRoom(room.code)
      .then((r) => r && onRoom(r))
      .catch(() => {});
  }, 4000);

  return () => {
    clearInterval(poll);
    if (playersTimer) clearTimeout(playersTimer);
    if (answersTimer) clearTimeout(answersTimer);
    sb.removeChannel(channel);
  };
}
