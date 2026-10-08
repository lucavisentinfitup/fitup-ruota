// Meccanica "Gira i contatti e Gira la ruota": 1 giro ogni 5 contatti portati in reception.
// Testi usati dallo schermo TV (modalità "regolamento") e dalla pagina /regolamento.

export const CONTACTS_PER_SPIN = 5;

export const REFERRAL_TAGLINE = "Presenta 5 contatti e Gira la ruota in reception!";

export const REFERRAL_HEADLINE = "Gira i contatti e Gira la ruota!";

/** Giri ottenuti con un certo numero di contatti (5 → 1, 10 → 2, 15 → 3…). */
export const spinsFor = (contacts: number) => Math.floor(Math.max(0, contacts) / CONTACTS_PER_SPIN);
