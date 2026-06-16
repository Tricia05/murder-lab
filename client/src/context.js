import { createContext, useContext } from 'react';

// Shared game context: { room, me, messages, act, leave }
//  - room: public room state from the server
//  - me:   this player's private state (role, killer info, ...)
//  - act:  act(event, payload) -> Promise<ack>; shows a toast on error
export const GameContext = createContext(null);

export function useGame() {
  return useContext(GameContext);
}

/** Human-readable labels for every game phase. */
export const PHASE_LABELS = {
  lobby: 'Lobby',
  dealing: 'Dealing Cards & Assigning Roles',
  killerSelect: 'The Crime',
  forensic: 'Forensic Analysis',
  discussion: 'Investigation',
  witnessGuess: 'The Final Guess',
  reveal: 'Case Closed',
  scoreboard: 'Scoreboard',
};
