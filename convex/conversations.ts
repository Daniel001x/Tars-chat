import { query, mutation } from "./_generated/server";
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
        
        const usersToFetch = convo.isGroup ? convo.participantIds : otherParticipantIds;

        const [usersRaw, lastMessage, receipt] = await Promise.all([
          Promise.all(usersToFetch.map((id) => ctx.db.get(id))),
          convo.lastMessageId ? ctx.db.get(convo.lastMessageId) : null,
          ctx.db
            .query("readReceipts")
            .withIndex("by_conversation_user", (q) =>
              q.eq("conversationId", convo._id).eq("userId", args.userId)
            )
            .unique(),
        ]);

        let unreadCount = 0;
        const lastReadTime = receipt?.lastReadTime ?? 0;

        if (convo.lastMessageTime && convo.lastMessageTime > lastReadTime) {
          const unreadMessages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", convo._id)
            )
            .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
            .collect();
          unreadCount = unreadMessages.filter((m) => m.senderId !== args.userId).length;
        }

        const otherUsers = usersRaw
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

export const getConversationInfo = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    const isGroup = conversation.isGroup;
    const groupName = conversation.groupName ?? "Group";

    const participants = await Promise.all(
      conversation.participantIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name,
          imageUrl: user.imageUrl,
          isOnline: user.isOnline,
        };
      })
    );

    const validParticipants = participants.filter((p) => p !== null);

    return {
      isGroup,
      groupName,
      participants: validParticipants,
    };
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