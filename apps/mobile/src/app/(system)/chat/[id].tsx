// apps/mobile/src/app/(system)/chat/[id].tsx · cross-role chat thread route. Renders the SAME
// features/messaging/screens/ChatThreadScreen as (buyer)/chat/[id].tsx, but lives in the (system) stack — which
// is NOT gated by any per-role tab flag (unlike (buyer), gated by `buyer_app`, default OFF). This is the target
// for every non-buyer caller that needs to open a conversation by id: the unified messages inbox (191, all
// context types including support/workers), a farmer's own listing-inquiry rows (screen 112), and a support
// ticket's thread (screen 520, KV-BL-034/052) — none of which should ever depend on the buyer vertical being
// live. `peerName`/`title`/`context` are optional query params the caller passes when it already knows them
// (e.g. the inbox's enriched counterpartyName) so the header shows a real name instead of a generic label;
// `context=listing` additionally pins the listing card + peer rating (buyer↔seller-style chats), anything else
// (e.g. `support_ticket`) skips that fetch entirely.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatThreadScreen } from '../../../features/messaging/screens/ChatThreadScreen';

export default function SharedChatThread() {
  const { id, peerId, peerName, title, context } = useLocalSearchParams<{ id: string; peerId?: string; peerName?: string; title?: string; context?: string }>();
  return (
    <ChatThreadScreen
      conversationId={id}
      peerUserId={peerId}
      peerDisplayName={peerName}
      screenTitle={title}
      showListingContext={context === 'listing'}
      peerFallbackKey={context === 'support_ticket' ? 'chat.context.support_ticket' : undefined}
    />
  );
}
