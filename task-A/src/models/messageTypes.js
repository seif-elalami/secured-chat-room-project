// src/models/messageTypes.js

// Define all message types supported in your chat system
export const messageTypes = {
  text: "text",       // regular text message
  image: "image",     // image message
  video: "video",     // video message
  file: "file",       // file attachment (PDF, docx, etc.)
  system: "system",
  location: "location" // system messages (user joined, left, etc.)
};

// Optionally define system chat event types
export const systemChatEvents = {
  userJoined: "userJoined",
  userLeft: "userLeft",
  messageDeleted: "messageDeleted",
  groupCreated: "groupCreated",
};
