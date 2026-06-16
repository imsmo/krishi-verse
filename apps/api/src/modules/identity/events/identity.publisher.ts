// modules/identity/events/identity.publisher.ts · outbox routing for identity events.
// The outbox is the ONLY publish path (Law 4); this is the relay's routing contract.
import { IdentityEventType } from '../domain/identity.events';
export const IDENTITY_EVENT_TOPICS: Record<string, string> = {
  [IdentityEventType.UserRegistered]: 'identity.users',
  [IdentityEventType.UserStatusChanged]: 'identity.users',
  [IdentityEventType.RoleAssigned]: 'identity.rbac',
  [IdentityEventType.RoleApproved]: 'identity.rbac',
  [IdentityEventType.RoleRevoked]: 'identity.rbac',
  [IdentityEventType.KycSubmitted]: 'identity.kyc',
  [IdentityEventType.KycVerified]: 'identity.kyc',
  [IdentityEventType.KycRejected]: 'identity.kyc',
  [IdentityEventType.ConsentChanged]: 'identity.consent',
  [IdentityEventType.LoggedIn]: 'identity.auth',
};
