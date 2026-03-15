// src/utils/permissions.js

// ✅ Permission Constants
export const Permissions = {
  // Messaging
  SEND_MESSAGES: 'send_messages',
  DELETE_ANY_MESSAGE: 'delete_any_message',
  DELETE_OWN_MESSAGE: 'delete_own_message',
  PIN_MESSAGES: 'pin_messages',

  // Member Management
  ADD_MEMBERS: 'add_members',
  REMOVE_MEMBERS: 'remove_members',
  VIEW_MEMBER_LIST: 'view_member_list',

  // Group Administration
  CHANGE_GROUP_INFO: 'change_group_info',
  MANAGE_INVITE_LINKS: 'manage_invite_links',
  CHANGE_MESSAGING_POLICY: 'change_messaging_policy',

  // Role Management
  PROMOTE_TO_MODERATOR: 'promote_to_moderator',
  DEMOTE_MODERATOR: 'demote_moderator',
  PROMOTE_TO_ADMIN: 'promote_to_admin',
  DEMOTE_ADMIN: 'demote_admin',
};

// ✅ Role Permission Sets
const memberPermissions = [
  Permissions.SEND_MESSAGES,
  Permissions.DELETE_OWN_MESSAGE,
  Permissions.VIEW_MEMBER_LIST,
];

const moderatorPermissions = [
  ...memberPermissions,
  Permissions.DELETE_ANY_MESSAGE,
  Permissions.PIN_MESSAGES,
  Permissions.ADD_MEMBERS,
  Permissions.REMOVE_MEMBERS,
];

const adminPermissions = [
  ...moderatorPermissions,
  Permissions.CHANGE_GROUP_INFO,
  Permissions.MANAGE_INVITE_LINKS,
  Permissions.CHANGE_MESSAGING_POLICY,
  Permissions.PROMOTE_TO_MODERATOR,
  Permissions.DEMOTE_MODERATOR,
  Permissions.PROMOTE_TO_ADMIN,
];

const creatorPermissions = [
  ...adminPermissions,
  Permissions.DEMOTE_ADMIN,
];

// ✅ Permission Matrix
export const RolePermissions = {
  member: memberPermissions,
  moderator: moderatorPermissions,
  admin: adminPermissions,
  creator: creatorPermissions,
};

// ✅ Helpers

// Check if a role has a given permission
export const hasPermission = (role, permission) => {
  return RolePermissions[role]?.includes(permission) || false;
};

// Check if user can send messages depending on policy
export const canSendMessages = (userRole, roomSettings) => {
  if (roomSettings?.messagingPolicy === 'admins_only') {
    return ['admin', 'creator'].includes(userRole);
  }
  return ['member', 'moderator', 'admin', 'creator'].includes(userRole);
};

// ✅ NEW: Role hierarchy helper (for comparison logic)
export const RoleHierarchy = ['member', 'moderator', 'admin', 'creator'];

// Check if one role outranks another
export const outranks = (roleA, roleB) => {
  return RoleHierarchy.indexOf(roleA) > RoleHierarchy.indexOf(roleB);
};
