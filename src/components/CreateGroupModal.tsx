"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Image from "next/image";

const fallbackAvatar = "https://ui-avatars.com/api/?name=User&background=random";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: Id<"users">;
}

// FIX: Added 'default' here to match your import statement
export default function CreateGroupModal({ isOpen, onClose, currentUserId }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Id<"users">[]>([]);
  
  const allUsers = useQuery(api.users.getAllUsersIncludingSelf);
  const createGroup = useMutation(api.conversations.createGroupConversation);

  const toggleMember = (userId: Id<"users">) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;

    const memberIds = [currentUserId, ...selectedMembers];

    await createGroup({ name: groupName, memberIds });
    setGroupName("");
    setSelectedMembers([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4">Create Group Chat</h2>

        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Select Members:</p>
          <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
            {allUsers?.filter((u) => u._id !== currentUserId).map((u) => (
              <div
                key={u._id}
                onClick={() => toggleMember(u._id)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedMembers.includes(u._id) ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <Image
                  src={u.imageUrl ?? fallbackAvatar}
                  alt={u.name}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="font-medium">{u.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedMembers.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}