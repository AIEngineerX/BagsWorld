# Memory Layer Patterns

## Short-Term Memory (Sliding Window)

```javascript
class ShortTermMemory {
  constructor(maxEntries = 20) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }

  add(type, content) {
    this.entries.push({
      type,
      content,
      timestamp: Date.now(),
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  addAction(action, params) {
    this.add("action", `${action}(${JSON.stringify(params)})`);
  }

  addObservation(observation) {
    this.add("observation", observation);
  }

  addThought(thought) {
    this.add("thought", thought);
  }

  getContext() {
    return this.entries.map((e) => `[${e.type.toUpperCase()}] ${e.content}`).join("\n");
  }

  getRecent(n = 5) {
    return this.entries.slice(-n);
  }

  clear() {
    this.entries = [];
  }
}
```

## Long-Term Memory (SQLite)

```javascript
import Database from "better-sqlite3";

class LongTermMemory {
  constructor(dbPath = "./agent-memory.db") {
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        objective TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        success BOOLEAN,
        summary TEXT
      );
      
      CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY,
        session_id INTEGER,
        action TEXT,
        params TEXT,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      
      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY,
        pattern_type TEXT,
        trigger TEXT,
        response TEXT,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0
      );
    `);
  }

  startSession(objective) {
    const result = this.db.prepare("INSERT INTO sessions (objective) VALUES (?)").run(objective);
    return result.lastInsertRowid;
  }

  logAction(sessionId, action, params, result) {
    this.db
      .prepare("INSERT INTO actions (session_id, action, params, result) VALUES (?, ?, ?, ?)")
      .run(sessionId, action, JSON.stringify(params), result);
  }

  endSession(sessionId, success, summary) {
    this.db
      .prepare(
        "UPDATE sessions SET completed_at = CURRENT_TIMESTAMP, success = ?, summary = ? WHERE id = ?"
      )
      .run(success ? 1 : 0, summary, sessionId);
  }

  getSimilarSessions(objective, limit = 5) {
    return this.db
      .prepare(
        `
      SELECT * FROM sessions 
      WHERE objective LIKE ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `
      )
      .all(`%${objective}%`, limit);
  }

  recordPattern(type, trigger, response, success) {
    const existing = this.db
      .prepare("SELECT * FROM patterns WHERE pattern_type = ? AND trigger = ?")
      .get(type, trigger);

    if (existing) {
      const col = success ? "success_count" : "fail_count";
      this.db.prepare(`UPDATE patterns SET ${col} = ${col} + 1 WHERE id = ?`).run(existing.id);
    } else {
      this.db
        .prepare(
          "INSERT INTO patterns (pattern_type, trigger, response, success_count, fail_count) VALUES (?, ?, ?, ?, ?)"
        )
        .run(type, trigger, response, success ? 1 : 0, success ? 0 : 1);
    }
  }

  getBestPattern(type, trigger) {
    return this.db
      .prepare(
        `
      SELECT *, (success_count * 1.0 / (success_count + fail_count + 1)) as success_rate
      FROM patterns 
      WHERE pattern_type = ? AND trigger LIKE ?
      ORDER BY success_rate DESC
      LIMIT 1
    `
      )
      .get(type, `%${trigger}%`);
  }
}
```

## Vector Memory (for semantic search)

```javascript
// Requires: npm install openai

class VectorMemory {
  constructor(openaiApiKey) {
    this.memories = [];
    this.apiKey = openaiApiKey;
  }

  async embed(text) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });
    const data = await res.json();
    return data.data[0].embedding;
  }

  async add(content, metadata = {}) {
    const embedding = await this.embed(content);
    this.memories.push({ content, embedding, metadata, timestamp: Date.now() });
  }

  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  async search(query, topK = 5) {
    const queryEmbedding = await this.embed(query);

    const scored = this.memories.map((m) => ({
      ...m,
      score: this.cosineSimilarity(queryEmbedding, m.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ content, metadata, score }) => ({ content, metadata, score }));
  }
}
```

## Unified Memory Manager

```javascript
class MemoryManager {
  constructor(config = {}) {
    this.shortTerm = new ShortTermMemory(config.shortTermMax || 20);
    this.longTerm = config.dbPath ? new LongTermMemory(config.dbPath) : null;
    this.vector = config.openaiKey ? new VectorMemory(config.openaiKey) : null;
    this.sessionId = null;
  }

  startSession(objective) {
    this.shortTerm.clear();
    if (this.longTerm) {
      this.sessionId = this.longTerm.startSession(objective);
    }
  }

  async addEntry(type, content, metadata = {}) {
    // Always add to short-term
    this.shortTerm.add(type, content);

    // Log to long-term if available
    if (this.longTerm && this.sessionId && type === "action") {
      this.longTerm.logAction(this.sessionId, metadata.action, metadata.params, content);
    }

    // Add to vector memory if available
    if (this.vector && type === "observation") {
      await this.vector.add(content, metadata);
    }
  }

  async getRelevantContext(query) {
    let context = this.shortTerm.getContext();

    if (this.vector) {
      const similar = await this.vector.search(query, 3);
      if (similar.length) {
        context += "\n\nRELEVANT PAST EXPERIENCES:\n";
        context += similar.map((s) => `- ${s.content}`).join("\n");
      }
    }

    return context;
  }

  endSession(success, summary) {
    if (this.longTerm && this.sessionId) {
      this.longTerm.endSession(this.sessionId, success, summary);
    }
  }
}
```
