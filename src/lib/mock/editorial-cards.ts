import type { EditorialCard } from "@/lib/api/client";

const base = { session_id: "demo", visible: true, created_at: "", updated_at: "" } as const;

const ARS = { name: "Arsenal", color: "#EF0107" };
const CHE = { name: "Chelsea", color: "#034694" };

/** Sample payloads for every card type — used by the /overlay/demo preview page. */
export const mockEditorialCards: EditorialCard[] = [
  {
    ...base, id: "intro", card_type: "fixture_intro", title: "Match preview",
    payload: { competition: "Premier League", home: ARS, away: CHE, kickoff_label: "Saturday · 17:30", venue: "Emirates Stadium, London" },
  },
  {
    ...base, id: "lineups", card_type: "lineups", title: "Line-ups",
    payload: {
      home: { formation: "4-3-3", players: [
        ["Raya", 22, "GK"], ["White", 4, "RB"], ["Saliba", 2, "CB"], ["Gabriel Magalhães", 6, "CB"], ["Timber", 12, "LB"],
        ["Rice", 41, "CM"], ["Ødegaard", 8, "CM"], ["Merino", 23, "CM"], ["Saka", 7, "RW"], ["Havertz", 29, "ST"], ["Martinelli", 11, "LW"],
      ].map(([name, number, position]) => ({ name, number, position })) },
      away: { formation: "4-2-3-1", players: [
        ["Sánchez", 1, "GK"], ["Gusto", 27, "RB"], ["Colwill", 26, "CB"], ["Chalobah", 23, "CB"], ["Cucurella", 3, "LB"],
        ["Caicedo", 25, "DM"], ["Lavia", 45, "DM"], ["Palmer", 20, "AM"], ["Madueke", 11, "RW"], ["Neto", 7, "LW"], ["Jackson", 15, "ST"],
      ].map(([name, number, position]) => ({ name, number, position })) },
    },
  },
  {
    ...base, id: "standings", card_type: "standings", title: "Standings",
    payload: { competition: "Premier League", rows: [
      ["Liverpool", 10, 25], ["Arsenal", 10, 22], ["Man City", 10, 20], ["Chelsea", 10, 19], ["Aston Villa", 10, 18],
      ["Newcastle", 10, 17], ["Tottenham", 10, 16], ["Brighton", 10, 15], ["Fulham", 10, 14], ["Brentford", 10, 13],
    ].map(([team, played, points], i) => ({ position: i + 1, team, played, points })) },
  },
  {
    ...base, id: "form", card_type: "form", title: "Form",
    payload: { team: "Arsenal", results: [
      { outcome: "W", opponent: "Spurs", score: "3-1" }, { outcome: "W", opponent: "Wolves", score: "2-0" },
      { outcome: "D", opponent: "Man City", score: "1-1" }, { outcome: "W", opponent: "Brentford", score: "2-1" },
      { outcome: "L", opponent: "Newcastle", score: "0-1" },
    ] },
  },
  {
    ...base, id: "h2h", card_type: "head_to_head", title: "Head to head",
    payload: { meetings: [
      { date: "Apr 2026", home: "Chelsea", away: "Arsenal", score: "1-1" },
      { date: "Nov 2025", home: "Arsenal", away: "Chelsea", score: "2-0" },
      { date: "Mar 2025", home: "Arsenal", away: "Chelsea", score: "1-0" },
      { date: "Oct 2024", home: "Chelsea", away: "Arsenal", score: "1-2" },
      { date: "Apr 2024", home: "Chelsea", away: "Arsenal", score: "2-2" },
    ] },
  },
  {
    ...base, id: "scorers", card_type: "top_scorers", title: "Top scorers",
    payload: { competition: "Premier League", players: [
      { name: "Erling Haaland", team: "MCI", goals: 11 }, { name: "Mohamed Salah", team: "LIV", goals: 9 },
      { name: "Bukayo Saka", team: "ARS", goals: 7 }, { name: "Cole Palmer", team: "CHE", goals: 6 },
      { name: "Ollie Watkins", team: "AVL", goals: 6 }, { name: "Alexander Isak", team: "NEW", goals: 5 },
    ] },
  },
  {
    ...base, id: "summary", card_type: "match_summary", title: "Full time",
    payload: { competition: "Premier League", home: ARS, away: CHE, score: { home: 2, away: 1 }, goals: [
      { minute: 14, player: "Saka", team: "Arsenal" }, { minute: 38, player: "Palmer", team: "Chelsea" }, { minute: 77, player: "Havertz", team: "Arsenal" },
    ] },
  },
  {
    ...base, id: "countdown", card_type: "countdown", title: "Countdown",
    payload: { competition: "Premier League", home_name: "Arsenal", away_name: "Chelsea", kickoff: new Date(Date.now() + 47 * 60_000 + 12_000).toISOString() },
  },
  {
    ...base, id: "ticker", card_type: "custom", title: "Next matches",
    payload: {
      kind: "ticker", label: "Next matches", source: "fixtures",
      items: [
        { text: "Today 17:30 · Arsenal v Chelsea", tag: "PL" },
        { text: "Today 20:00 · Liverpool v Man City", tag: "PL" },
        { text: "Sun 16:00 · Barcelona v Real Madrid", tag: "LL" },
        { text: "Sun 19:45 · Inter v Juventus", tag: "SA" },
        { text: "Tue 21:00 · Bayern v PSG", tag: "UCL" },
      ],
    },
  },
] as EditorialCard[];
