import { getTurso } from "../server/turso";

const db = await getTurso();
if (!db) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before initializing Turso");
console.log("Turso schema initialized successfully.");
