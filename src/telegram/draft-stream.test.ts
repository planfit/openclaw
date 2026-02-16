import { describe, expect, it, vi } from "vitest";
import { createTelegramDraftStream } from "./draft-stream.js";

describe("createTelegramDraftStream", () => {
  it("passes message_thread_id when provided", () => {
    const api = { sendMessageDraft: vi.fn().mockResolvedValue(true) };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      draftId: 42,
      thread: { id: 99, scope: "forum" },
    });

    stream.update("Hello");

    expect(api.sendMessageDraft).toHaveBeenCalledWith(123, 42, "Hello", {
      message_thread_id: 99,
    });
  });

  it("omits message_thread_id for general topic id", () => {
    const api = { sendMessageDraft: vi.fn().mockResolvedValue(true) };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      draftId: 42,
      thread: { id: 1, scope: "forum" },
    });

    stream.update("Hello");

    expect(api.sendMessageDraft).toHaveBeenCalledWith(123, 42, "Hello", undefined);
  });

  it("keeps message_thread_id for dm threads", () => {
    const api = { sendMessageDraft: vi.fn().mockResolvedValue(true) };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      draftId: 42,
      thread: { id: 1, scope: "dm" },
    });

    stream.update("Hello");

    expect(api.sendMessageDraft).toHaveBeenCalledWith(123, 42, "Hello", {
      message_thread_id: 1,
    });
  });

  it("includes reply_to_message_id in initial sendMessage when replyToMessageId is set", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
      editMessageText: vi.fn().mockResolvedValue(true),
      deleteMessage: vi.fn().mockResolvedValue(true),
    };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      replyToMessageId: 999,
    });

    stream.update("Hello");
    await vi.waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith(123, "Hello", { reply_to_message_id: 999 }),
    );
  });

  it("includes both reply_to_message_id and message_thread_id when both are set", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
      editMessageText: vi.fn().mockResolvedValue(true),
      deleteMessage: vi.fn().mockResolvedValue(true),
    };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      thread: { id: 99, scope: "forum" },
      replyToMessageId: 555,
    });

    stream.update("Hello");
    await vi.waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith(123, "Hello", {
        message_thread_id: 99,
        reply_to_message_id: 555,
      }),
    );
  });

  it("passes undefined params when neither thread nor replyToMessageId is set", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
      editMessageText: vi.fn().mockResolvedValue(true),
      deleteMessage: vi.fn().mockResolvedValue(true),
    };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
    });

    stream.update("Hello");
    await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith(123, "Hello", undefined));
  });

  it("includes reply_to_message_id even when thread resolves to general topic", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 42 }),
      editMessageText: vi.fn().mockResolvedValue(true),
      deleteMessage: vi.fn().mockResolvedValue(true),
    };
    const stream = createTelegramDraftStream({
      // oxlint-disable-next-line typescript/no-explicit-any
      api: api as any,
      chatId: 123,
      thread: { id: 1, scope: "forum" },
      replyToMessageId: 888,
    });

    stream.update("Hello");
    await vi.waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith(123, "Hello", { reply_to_message_id: 888 }),
    );
  });
});
