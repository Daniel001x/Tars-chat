"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const isInConversation = pathname !== "/chat";

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
  const upsertUser = useMutation(api.users.upsertUser);
  const heartbeat = useMutation(api.users.heartbeat);
  const setOnlineStatus = useMutation(api.users.setOnlineStatus);

  // Create / update user
  useEffect(() => {
    if (!user) return;
    upsertUser({
      clerkId: user.id,
      name: user.fullName ?? user.username ?? "Anonymous",
      email: user.emailAddresses[0]?.emailAddress ?? "",
      imageUrl: user.imageUrl,
    });
  }, [user, upsertUser]);

  // Heartbeat system
  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = () => heartbeat({ clerkId: user.id });

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    const handleUnload = () =>
      setOnlineStatus({ clerkId: user.id, isOnline: false });

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user, heartbeat, setOnlineStatus]);

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
    <div className="h-screen w-full bg-gray-100 flex overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`
          fixed md:relative inset-0 z-20
          bg-white flex flex-col
          w-full md:w-80
          transition-transform duration-300
          ${isInConversation ? "-translate-x-full md:translate-x-0" : "translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="bg-blue-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-xl">💬</span>
            <h1 className="text-lg font-bold text-white">Tars Chat</h1>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>

        {/* Current User */}
        {user && (
          <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-3">
            <Image
              src={user.imageUrl}
              alt={user.fullName ?? "You"}
              width={36}
              height={36}
              className="rounded-full"
            />
            <div>
              <p className="text-sm font-semibold">{user.fullName}</p>
              <p className="text-xs text-green-500">● Online</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b bg-gray-50">
          <input
            type="text"
            placeholder="🔍 Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Search Results */}
        {search && (
          <div className="border-b max-h-64 overflow-y-auto bg-white">
            {filteredUsers?.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              filteredUsers?.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleUserClick(u._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left"
                >
                  <Image
                    src={u.imageUrl}
                    alt={u.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold">{u.name}</p>
                    <p className="text-xs text-gray-400">
                      {u.isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {!search &&
            conversations?.map((convo) => {
              const other = convo.otherUsers?.[0];

              return (
                <Link
                  key={convo._id}
                  href={`/chat/${convo._id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 border-b"
                >
                  <Image
                    src={other?.imageUrl ?? ""}
                    alt={other?.name ?? "User"}
                    width={45}
                    height={45}
                    className="rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {other?.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {convo.lastMessage?.content ??
                        "Start a conversation"}
                    </p>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div
        className={`
          flex-1 flex flex-col bg-white
          transition-transform duration-300
          ${isInConversation ? "translate-x-0" : "translate-x-full md:translate-x-0"}
        `}
      >
        {children}
      </div>
    </div>
  );
}