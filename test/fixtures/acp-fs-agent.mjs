#!/usr/bin/env node
import * as acp from "@agentclientprotocol/sdk/dist/acp.js";
import { Readable, Writable } from "node:stream";

class FsAgent {
  constructor(connection) {
    this.connection = connection;
    this.sessions = new Map();
  }

  async initialize() {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    };
  }

  async newSession() {
    const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    this.sessions.set(sessionId, {});
    return { sessionId };
  }

  async authenticate() {
    return {};
  }

  async setSessionMode() {
    return {};
  }

  async prompt(params) {
    const text = params.prompt
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");

    const match = text.match(/^WRITE\s+(\S+)\n([\s\S]*)$/);
    const readMatch = text.match(/^READ\s+(\S+)$/);
    if (!match && !readMatch) {
      throw new Error("Expected prompt format: WRITE <absolute-path>\\n<content> or READ <absolute-path>");
    }

    const filePath = match?.[1] || readMatch[1];
    let message = "";
    if (match) {
      const [, , content] = match;
      await this.connection.writeTextFile({
        sessionId: params.sessionId,
        path: filePath,
        content,
      });
      message = `Wrote ${filePath}`;
    } else {
      const response = await this.connection.readTextFile({
        sessionId: params.sessionId,
        path: filePath,
      });
      message = response.content;
    }

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text: message,
        },
      },
    });

    return { stopReason: "end_turn" };
  }

  async cancel() {}
}

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);
new acp.AgentSideConnection((conn) => new FsAgent(conn), stream);
