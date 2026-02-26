import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

//. The Query to get messages
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Fetch sender details for each message
    const messagesWithSender = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          ...msg,
          senderName: sender?.name ?? "Unknown",
          senderImage: sender?.imageUrl,
        };
      })
    );

    return messagesWithSender;
  },
});

//  The Mutation to send messages
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: args.content,
      isDeleted: false,
    });

    // Update the last message in the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation) {
      await ctx.db.patch(conversation._id, {
        lastMessageId: messageId,
        lastMessageTime: Date.now(),
      });
    }

    return messageId;
  },
});

// ... existing imports and functions ...

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    
    if (!message) {
      throw new Error("Message not found");
    }

    // Soft delete: just mark as deleted
    await ctx.db.patch(args.messageId, { isDeleted: true });
  },
});

// The Mutation to toggle reactions
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const reactions = message.reactions || [];
    const existingReactionIndex = reactions.findIndex(
      (r) => r.emoji === args.emoji
    );

    let newReactions;

    if (existingReactionIndex >= 0) {
      const reaction = reactions[existingReactionIndex];
      const userIndex = reaction.userIds.indexOf(args.userId);

      if (userIndex >= 0) {
        // Remove user
        const newUserIds = reaction.userIds.filter((id) => id !== args.userId);
        if (newUserIds.length === 0) {
          newReactions = reactions.filter((r) => r.emoji !== args.emoji);
        } else {
          newReactions = [...reactions];
          newReactions[existingReactionIndex] = {
            ...reaction,
            userIds: newUserIds,
          };
        }
      } else {
        // Add user
        const newUserIds = [...reaction.userIds, args.userId];
        newReactions = [...reactions];
        newReactions[existingReactionIndex] = { ...reaction, userIds: newUserIds };
      }
    } else {
      // New emoji
      newReactions = [
        ...reactions,
        { emoji: args.emoji, userIds: [args.userId] },
      ];
    }

    await ctx.db.patch(args.messageId, { reactions: newReactions });
  },
});