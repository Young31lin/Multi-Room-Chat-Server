# Multi-Room-Chat-Server
I developed a multi-room chat server that allowed users to create and join different chat rooms. The entire application is displayed on a single webpage. As a creator of the room, one can temporarily kick users out of the room, permanently ban users from joining that particular room, transfer ownership of the room, and disband the chat room completely. Additionally, users also have the option to create private rooms, which will require password authentication when others try joining them.

The server was built by leveraging Node.js as the runtime environment. This allows the server to handle heavy input-output operations because of its asynchronous nature. I also used Socket.IO to establish a WebSocket connection that enables real-time, bidirectional communication between the server and the client.

# Instructions
1. Run node chat-server.js
