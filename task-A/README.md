•	Deliverables:

 Repo Link: git clone https://github.com/seifelalami/task-A.git

Setup Instructions: 
 cd task-A 
 npm instal
 npm run dev

•	2-)APIs:

     •   2.1-) POST /api/auth/register: registers a new user in the system ❌ Not protected (public endpoint)  
URL: http://localhost:3000/api/auth/register

Body (JSON) “Request”:
 {
  "username": "elalami",
  "email": "elalami@example.com",
  "phone": "+201501234967",
  "password": "sefi123123",
  "firstName": "seif",
  "lastName": "elalami"
}







Example Successful Response (Status 201):

 {

    "message": "User registered successfully",

    "token": 
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiMjVjZGEzMmM1NmQwZTNhOGUzN2QiLCJ1c2VybmFtZSI6ImVsYWxhbWkiLCJpYXQiOjE3NjEyODk2NzcsImV4cCI6MTc2MTg5NDQ3N30.gIde2tV2jgHAYdn2B6DzrQPuXQysVVFBvSvhJPTgnFs",
    "user": {

        "id": "68fb25cda32c56d0e3a8e37d",

        "username": "elalami",

        "email": "elalami@example.com",

        "phone": "+201501234967",

        "fullName": "seif elalami"
    }

}


2.1-) Protection Status:
 JWT Authentication is not applied.
Input Validation is applied. 
Password Encryption is applied. 

•	2.2-) Login: POST /auth/login - Authenticate a user and return a JWT: Done Token was generated using jsonwebtoken

URL: http://localhost:3000/api/auth/register

Body (JSON) “Request”:
{
  "username": "elalami",
  "password": "sefi123123"
}

Example Successful Response (Status 201): 
{
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiMjVjZGEzMmM1NmQwZTNhOGUzN2QiLCJ1c2VybmFtZSI6ImVsYWxhbWkiLCJpYXQiOjE3NjEyOTI5NTUsImV4cCI6MTc2MTg5Nzc1NX0.qBVn_YMVlc7BZ8lY3gfbRvxxi8OVaRYTVBlRhwlGwSA",
    "user": {
        "id": "68fb25cda32c56d0e3a8e37d",
        "username": "elalami",
        "email": "elalami@example.com",
        "phone": "+201501234967",
        "fullName": "seif elalami"
    }
}


•	2.3-) Read (Profile): GET /users/me (Protected): Fetch the profile of the currently logged-in user:      
                                       
completed: The Route is protected since you only got responses after passing a valid token, the correct user ID was extracted from the JWT., MongoDB Lockup succeeded -- it found and returned the user document tied to that token.
URL: http://localhost:3000/users/me

NO BODY: only bearer token is needed for authentication. 
 


• 2.3-) GET /users/: userId (Protected): Fetch the public profile of another user:  
To Fetch users by ID you must first have the authorization token of the logged user + user ID must be written in the request, so it is successfully fetched.
URL: http://localhost:3000/users/<user_ID>


NO BODY: But ID must be declared in URL + bearer token for authentication.

Example Successful Response (Status 201):
{
    "_id": "68faa1c536e421521d1b8156",
    "email": "alaa@example.com",
    "username": "alaa",
    "fullName": "seif elalami",
    "phone": "+201501234567"
}


• 2.4-) Update: PUT /users/me (Protected): Allow a user to update their own profile information.


URL: http://localhost:3000/users/me
Body (JSON) “Request”:
{
  "name": "lolo Updated"
}

Example Successful Response (Status 201):
{
    "validity": {
        "phone": false,
        "email": false
    },
    "_id": "68faa1c536e421521d1b8156",
    "email": "alaa@example.com",
    "firstName": "seif",
    "username": "alaa",
    "fullName": "seif elalami",
    "phone": "+201501234567",
    "lastName": "elalami",
    "tagLine": "",
"friends": [],
"blockedUsers": [
"68faa1c536e421521d1b8156"
],
"createdAt": "2025-10-23T21:44:37.160Z",
"__v": 1
}

• 2.5-) DELETE /users/me (Protected): Delete the currently authenticated user’s account.
Description:
Allows a logged-in user to permanently delete their own account. Once deleted, the user’s record will be removed from MongoDB.
URL: http://localhost:3000/users/me
Body (JSON):
No body required — only the Bearer token for authentication.

Successful Response (Status 200): 
{
  "message": "Account deleted successfully"
}


• 2.6-) POST /users/block/:userIdToBlock (Protected): Block another user.
Description:
Allows a logged-in user to block another user by their user ID. Once blocked, that user will appear in the blocker’s blocked Users list.

URL: http://localhost:3000/users/block/<userIdToBlock>
Body (JSON):
 No body required — only the Bearer token for authentication.
Example Successful Response (Status 200) 
{
  "message": "User blocked successfully"
}
Protection Status:
 JWT Authentication required.
Automatically updates blockedUsers array for the authenticated user.



• 2.7-) DELETE /users/unblock/:userIdToUnblock (Protected): Unblock a previously blocked user
Description:
Removes a user from the logged-in user’s blockedUsers list using their user ID.


URL: http://localhost:3000/users/unblock/<userIdToUnblock>
Body (JSON):
No body required — only the Bearer token for authentication.
Example Successful Response (Status 200):
{
  "message": "User unblocked successfully"
}

Protection Status:
 JWT Authentication required
Removes the target user from the authenticated user’s blockedUsers list

• 2.8-) GET /users/blocked (Protected): Get a paginated list of all blocked users.

Description:
Fetches all users the currently logged-in user has blocked. Supports pagination via query parameters page and limit.

URL: http://localhost:3000/users/blocked?page=1&limit=10


Body (JSON):
❌ No body required — only the Bearer token for authentication.
Example Successful Response (Status 200):
{
  "blockedUsers": [
    {
      "_id": "68f8dd305edf291d494acb5f",
      "username": "john_doe"
    },
    {
      "_id": "68faa1c536e421521d1b8156",
      "email": "alaa@example.com",
      "username": "alaa",
      "fullName": "seif elalami"
    }
  ],
  "pagination": {
    "totalBlocked": 2,
    "totalPages": 1,
    "currentPage": 1
  }
}

Protection Status:
 JWT Authentication required
 Paginated results supported (page, limit)
Returns both blocked users’ details and pagination metadata


• 3-) POST /media/upload:
Description:
Uploads an image or other media file to the server using multipart/form-data.
The file is stored in the /uploads directory, and a public URL is returned.

URL:http://localhost:3000/media/upload

Protection Status: Yes (Requires Authentication Token)
Request Example:
POST /media/upload
  Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
  file: <image_file>
Key  file and value chosen file

Response Example (201):
{
  "fileUrl": "http://localhost:3000/uploads/1761320305332-39655325.png"
}


•3.1-) GET /chats/:otherUserId/gallery: This endpoint retrieves all media messages for a specific conversation.

Description:
Retrieves all media files shared between the authenticated user and another user in their chat conversation.
Results are paginated.


URL:http://localhost:3000/media/upload

Protected: (Requires Authentication Token)

Request Example:

GET /media/chats/68fb25cda32c56d0e3a8e37d/gallery?page=1&limit=10
Headers:
  Authorization: Bearer <token>

Response Example (200):
{
  "data": [
    {
      "_id": "65fcaa80d8b56b6f09ef33d1",
      "sender": "68fb25cda32c56d0e3a8e37d",
      "receiver": "68fb26eaa32c56d0e3a8e57f",
      "fileUrl": "http://localhost:3000/uploads/1761320305332-39655325.png",
      "createdAt": "2025-10-24T20:35:12.456Z"
    }
  ],
  "pagination": {
    "totalPages": 1,
    "currentPage": 1
  }
}
