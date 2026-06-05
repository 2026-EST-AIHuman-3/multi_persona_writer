import { NextResponse } from "next/server";

// In-memory database for manuscripts (resets on server restart)
// Using a module-scoped variable so it persists across requests in dev mode
let manuscripts = [
  {
    id: "m-1",
    title: "The Obsidian Citadel: Act II",
    content: "The black spires of the citadel cut into the purple sky like jagged teeth. From the basalt balcony, Vaelen watched the shadow council convene, their obsidian masks catching the cold glow of the soulwells. 'This is our final march,' the Archon whispered, but Vaelen knew that shadows always belong to the ones who write them.",
    prompt: "Main protagonist confronts the shadow council. The pacing in this section required extensive rework to match the high-fantasy tone established in Act I.",
    personaId: "novel",
    loraAdapter: "LoRA: Epic Fantasy v4",
    createdAt: "2024년 10월 12일",
    status: "completed",
    wordCount: 84201
  },
  {
    id: "m-2",
    title: "Neo-Tokyo Bounties",
    content: "DR. ARISAKA: 'You look put together with second-hand fiber optics. Sit. No, don't touch that actuator.'\n\nMARLOW: 'I'm here for the implant footprint, doc. Not your medical opinion on my vintage cyberware.'\n\nDR. ARISAKA (scoffing): 'That vintage junk will fry your cerebellum if the scavengers don't peel it off your spine first. 300 credits. No warranties.'",
    prompt: "Dialogue tree for the back-alley cyber-doc encounter in a futuristic neon-drenched ghetto. Make Marlow cynical and Arisaka opportunistic.",
    personaId: "game",
    loraAdapter: "LoRA: Cyberpunk NPC",
    createdAt: "2024년 11월 05일",
    status: "draft",
    wordCount: 1450
  },
  {
    id: "m-3",
    title: "Aura Perfume Q3 Campaign",
    content: "Nature isn't bound by rules. Neither are you. Aura: sustainable luxury that whispers your presence before you arrive, and leaves an unforgettable warmth long after you depart. Ethically distilled cedarwood meets hand-harvested wild iris. Breathe the luxury that leaves no footprints. Aura, by Maison Green.",
    prompt: "Social media copy and landing page headlines focusing on sustainable luxury, ethical wild iris, and premium cedarwood notes.",
    personaId: "ad",
    loraAdapter: "LoRA: Luxury Brand Voice",
    createdAt: "2024년 9월 28일",
    status: "completed",
    wordCount: 280
  },
  {
    id: "m-4",
    title: "The Silent Orbit",
    content: "[SCENE START]\nEXT. ORBITAL STATION 12 - DECOMMISSIONED - SILENT NIGHT\n\nThe solar panels drift loose, spinning slowly like abandoned dead leaves in empty space. The main hull is dark, save for a single blinking orange distress beacon. Inside, LT. CHO (30s) presses her oxygen gauge. 4%. \n\nCHO (whispering)\nThis is Orbit 12. If anyone is listing, don't send a rescue. They... they are still inside.",
    prompt: "Feature film treatment. Hard sci-fi thriller set on a decommissioned orbital station. Heavy focus on isolation and silence.",
    personaId: "movie",
    loraAdapter: "LoRA: Noir Structure",
    createdAt: "2024년 8월 14일",
    status: "completed",
    wordCount: 890
  },
  {
    id: "m-5",
    title: "Echoes of the Valley",
    content: "The mist hung heavy in the pine bottoms of the valley, thick enough to swallow a horse and cart. 'They've lived up on the ridge since the old settlement days,' Silas said, carving a slice of pine wood by the clay stove. 'They don't take kindly to city folk coming with deeds and papers, trying to trade mountain soil for coal stock.'",
    prompt: "Historical fiction short story focusing on dialogue nuances of the 1920s Appalachian region and local forestry disputes.",
    personaId: "novel",
    loraAdapter: "LoRA: Period Dialect",
    createdAt: "2024년 7월 02일",
    status: "editing",
    wordCount: 4230
  }
];

// Helper to estimate word count
function getWordsCount(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

// GET /api/manuscripts
export async function GET() {
  return NextResponse.json(manuscripts);
}

// POST /api/manuscripts
export async function POST(request: Request) {
  const { id, title, content, prompt, personaId, loraAdapter, status } = await request.json();
  
  if (id) {
    // Update
    const idx = manuscripts.findIndex(m => m.id === id);
    if (idx !== -1) {
      manuscripts[idx] = {
        ...manuscripts[idx],
        title: title || manuscripts[idx].title,
        content: content !== undefined ? content : manuscripts[idx].content,
        prompt: prompt !== undefined ? prompt : manuscripts[idx].prompt,
        personaId: personaId || manuscripts[idx].personaId,
        loraAdapter: loraAdapter || manuscripts[idx].loraAdapter,
        status: status || manuscripts[idx].status,
        wordCount: content ? getWordsCount(content) : manuscripts[idx].wordCount
      };
      return NextResponse.json(manuscripts[idx]);
    }
  }
  
  // Create New
  const newManuscript = {
    id: `m-${Date.now()}`,
    title: title || "무제 원고",
    content: content || "",
    prompt: prompt || "",
    personaId: personaId || "novel",
    loraAdapter: loraAdapter || "General style",
    createdAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: '2-digit' }),
    status: status || "draft",
    wordCount: getWordsCount(content || "")
  };
  
  manuscripts.unshift(newManuscript);
  return NextResponse.json(newManuscript);
}
