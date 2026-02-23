"use client";
import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
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

  const getOrCreate = useMutation(api.conversations.getOrCreateConversation);

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
    <div className="flex h-screen w-full bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-80 bg-white flex flex-col shadow-lg flex-shrink-0">
        <div className="bg-blue-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-xl">💬</span>
            <h1 className="text-lg font-bold text-white">Tars Chat</h1>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>

        {user && (
          <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-3">
            <Image
              src={user.imageUrl}
              alt={user.fullName ?? "You"}
              width={36}
              height={36}
              className="rounded-full border-2 border-blue-300"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">{user.fullName}</p>
              <p className="text-xs text-green-500 font-medium">● Online</p>
            </div>
          </div>
        )}

        <div className="p-3 border-b bg-gray-50">
          <input
            type="text"
            placeholder="🔍 Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {search && (
          <div className="border-b max-h-64 overflow-y-auto bg-white">
            {filteredUsers?.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p className="text-2xl mb-1">🔍</p>
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              filteredUsers?.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleUserClick(u._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="relative shrink-0">
                    <Image
                      src={u.imageUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                      alt={u.name}
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-gray-100"
                    />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${u.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!search && (
            <>
              {conversations === undefined ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="font-semibold text-gray-500">No conversations yet</p>
                  <p className="text-sm mt-1">Search for a user to start chatting</p>
                </div>
              ) : (
                conversations.map((convo) => {
                  const other = convo.otherUsers?.[0];
                  return (
                    <Link
                      key={convo._id}
                      href={`/chat/${convo._id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 border-b transition-colors"
                    >
                      <div className="relative shrink-0">
                        <Image
                          src={other?.imageUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${other?.name}`}
                          alt={other?.name ?? "User"}
                          width={48}
                          height={48}
                          className="rounded-full border-2 border-gray-100"
                        />
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${other?.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{other?.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {convo.lastMessage?.isDeleted ? "🚫 Message deleted" : convo.lastMessage?.content ?? "Start a conversation"}
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

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}