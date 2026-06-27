// @effect-diagnostics nodeBuiltinImport:off
import { describe, expect, it } from "@effect/vitest";

import type { PiTrackedToolCall } from "./piToolLifecycle.ts";
import { toolItemType, toolLifecycleData, toolResultDetail, toolTitle } from "./piToolLifecycle.ts";

describe("piToolLifecycle", () => {
  describe("toolItemType", () => {
    it("maps bash to command_execution", () => {
      expect(toolItemType("bash")).toBe("command_execution");
    });
    it("maps edit and write to file_change", () => {
      expect(toolItemType("edit")).toBe("file_change");
      expect(toolItemType("write")).toBe("file_change");
    });
    it("maps grep and find to web_search", () => {
      expect(toolItemType("grep")).toBe("web_search");
      expect(toolItemType("find")).toBe("web_search");
    });
    it("maps unknown tools to dynamic_tool_call", () => {
      expect(toolItemType("todo")).toBe("dynamic_tool_call");
    });
  });

  describe("toolTitle", () => {
    it("uses the bash command as the title", () => {
      expect(toolTitle("bash", { command: "npm test" })).toBe("npm test");
    });
    it("prefixes read/edit/write/ls with the path", () => {
      expect(toolTitle("read", { path: "src/index.ts" })).toBe("read src/index.ts");
      expect(toolTitle("edit", { filePath: "src/index.ts" })).toBe("edit src/index.ts");
      expect(toolTitle("write", { file: "out.txt" })).toBe("write out.txt");
      expect(toolTitle("ls", { path: "src" })).toBe("ls src");
    });
    it("prefixes find/grep with the query", () => {
      expect(toolTitle("grep", { pattern: "TODO" })).toBe("grep TODO");
      expect(toolTitle("find", { query: "*.ts" })).toBe("find *.ts");
    });
    it("falls back to the tool name when no argument yields a summary", () => {
      expect(toolTitle("bash", {})).toBe("bash");
      expect(toolTitle("custom", { foo: "bar" })).toBe("custom");
    });
  });

  describe("toolLifecycleData", () => {
    it("records command + exitCode for bash", () => {
      const data = toolLifecycleData({
        toolCallId: "call-1",
        toolName: "bash",
        args: { command: "npm test" },
        result: { stdout: "ok", exitCode: 0 },
        isError: false,
      });
      expect(data.toolCallId).toBe("call-1");
      expect(data.callId).toBe("call-1");
      expect(data.toolName).toBe("bash");
      expect(data.kind).toBe("execute");
      expect(data.command).toBe("npm test");
      expect(data.exitCode).toBe(0);
      expect(data.isError).toBe(false);
    });

    it("records path + files for read", () => {
      const data = toolLifecycleData({
        toolCallId: "call-2",
        toolName: "read",
        args: { path: "src/index.ts" },
      });
      expect(data.kind).toBe("read");
      expect(data.path).toBe("src/index.ts");
      expect(data.filePath).toBe("src/index.ts");
      expect(data.files).toEqual([{ path: "src/index.ts" }]);
    });

    it("records edits + changes for edit", () => {
      const data = toolLifecycleData({
        toolCallId: "call-3",
        toolName: "edit",
        args: { path: "src/index.ts", edits: [{ oldText: "a", newText: "b" }] },
      });
      expect(data.kind).toBe("edit");
      expect(data.changes).toEqual([{ path: "src/index.ts" }]);
      expect(data.edits).toEqual([{ oldText: "a", newText: "b", path: "src/index.ts" }]);
    });

    it("records query for grep", () => {
      const data = toolLifecycleData({
        toolCallId: "call-4",
        toolName: "grep",
        args: { pattern: "TODO", path: "src" },
      });
      expect(data.kind).toBe("search");
      expect(data.searchKind).toBe("grep");
      expect(data.query).toBe("TODO");
      expect(data.path).toBe("src");
    });

    it("records content for write", () => {
      const data = toolLifecycleData({
        toolCallId: "call-5",
        toolName: "write",
        args: { path: "out.txt", content: "hello" },
      });
      expect(data.kind).toBe("write");
      expect(data.content).toBe("hello");
    });

    it("includes partialResult when provided", () => {
      const data = toolLifecycleData({
        toolCallId: "call-6",
        toolName: "bash",
        args: { command: "npm test" },
        partialResult: { stdout: "partial" },
      });
      expect(data.partialResult).toEqual({ stdout: "partial" });
    });

    it("defaults to a dynamic_tool_call-shaped base for unknown tools", () => {
      const data = toolLifecycleData({
        toolCallId: "call-7",
        toolName: "custom",
        args: { foo: "bar" },
      });
      expect(data.kind).toBe("custom");
      expect(data.args).toEqual({ foo: "bar" });
    });

    it("is usable as a PiTrackedToolCall payload", () => {
      const tracked: PiTrackedToolCall = {
        toolCallId: "call-8",
        toolName: "bash",
        args: { command: "echo hi" },
        itemType: toolItemType("bash"),
      };
      expect(tracked.itemType).toBe("command_execution");
    });
  });

  describe("toolResultDetail", () => {
    it("extracts text from a string result", () => {
      expect(toolResultDetail("done")).toBe("done");
    });
    it("extracts text from a record stdout field", () => {
      expect(toolResultDetail({ stdout: "output" })).toBe("output");
    });
    it("extracts text from content text blocks", () => {
      expect(toolResultDetail({ content: [{ type: "text", text: "a" }] })).toBe("a");
    });
    it("returns undefined when no text is present", () => {
      expect(toolResultDetail({ foo: 1 })).toBeUndefined();
    });
  });
});
