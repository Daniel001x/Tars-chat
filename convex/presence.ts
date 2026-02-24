import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Called every 30 seconds from the client as a heartbeat
export const heartbeat = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (user) {
      await ctx.db.patch(user._id, {
        isOnline: true,
        lastSeen: Date.now(),
      });
    }
  },
});