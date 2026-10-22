import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").trim().split("\n").map(l=>l.split("=")));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: setRow } = await sb.from("sets").select("id").order("created_at",{ascending:false}).limit(1).single();
const { data: room } = await sb.rpc("create_room", { p_set_id: setRow.id, p_seconds: 30 });
const { data: r } = await sb.from("rooms").select("*").eq("code", room.code).single();
const got = { rooms: 0, players: 0, answers: 0 };
const t0 = Date.now();
const ch = sb.channel("t:"+room.code)
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${r.id}` }, () => { got.rooms++; console.log("rooms event", Date.now()-t0, "ms"); })
  .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${r.id}` }, () => { got.players++; console.log("players event", Date.now()-t0, "ms"); })
  .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${r.id}` }, () => { got.answers++; console.log("answers event", Date.now()-t0, "ms"); })
  .subscribe((status, err) => console.log("status", status, err?.message ?? ""));
await new Promise(res => setTimeout(res, 2500));
const { data: seat } = await sb.rpc("join_room", { p_code: room.code, p_name: "RT" });
await sb.rpc("host_set_phase", { p_code: room.code, p_host_key: room.host_key, p_phase: "question", p_index: 0 });
await new Promise(res => setTimeout(res, 800));
const a = await sb.rpc("submit_answer", { p_code: room.code, p_player_key: seat.player_key, p_question_index: 0, p_choice: "B" });
console.log("answer rpc", a.error?.message ?? a.data);
await new Promise(res => setTimeout(res, 5000));
console.log("events", got);
await sb.removeChannel(ch);
process.exit(0);
