import mongoose from "./mongoose.js";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const { Schema } = mongoose;

const UserSchema = new Schema({
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 254, // RFC 3696 recommendation
  },
  validity: {
    phone: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 35,
  },
  username: {
    type: String,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
    sparse: true,
    maxlength: 100,
  },
  fullName: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    maxlength: 255,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: (v) => {
        const phoneNumber = parsePhoneNumberFromString(v);
        return phoneNumber && phoneNumber.isValid();
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
    set: (v) => {
      const phoneNumber = parsePhoneNumberFromString(v);
      return phoneNumber ? phoneNumber.number : v;
    },
    maxlength: 20,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 35,
  },
  tagLine: {
    type: String,
    default: "",
    maxlength: 500,
  },
  picture: { type: Schema.ObjectId, ref: "images" },
  friends: [{ type: Schema.ObjectId, ref: "users", index: true }],
  fcmToken: {
    type: String,
    index: true,
    maxlength: 255,
  },

  // 🚫 Block system
  blockedUsers: [{ type: Schema.ObjectId, ref: "users", index: true }],
  blockedBy: [{ type: Schema.ObjectId, ref: "users", index: true }],

  lastOnline: {
    type: Date,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
});

// Compound index for optimization
UserSchema.index({ _id: 1, phone: 1 });

const User = mongoose.model("users", UserSchema);

export default User;
