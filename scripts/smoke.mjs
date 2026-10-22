import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/home/claude/retake/.env.local","utf8").trim().split("\n").map(l=>l.split("=")));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth:{persistSession:false} });
const must = (r, label) => { if (r.error) { console.error(label, r.error); process.exit(1);} return r.data; };

const qs = [
  { id:"q1", number:1, stem:"Site of ATP synthesis?", choices:[{key:"A",text:"Ribosome"},{key:"B",text:"Mitochondrion"},{key:"C",text:"Golgi"},{key:"D",text:"Lysosome"}], answer:"B", warnings:[] },
  { id:"q2", number:2, stem:"Water moves from", choices:[{key:"A",text:"low to high ψ"},{key:"B",text:"high to low ψ"}], answer:"B", warnings:[] },
];
const set = must(await sb.rpc("create_set", { p_title:"Smoke test", p_questions: qs, p_source_name:"smoke.pdf" }), "create_set");
console.log("set", set.id);
// secrets must not be readable
const leak = await sb.from("set_secrets").select("*");
console.log("set_secrets readable?", leak.error ? "no ("+leak.error.code+")" : leak.data.length+" rows");
const room = must(await sb.rpc("create_room", { p_set_id:set.id, p_seconds:10 }), "create_room");
console.log("room", room.code);
const seat = must(await sb.rpc("join_room", { p_code: room.code.toLowerCase(), p_name:"  Ajay   P " }), "join_room");
console.log("seat", seat.name);
// wrong host key rejected
const bad = await sb.rpc("host_set_phase", { p_code: room.code, p_host_key:"nope", p_phase:"question", p_index:0 });
console.log("bad host key rejected?", bad.error?.message);
must(await sb.rpc("host_set_phase", { p_code: room.code, p_host_key: room.host_key, p_phase:"question", p_index:0 }), "host_set_phase");
const early = await sb.rpc("submit_answer", { p_code: room.code, p_player_key: seat.player_key, p_question_index:1, p_choice:"B" });
console.log("answer to wrong index rejected?", early.error?.message);
const a1 = must(await sb.rpc("submit_answer", { p_code: room.code, p_player_key: seat.player_key, p_question_index:0, p_choice:"B" }), "submit_answer");
console.log("answer", a1);
const dup = await sb.rpc("submit_answer", { p_code: room.code, p_player_key: seat.player_key, p_question_index:0, p_choice:"A" });
console.log("double answer rejected?", dup.error?.message);
const players = must(await sb.from("players").select("*").eq("room_id", (await sb.from("rooms").select("id").eq("code", room.code).single()).data.id), "players");
console.log("players", players.map(p=>[p.name,p.score]));
const direct = await sb.from("rooms").update({ phase:"ended" }).eq("code", room.code).select();
console.log("direct write blocked?", direct.error ? direct.error.code : (direct.data.length===0 ? "yes (0 rows)" : "NO"));
