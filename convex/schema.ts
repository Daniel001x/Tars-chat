import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  conversations: defineTable({
    participantIds: v.array(v.id("users")),
    isGroup: v.boolean(),
    groupName: v.optional(v.string()),
    lastMessageId: v.optional(v.id("messages")),
    lastMessageTime: v.optional(v.number()),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    isDeleted: v.boolean(),
    reactions: v.optional(
      v.array(v.object({ emoji: v.string(), userIds: v.array(v.id("users")) }))
    ),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_creationTime", ["conversationId", "_creationTime"]),

  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    updatedAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  readReceipts: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadTime: v.number(),
  }).index("by_conversation_user", ["conversationId", "userId"]),
});