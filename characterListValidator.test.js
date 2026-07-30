import { describe, it, expect } from 'vitest'; // remplacer par jest si besoin
import { resolveAgainstKnownList, detectKnownSpeakerCue } from './characterListValidator.js';

const KNOWN = [
  'JOHN', 'CHARLIE', 'SAM', 'JEFF PATERSON', 'William FARELL',
  'MARY', 'LOLA', 'NOLAN', 'JULIA', 'JACKIE',
];

describe('Cas réels du scan de TU M CONNAIS.pdf', () => {
  it('rejette les faux positifs (en-têtes de scène / bruit OCR)', () => {
    expect(resolveAgainstKnownList('FETE DU VILLAGE', KNOWN)).toBeNull();
    expect(resolveAgainstKnownList('LA PREMIÈRE', KNOWN)).toBeNull();
    expect(resolveAgainstKnownList('SCA', KNOWN)).toBeNull();
  });

  it('rattache la coquille JACK à JACKIE (typo de l\'auteur p.10)', () => {
    expect(resolveAgainstKnownList('JACK', KNOWN)).toBe('JACKIE');
  });

  it('reconnaît William FARELL malgré la casse mixte de sa réplique', () => {
    expect(resolveAgainstKnownList('William FARELL', KNOWN)).toBe('William FARELL');
    expect(resolveAgainstKnownList('WILLIAM FARELL', KNOWN)).toBe('William FARELL');
  });

  it('detectKnownSpeakerCue extrait correctement une réplique de William FARELL', () => {
    const result = detectKnownSpeakerCue('William FARELL : Je peux la taser, Chef ?', KNOWN);
    expect(result).toEqual({ character: 'William FARELL', text: 'Je peux la taser, Chef ?' });
  });

  it('detectKnownSpeakerCue rejette une ligne de didascalie en capitales', () => {
    const result = detectKnownSpeakerCue('FETE DU VILLAGE (MUSIQUE + LUMIERE)', KNOWN);
    expect(result).toBeNull();
  });

  it('les 10 personnages canoniques sont tous reconnus exactement', () => {
    for (const name of KNOWN) {
      expect(resolveAgainstKnownList(name, KNOWN)).toBe(name);
    }
  });
});
