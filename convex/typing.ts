import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (args.isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      } else {
        await ctx.db.insert("typingIndicators", {
          conversationId: args.conversationId,
          userId: args.userId,
          updatedAt: Date.now(),
        });
      }
    } else {
      // User stopped typing (sent message or timed out) -> Delete the indicator
      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});

export const getTypingUsers = query({
  args: { conversationId: v.id("conversations"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const TWO_SECONDS = 2000;

    // 1. Get all indicators for this conversation
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // 2. Filter for active users (updated < 2s ago) AND exclude current user
    const activeTypingUsers = await Promise.all(
      indicators
        .filter((i) => {
          const isRecent = now - i.updatedAt < TWO_SECONDS;
          const isNotMe = i.userId !== args.currentUserId;
          return isRecent && isNotMe;
        })
        .map(async (i) => {
          const user = await ctx.db.get(i.userId);
          return user ? { name: user.name } : null;
        })
    );

    // 3. Filter out nulls (deleted users)
    return activeTypingUsers.filter((u) => u !== null);
  },
});