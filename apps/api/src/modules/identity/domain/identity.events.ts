// modules/identity/domain/identity.events.ts · integration events (published via outbox).
export const IdentityEventType = {
  UserRegistered: 'identity.user_registered',
  UserStatusChanged: 'identity.user_status_changed',
  RoleAssigned: 'identity.role_assigned',
  RoleRevoked: 'identity.role_revoked',
  RoleApproved: 'identity.role_approved',
  KycSubmitted: 'identity.kyc_submitted',
  KycVerified: 'identity.kyc_verified',
  KycRejected: 'identity.kyc_rejected',
  ConsentChanged: 'identity.consent_changed',
  LoggedIn: 'identity.logged_in',
} as const;
export type IdentityEventType = typeof IdentityEventType[keyof typeof IdentityEventType];
