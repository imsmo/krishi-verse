// apps/mobile/src/app/(buyer)/chat/[id].tsx · screen 98 "Chat with Seller". Thin route wrapper (guide §3) over the
// shared features/messaging/screens/ChatThreadScreen — buyer↔seller listing-chat defaults unchanged (pinned
// listing card + seller rating). See ChatThreadScreen's own header for the full behaviour + §13 gaps.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatThreadScreen } from '../../../features/messaging/screens/ChatThreadScreen';

export default function ChatThread() {
  const { id, peerId } = useLocalSearchParams<{ id: string; peerId?: string }>();
  return <ChatThreadScreen conversationId={id} peerUserId={peerId} />;
}
