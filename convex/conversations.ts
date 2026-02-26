import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ONLINE_THRESHOLD = 60 * 1000;

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

    const enriched = await Promise.all(
      userConvos.map(async (convo) => {
        const otherParticipantIds = convo.participantIds.filter(
          (id) => id !== args.userId
        );

        // Run parallel queries for speed
        const [otherUsersRaw, lastMessage, receipt] = await Promise.all([
          Promise.all(otherParticipantIds.map((id) => ctx.db.get(id))),
          convo.lastMessageId ? ctx.db.get(convo.lastMessageId) : null,
          ctx.db
            .query("readReceipts")
            .withIndex("by_conversation_user", (q) =>
              q.eq("conversationId", convo._id).eq("userId", args.userId)
            )
            .unique(),
        ]);

        // Calculate Unread Count
        let unreadCount = 0;
        const lastReadTime = receipt?.lastReadTime ?? 0;

        // Optimization: Only query messages if the last message is newer than lastReadTime
        if (convo.lastMessageTime && convo.lastMessageTime > lastReadTime) {
           const unreadMessages = await ctx.db
            .query("messages")
            // Use the new index for speed
            .withIndex("by_conversation_creationTime", (q) =>
              q.eq("conversationId", convo._id).gt("_creationTime", lastReadTime)
            )
            .collect();
            
            // Filter out own messages
            unreadCount = unreadMessages.filter(m => m.senderId !== args.userId).length;
        }

        const otherUsers = otherUsersRaw
          .filter((u) => u !== null)
          .map((u) => ({
            ...u!,
            isOnline: Date.now() - (u!.lastSeen ?? 0) < ONLINE_THRESHOLD,
          }));

        return {
          ...convo,
          otherUsers,
          lastMessage,
          unreadCount,
        };
      })
    );

    return enriched.sort(
      (a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0)
    );
  },
});

// Updated helper for Clerk ID lookup
export const getConversationsByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    const userConvos = allConversations.filter((c) =>
      c.participantIds.includes(user._id)
    );

    const enriched = await Promise.all(
      userConvos.map(async (convo) => {
        const otherParticipantIds = convo.participantIds.filter(
          (id) => id !== user._id
        );

        const [otherUsersRaw, lastMessage, receipt] = await Promise.all([
          Promise.all(otherParticipantIds.map((id) => ctx.db.get(id))),
          convo.lastMessageId ? ctx.db.get(convo.lastMessageId) : null,
          ctx.db
            .query("readReceipts")
            .withIndex("by_conversation_user", (q) =>
              q.eq("conversationId", convo._id).eq("userId", user._id)
            )
            .unique(),
        ]);

        // Calculate Unread Count
        let unreadCount = 0;
        const lastReadTime = receipt?.lastReadTime ?? 0;

        if (convo.lastMessageTime && convo.lastMessageTime > lastReadTime) {
           const unreadMessages = await ctx.db
            .query("messages")
            .withIndex("by_conversation_creationTime", (q) =>
              q.eq("conversationId", convo._id).gt("_creationTime", lastReadTime)
            )
            .collect();
            unreadCount = unreadMessages.filter(m => m.senderId !== user._id).length;
        }

        const otherUsers = otherUsersRaw
          .filter((u) => u !== null)
          .map((u) => ({
            ...u!,
            isOnline: Date.now() - (u!.lastSeen ?? 0) < ONLINE_THRESHOLD,
          }));

        return {
          ...convo,
          otherUsers,
          lastMessage,
          unreadCount,
        };
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