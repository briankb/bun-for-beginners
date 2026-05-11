// sessions.ts
import { randomUUIDv7 } from "bun";
import { db } from "./db";

export type Session = {
  id: string;
  user_id: number;
  created_at: number;
  expires_at: number;
};

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

const insertSession = db.prepare(
  "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
);

const findSession = db.query(
  "SELECT * FROM sessions WHERE id = ? AND expires_at > unixepoch()",
);

const deleteSession = db.prepare("DELETE FROM sessions WHERE id = ?");

export function createSession(userId: number): Session {
  const id = randomUUIDv7();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_DURATION_SECONDS;
  insertSession.run(id, userId, expiresAt);
  return { id, user_id: userId, created_at: now, expires_at: expiresAt };
}

export function findSessionById(id: string): Session | null {
  return findSession.get(id) as Session | null;
}

export function endSession(id: string): void {
  deleteSession.run(id);
}
