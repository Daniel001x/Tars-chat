"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isThisYear)
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      ", " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  return (
    date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    ", " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const convId = conversationId as Id<"conversations">;
  const { user } = useUser();
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  const conversationInfo = useQuery(
    api.conversations.getConversationInfo,
    { conversationId: convId }
  );

  const messages = useQuery(
    api.messages.getMessages,
    { conversationId: convId }
  );

  // Query for typing users
  const typingUsers = useQuery(
    api.typing.getTypingUsers,
    currentUser ? { conversationId: convId, currentUserId: currentUser._id } : "skip"
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const setTyping = useMutation(api.typing.setTyping);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const markAsRead = useMutation(api.readReceipts.markAsRead);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  const markConversationAsRead = useCallback(() => {
    if (currentUser) {
      markAsRead({
        conversationId: convId,
        userId: currentUser._id,
      });
    }
  }, [currentUser, convId, markAsRead]);

  useEffect(() => {
    markConversationAsRead();
  }, [markConversationAsRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // TYPING INDICATOR LOGIC
  const handleTyping = (value: string) => {
    setContent(value);
    if (!currentUser) return;

    // 1. Tell backend we are typing
    setTyping({
      conversationId: convId,
      userId: currentUser._id,
      isTyping: true,
    });

    // 2. Clear existing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // 3. Set new timeout to stop typing after 2s of inactivity
    typingTimeout.current = setTimeout(() => {
      setTyping({
        conversationId: convId,
        userId: currentUser._id,
        isTyping: false,
      });
    }, 2000);
  };

  const handleSend = async () => {
    if (!content.trim() || !currentUser) return;
    
    // 1. Clear timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // 2. Tell backend we STOPPED typing
    setTyping({
      conversationId: convId,
      userId: currentUser._id,
      isTyping: false,
    });

    // 3. Send message
    const textToSend = content.trim();
    setContent("");
    await sendMessage({
      conversationId: convId,
      senderId: currentUser._id,
      content: textToSend,
    });
  };

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];
  const isGroup = conversationInfo?.isGroup ?? false;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          href="/chat"
          className="text-blue-500 text-sm font-medium hover:underline"
        >
          ← Back
        </Link>
        <div className="w-px h-4 bg-gray-300" />
        <p className="font-semibold text-gray-800">
          {isGroup ? (conversationInfo?.groupName ?? "Group") : "Conversation"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages?.map((msg) => {
          const isMe = msg.senderId === currentUser?._id;
          
          return (
            <div
              key={msg._id}
              className={`flex ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              <div className="max-w-xs lg:max-w-md">
                <div
                  className={`px-4 py-2 rounded-2xl text-sm ${
                    isMe
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-white text-gray-800 rounded-bl-none shadow-sm"
                  }`}
                >
                  {isGroup && !isMe && (
                    <div className="text-xs text-gray-500 mb-1">
                      {msg.senderName || "Unknown"}
                    </div>
                  )}
                  
                  {msg.isDeleted ? (
                    <span className="italic text-gray-400">This message was deleted</span>
                  ) : (
                    msg.content
                  )}
                </div>
                
                <p
                  className={`text-xs text-gray-400 mt-1 ${
                    isMe ? "text-right" : "text-left"
                  }`}
                >
                  {formatTime(msg._creationTime)}
                </p>
                
                {!msg.isDeleted && (
                  <div
                    className={`flex gap-1 mt-1 flex-wrap items-center ${
                      isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.reactions?.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() =>
                          currentUser &&
                          toggleReaction({
                            messageId: msg._id,
                            userId: currentUser._id,
                            emoji: r.emoji,
                          })
                        }
                        className="bg-gray-100 rounded-full px-2 py-0.5 text-xs hover:bg-gray-200"
                      >
                        {r.emoji} {r.userIds.length}
                      </button>
                    ))}
                    
                    <div className="relative group inline-block">
                      <button className="text-gray-400 hover:text-gray-600 text-xs px-1">
                        +
                      </button>
                      <div
                        className={`
                        absolute
                        bottom-full
                        mb-2
                        left-1/2
                        -translate-x-1/2
                        bg-white
                        shadow-lg
                        rounded-full
                        px-4
                        py-2
                        flex
                        gap-3
                        whitespace-nowrap
                        w-max
                        opacity-0
                        scale-90
                        pointer-events-none
                        transition-all
                        duration-200
                        group-hover:opacity-100
                        group-hover:scale-100
                        group-hover:pointer-events-auto
                        z-50
                      `}
                      >
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() =>
                              currentUser &&
                              toggleReaction({
                                messageId: msg._id,
                                userId: currentUser._id,
                                emoji,
                              })
                            }
                            className="text-lg hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isMe && (
                      <button
                        onClick={() => deleteMessage({ messageId: msg._id })}
                        className="text-gray-300 hover:text-red-500 text-xs ml-2"
                        title="Delete message"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      
      {/* TYPING INDICATOR UI */}
      {typingUsers && typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </div>
          <span className="italic">
            {typingUsers[0]?.name ?? "Someone"} is typing...
          </span>
        </div>
      )}
      
      {/* Input */}
      <div className="bg-white border-t p-4 flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={content}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && handleSend()
          }
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="bg-blue-500 text-white px-5 py-2 rounded-full text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}