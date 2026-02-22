"use client";
import { useRouter } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ChatPage() {
  const { user } = useUser();
    const router = useRouter();  // added the useRouter

  const [search, setSearch] = useState("");

  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  const allUsers = useQuery(
    api.users.getAllUsers,
    user ? { currentClerkId: user.id } : "skip"
  );

  const conversations = useQuery(
    api.conversations.getUserConversations,
    currentUser ? { userId: currentUser._id } : "skip"
  );

  const getOrCreate = useMutation(
    api.conversations.getOrCreateConversation
  );

  const filteredUsers = allUsers?.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

 const handleUserClick = async (otherUserId: Id<"users">) => {
  if (!currentUser) return;
  const convId = await getOrCreate({
    currentUserId: currentUser._id,
    otherUserId,
  });
  setSearch("");
  router.push(`/chat/${convId}`);
};

  return (
    <div className="flex h-screen w-full">
      {/* LEFT SIDEBAR */}
      <div className="w-80 border-r bg-white flex flex-col">
        
        {/* HEADER */}
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">
            Tars Chat
          </h1>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>

        {/* SEARCH INPUT */}
        <div className="p-3 border-b">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* SEARCH RESULTS */}
        {search && (
          <div className="border-b max-h-60 overflow-y-auto">
            {filteredUsers?.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">
                No users found
              </p>
            ) : (
              filteredUsers?.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleUserClick(u._id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                >
                  <div className="relative">
                    <Image
                      src={
                        u.imageUrl ??
                        `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`
                      }
                      alt={u.name}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                    {u.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-400">
                      {u.isOnline ? "🟢 Online" : "⚫ Offline"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* CONVERSATIONS */}
        <div className="flex-1 overflow-y-auto">
          {!search && (
            <>
              {conversations === undefined ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="font-medium">
                    No conversations yet
                  </p>
                  <p className="text-sm mt-1">
                    Search for a user above to start chatting
                  </p>
                </div>
              ) : (
                conversations.map((convo) => {
                  const other = convo.otherUsers?.[0];

                  return (
                    <Link
                      key={convo._id}
                      href={`/chat/${convo._id}`}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b transition-colors"
                    >
                      <div className="relative">
                        <Image
                          src={
                            other?.imageUrl ??
                            `https://api.dicebear.com/7.x/initials/svg?seed=${other?.name}`
                          }
                          alt={other?.name ?? "User"}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                        {other?.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {other?.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {convo.lastMessage?.isDeleted
                            ? "This message was deleted"
                            : convo.lastMessage?.content ??
                              "No messages yet"}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE EMPTY STATE */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <p className="text-5xl mb-3">👈</p>
          <p className="text-lg font-medium">
            Select a conversation
          </p>
          <p className="text-sm mt-1">
            or search for a user to start chatting
          </p>
        </div>
      </div>
    </div>
  );
}