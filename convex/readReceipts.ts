import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mark conversation as read
export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReadAt: Date.now(),
      });
    } else {
      await ctx.db.insert("readReceipts", {
        conversationId: args.conversationId,
        userId: args.userId,
        lastReadAt: Date.now(),
      });
    }
  },
});