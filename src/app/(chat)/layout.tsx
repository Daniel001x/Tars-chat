"use client";
import { useUser, RedirectToSignIn } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);
  const setOnline = useMutation(api.users.setOnlineStatus);

  useEffect(() => {
    if (!user || !isLoaded) return;

    upsertUser({
      clerkId: user.id,
      name: user.fullName ?? user.username ?? "Anonymous",
      email: user.emailAddresses[0]?.emailAddress ?? "",
      imageUrl: user.imageUrl,
    });

    setOnline({ clerkId: user.id, isOnline: true });

    const handleOffline = () => {
      setOnline({ clerkId: user.id, isOnline: false });
    };

    window.addEventListener("beforeunload", handleOffline);
    return () => {
      window.removeEventListener("beforeunload", handleOffline);
      handleOffline();
    };
  }, [user, isLoaded]);

  // Show loading spinner
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Redirect to sign in if not logged in
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return <div className="h-screen flex overflow-hidden">{children}</div>;
}