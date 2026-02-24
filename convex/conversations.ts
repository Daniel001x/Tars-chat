import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateConversation = mutation({
  args: {
    currentUserId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    const existing = allConversations.find(
      (c) =>
        c.isGroup === false &&
        c.participantIds.length === 2 &&
        c.participantIds.includes(args.currentUserId) &&
        c.participantIds.includes(args.otherUserId)
    );

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      participantIds: [args.currentUserId, args.otherUserId],
      isGroup: false,
      lastMessageTime: Date.now(),
    });
  },
});

export const getUserConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    const userConvos = allConversations.filter((c) =>
      c.participantIds.includes(args.userId)
    );

    const ONE_MINUTE = 60 * 1000;

    const enriched = await Promise.all(
      userConvos.map(async (convo) => {
        const otherParticipantIds = convo.participantIds.filter(
          (id) => id !== args.userId
        );
        const otherUsers = await Promise.all(
          otherParticipantIds.map((id) => ctx.db.get(id))
        );
        
        const lastMessage = convo.lastMessageId
          ? await ctx.db.get(convo.lastMessageId)
          : null;

        // FIX: Calculate if the other user is online based on lastSeen
        const otherUsersWithStatus = otherUsers.map(u => {
          if (!u) return null;
          return {
            ...u,
            isOnline: Date.now() - u.lastSeen < ONE_MINUTE
          };
        }).filter(u => u !== null);

        return { ...convo, otherUsers: otherUsersWithStatus, lastMessage };
      })
    );

    return enriched.sort(
      (a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0)
    );
  },
});

export const createGroupConversation = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", {
      participantIds: args.memberIds,
      isGroup: true,
      groupName: args.name,
      lastMessageTime: Date.now(),
    });
  },
});