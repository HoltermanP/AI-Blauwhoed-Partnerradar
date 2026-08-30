// US-11: projectprofiel voorvullen uit een projectdocument / programma van eisen.
// Elk veld krijgt herkomst (citaat uit het document). Niets wordt opgeslagen zonder bevestiging.
import { geocode } from "./geo";
import type { Bouwstijl, Herkomst, Prijssegment, Projecttype } from "./types";

export type Extractie = {
  velden: {
    naam?: string;
    type?: Projecttype;
    plaats?: string;
    woningen?: number;
    prijssegment?: Prijssegment[];
    bouwstijl?: Bouwstijl;
    ambitieDuurzaamheid?: 1 | 2 | 3 | 4 | 5;
    start?: string;
    eind?: string;
    omschrijving?: string;
  };
  herkomst: Herkomst[];
  provider: string;
};

function citaat(tekst: string, index: number, lengte: number) {
  return tekst.slice(Math.max(0, index - 60), index + lengte + 60).replace(/\s+/g, " ").trim();
}

export function extraheerProjectprofiel(tekst: string): Extractie {
  const velden: Extractie["velden"] = {};
  const herkomst: Herkomst[] = [];
  const t = tekst;

  const naam = t.match(/(?:project(?:naam)?|plan)\s*[:：]\s*([^\n]{3,80})/i) ?? t.match(/^#?\s*([A-Z][^\n]{3,60})\s*$/m);
  if (naam && naam.index !== undefined) {
    velden.naam = naam[1].trim();
    herkomst.push({ veld: "naam", citaat: citaat(t, naam.index, naam[0].length), betrouwbaarheid: 0.7 });
  }

  const woningen = t.match(/(\d{1,4})\s*(?:woningen|appartementen|wooneenheden|eenheden)/i);
  if (woningen && woningen.index !== undefined) {
    velden.woningen = Number(woningen[1]);
    herkomst.push({ veld: "woningen", citaat: citaat(t, woningen.index, woningen[0].length), betrouwbaarheid: 0.85 });
  }

  const typen: Array<[RegExp, Projecttype]> = [
    [/hoogbouw|woontoren|\b(1[0-9]|[2-9][0-9])\s*(?:lagen|verdiepingen|bouwlagen)/i, "hoogbouw"],
    [/transformatie|herbestemming|verbouw van/i, "transformatie"],
    [/zorgwon|senioren|verpleeg/i, "zorgwonen"],
    [/gebiedsontwikkeling|masterplan|stedenbouwkundig plan/i, "gebiedsontwikkeling"],
    [/appartement|gestapeld/i, "appartementen"],
    [/grondgebonden|eengezins|rijwoning|twee-onder-een-kap/i, "grondgebonden"]
  ];
  for (const [re, type] of typen) {
    const m = t.match(re);
    if (m && m.index !== undefined) {
      velden.type = type;
      herkomst.push({ veld: "type", citaat: citaat(t, m.index, m[0].length), betrouwbaarheid: 0.7 });
      break;
    }
  }

  const plaats = t.match(/(?:locatie|gemeente|plaats|in)\s*[:：]?\s*([A-Z][a-zA-Z' -]{2,30})/);
  if (plaats && plaats.index !== undefined) {
    const kandidaten = plaats[1].split(/\s+/);
    for (let i = kandidaten.length; i > 0; i--) {
      const naam = kandidaten.slice(0, i).join(" ");
      if (geocode(naam)) {
        velden.plaats = naam;
        herkomst.push({ veld: "plaats", citaat: citaat(t, plaats.index, plaats[0].length), betrouwbaarheid: 0.75 });
        break;
      }
    }
  }
  if (!velden.plaats) {
    for (const stad of ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Arnhem", "Haarlem", "Amersfoort", "Zaandam", "Zwolle", "Leiden", "Delft", "Apeldoorn", "Deventer", "Maastricht", "Dordrecht", "Hoorn", "Alkmaar", "Hilversum", "Gouda", "Purmerend", "Ede", "Woerden", "Lelystad"]) {
      const idx = t.indexOf(stad);
      if (idx >= 0) {
        velden.plaats = stad;
        herkomst.push({ veld: "plaats", citaat: citaat(t, idx, stad.length), betrouwbaarheid: 0.6 });
        break;
      }
    }
  }

  const segmenten: Array<[RegExp, Prijssegment]> = [
    [/sociale?\s*huur|sociaal/i, "sociaal"],
    [/middenhuur|midden(?:segment| huur)|betaalbare huur/i, "middenhuur"],
    [/koopwoning|koop\b/i, "koop"],
    [/vrije\s*sector/i, "vrije sector"]
  ];
  const gevonden: Prijssegment[] = [];
  segmenten.forEach(([re, seg]) => {
    const m = t.match(re);
    if (m && m.index !== undefined) {
      gevonden.push(seg);
      herkomst.push({ veld: "prijssegment", citaat: citaat(t, m.index, m[0].length), betrouwbaarheid: 0.7 });
    }
  });
  if (gevonden.length) velden.prijssegment = gevonden;

  const stijlen: Array<[RegExp, Bouwstijl]> = [
    [/hoogstedelijk|metropolitaan/i, "hoogstedelijk"],
    [/industri[eë]le?\s*(?:uitstraling|stijl|architectuur)/i, "industrieel"],
    [/dorps|landelijk/i, "dorps"],
    [/traditione(?:el|le)|jaren\s?30|klassiek/i, "traditioneel"],
    [/modern|eigentijds|strak/i, "modern"]
  ];
  for (const [re, stijl] of stijlen) {
    const m = t.match(re);
    if (m && m.index !== undefined) {
      velden.bouwstijl = stijl;
      herkomst.push({ veld: "bouwstijl", citaat: citaat(t, m.index, m[0].length), betrouwbaarheid: 0.6 });
      break;
    }
  }

  const ambitie = t.match(/(paris\s*proof|energiepositief|mpg\s*[<≤]\s*0[.,][2-4]|biobased|circulair|houtbouw|clt|beng|energieneutraal|nul-op-de-meter|gasloos)/gi);
  if (ambitie) {
    const n = new Set(ambitie.map((a) => a.toLowerCase())).size;
    velden.ambitieDuurzaamheid = (Math.min(5, Math.max(2, 1 + n)) as 1 | 2 | 3 | 4 | 5);
    const idx = t.search(/(paris\s*proof|energiepositief|mpg|biobased|circulair|houtbouw|clt|beng|energieneutraal|nul-op-de-meter|gasloos)/i);
    herkomst.push({ veld: "ambitieDuurzaamheid", citaat: citaat(t, idx, 20), betrouwbaarheid: 0.55 });
  }

  const start = t.match(/(?:start(?:\s*bouw)?|aanvang)[^0-9]{0,20}(20\d{2})(?:-(\d{2}))?/i);
  if (start && start.index !== undefined) {
    velden.start = `${start[1]}-${start[2] ?? "01"}-01`;
    herkomst.push({ veld: "start", citaat: citaat(t, start.index, start[0].length), betrouwbaarheid: 0.7 });
  }
  const eind = t.match(/(?:oplevering|gereed|einde?)[^0-9]{0,20}(20\d{2})(?:-(\d{2}))?/i);
  if (eind && eind.index !== undefined) {
    velden.eind = `${eind[1]}-${eind[2] ?? "12"}-01`;
    herkomst.push({ veld: "eind", citaat: citaat(t, eind.index, eind[0].length), betrouwbaarheid: 0.7 });
  }

  velden.omschrijving = t.replace(/\s+/g, " ").trim().slice(0, 600);
  herkomst.push({ veld: "omschrijving", citaat: "Eerste 600 tekens van het document.", betrouwbaarheid: 0.5 });

  return { velden, herkomst, provider: "regels (geen externe AI)" };
}
