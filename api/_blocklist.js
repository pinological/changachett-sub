// Name blocklist. Add words in lowercase, no spaces.
// Names are normalised first (lowercase, leetspeak undone, spaces/_/- removed) before checking.
//
// SUBSTRING: long or unmistakable words, blocked anywhere inside a name ("xxfuckxx").
// TOKEN: short words that also appear inside innocent words ("class", "Dickson", "computing"),
//        so they are only blocked as a whole word ("big ass", "dick_99").

export const SUBSTRING = [
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigger', 'nigga', 'faggot', 'slut', 'whore',
  'bastard', 'asshole', 'rapist', 'raping', 'nazi', 'hitler', 'porn', 'penis', 'vagina',
  'retard', 'boobs', 'dildo', 'wank', 'jerkoff', 'motherf',
  // Nepali (romanised)
  'muji', 'mugi', 'mujhi', 'randi', 'machikne', 'machikney', 'chikne', 'chikney', 'laado', 'kukurko', 'gaandu',
  // Hindi (romanised)
  'chutiya', 'chutia', 'chootiya', 'madarchod', 'maderchod', 'bhenchod', 'behenchod', 'bhanchod',
  'bhosdi', 'bhosda', 'bhosri', 'gandu', 'lauda', 'lavda', 'harami', 'haramkhor', 'kamina', 'kamine',
];

export const TOKEN = [
  // English
  'ass', 'fag', 'sex', 'cum', 'tit', 'tits', 'rape', 'kys', 'wtf', 'stfu', 'fck', 'fk', 'fuk',
  'dick', 'cock', 'dickhead',
  // Nepali / Hindi
  'gaand', 'lund', 'loda', 'lodu', 'lado', 'puti', 'chod', 'kutta', 'kutti', 'saala', 'saali',
  'chak', 'geda', 'kukur', 'khate', 'boksi', 'bhalu',
];
