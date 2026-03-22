// src/models/Room.js
import mongoose from "../models/mongoose.js";
import {
  hasPermission as checkPermission,
  canSendMessages as checkCanSendMessages,
  outranks
} from "../utils/permissions.js";

const { Schema } = mongoose;

const RoomSchema = new Schema(
  {
    users: [{ type: Schema.ObjectId, ref: "users", index: true }],
    title: { type: String, maxlength: 100 },
      description: { type: String, maxlength: 500 },
    picture: { type: Schema.ObjectId, ref: "images" },
    isGroup: { type: Boolean, default: false, index: true },
    lastAuthor: { type: Schema.ObjectId, ref: "users" },
    lastMessage: { type: Schema.ObjectId, ref: "messages" },

    // ✅ Role-based access control
    admins: [{ type: Schema.ObjectId, ref: "users", index: true }],
    moderators: [{ type: Schema.ObjectId, ref: "users", index: true }],
    creator: { type: Schema.ObjectId, ref: "users" },


    // INVITE LINK FIELDS:

       inviteCode: {
      type: String,
      unique: true,      // This creates the index
      sparse: true       // Allows null values
    },
    inviteCreatedAt: { type: Date },
    inviteCreatedBy: { type: Schema.ObjectId, ref: "users" },


    // ✅ Room settings
    settings: {
      type: Object,
      default: () => ({
        allowInvites: true,
        allowMemberPromotion: false,
        maxParticipants: 50,
        messagingPolicy: "all_members",
      }),
    },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);




// ✅ Ensure creator is always in users array
RoomSchema.pre("save", function (next) {
  if (this.creator) {
    const creatorId = this.creator.toString();
    const exists = this.users.some(
      (u) => u && u.toString() === creatorId
    );
    if (!exists) {
      this.users.push(this.creator);
    }
  }
  next();
});

// ✅ Index for fast retrieval
RoomSchema.index({ users: 1, updatedAt: -1 });

// Virtual room type
RoomSchema.virtual("type").get(function () {
  return this.isGroup ? "group" : "direct";
});

// ✅ Role Resolution
RoomSchema.methods.getUserRole = function (userId) {
  if (!userId) return "non_member";

  const userIdStr = userId.toString();

  // ✅ Creator check
  if (this.creator) {
    if (this.creator._id?.toString() === userIdStr) {
      return "creator";
    }
    if (this.creator.toString() === userIdStr) {
      return "creator";
    }
  }

  // ✅ Admin check (filter out null/undefined values)
  if (this.admins?.some(admin => admin && (admin._id?.toString() === userIdStr || admin.toString() === userIdStr))) {
    return "admin";
  }

  // ✅ Moderator check (filter out null/undefined values) - THIS IS THE FIX
  if (this.moderators?.some(mod => mod && (mod._id?.toString() === userIdStr || mod.toString() === userIdStr))) {
    return "moderator";
  }

  // ✅ Member check (filter out null/undefined values)
  if (this.users?.some(u => u && (u._id?.toString() === userIdStr || u.toString() === userIdStr))) {
    return "member";
  }

  // ✅ Default if not found
  return "non_member";
};

RoomSchema.methods.isModerator = function (userId) {
  return (
    this.moderators.some(m => m && m.toString() === userId.toString()) ||
    this.isAdmin(userId)
  );
};

RoomSchema.methods.isMember = function (userId) {
  return this.users.some(u => u && u.toString() === userId.toString());
};

// ✅ Permission and Role Methods
RoomSchema.methods.canManageMembers = function (userId) {
  const role = this.getUserRole(userId);
  return ["moderator", "admin", "creator"].includes(role);
};

RoomSchema.methods.canDeleteRoom = function (userId) {
  if (this.isGroup === false && this.isMember(userId)) return true;
  return this.getUserRole(userId) === "creator";
};

RoomSchema.methods.canSendMessages = function (userId) {
  const role = this.getUserRole(userId);
  return checkCanSendMessages(role, this.settings);
};

RoomSchema.methods.hasPermission = function (userId, permission) {
  if (this.isGroup === false && (permission === 'pin_messages' || permission === 'delete_any_message')) {
    if (this.isMember(userId)) return true;
  }
  const role = this.getUserRole(userId);
  return checkPermission(role, permission);
};

// ✅ Promotion / Demotion Validation
RoomSchema.methods.canPromote = function (actorId, targetId, targetRole) {
  const actorRole = this.getUserRole(actorId);
  const targetCurrentRole = this.getUserRole(targetId);

  if (!checkPermission(actorRole, `promote_to_${targetRole}`)) return false;
  return outranks(actorRole, targetCurrentRole);
};

RoomSchema.methods.canDemote = function (actorId, targetId) {
  const actorRole = this.getUserRole(actorId);
  const targetRole = this.getUserRole(targetId);

  if (targetRole === "member" || targetRole === "non_member") return false;
  if (!checkPermission(actorRole, `demote_${targetRole}`)) return false;

  return outranks(actorRole, targetRole);
};

// ✅ Member Role List
RoomSchema.methods.getMembersWithRoles = function () {
  return this.users.map(userId => ({
    userId,
    role: this.getUserRole(userId),
  }));
};

const Room = mongoose.model("rooms", RoomSchema);
export default Room;
