import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      ...args,
      isDeleted: false,
    });

    // Update conversation last message
    await ctx.db.patch(args.conversationId, {
      lastMessageId: messageId,
      lastMessageTime: Date.now(),
    });

    return messageId;
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, sender };
      })
    );
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { isDeleted: true, content: "" });
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    const reactions = message.reactions ?? [];
    const existing = reactions.find((r) => r.emoji === args.emoji);

    let updated;
    if (existing) {
      const hasReacted = existing.userIds.includes(args.userId);
      updated = reactions
        .map((r) =>
          r.emoji === args.emoji
            ? {
                ...r,
                userIds: hasReacted
                  ? r.userIds.filter((id) => id !== args.userId)
                  : [...r.userIds, args.userId],
              }
            : r
        )
        .filter((r) => r.userIds.length > 0);
    } else {
      updated = [...reactions, { emoji: args.emoji, userIds: [args.userId] }];
    }

    await ctx.db.patch(args.messageId, { reactions: updated });
  },
});