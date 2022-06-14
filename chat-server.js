// Require the functionality we need to use:
var http = require('http'),
	url = require('url'),
	path = require('path'),
	mime = require('mime'),
	path = require('path'),
	fs = require('fs');

// Make a simple fileserver for all of our static content.
// Everything underneath <STATIC DIRECTORY NAME> will be served.
var server = http.createServer(function (req, resp) {
	var filename = path.join(__dirname, "static", url.parse(req.url).pathname);
	(fs.exists || path.exists)(filename, function (exists) {
		if (exists) {
			fs.readFile(filename, function (err, data) {
				if (err) {
					// File exists but is not readable (permissions issue?)
					resp.writeHead(500, {
						"Content-Type": "text/plain"
					});
					resp.write("Internal server error: could not read file");
					resp.end();
					return;
				}

				// File exists and is readable
				var mimetype = mime.getType(filename);
				resp.writeHead(200, {
					"Content-Type": mimetype
				});
				resp.write(data);
				resp.end();
				return;
			});
		} else {
			// File does not exist
			resp.writeHead(404, {
				"Content-Type": "text/plain"
			});
			resp.write("Requested file not found: " + filename);
			resp.end();
			return;
		}
	});
});
server.listen(3456);


const format = require('./static/format');
// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
	wsEngine: 'ws'
});


//Create maps
const roomOwner=new Map();
const usersRooms = new Map();
const roomToPassword = new Map(); 
const userIDMap = new Map();
const banMap = new Map();

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
	// This callback runs when a new Socket.IO connection is established.'
	//show existing rooms to everyone
    socket.on("show_existing_rooms_to_server",function(data){
		isPrivate=Array.from(roomToPassword.values());
		isPrivate.forEach((element,index)=> {
               if(element==""){
				  isPrivate[index]="public";
			   }
			   else{
				   isPrivate[index]="private";
			   }
		}
		);
		io.sockets.emit("show_existing_rooms_to_client",{"rooms": Array.from(usersRooms.keys()),"roomPrivacy": isPrivate});
	})

	//Allow user to login
	socket.on('user_login_to_server', function (data) {

		const username=data['username'];
		const roomname = data['roomname'];
		const password = data['password']; 
		const userID = socket.id;

		const list = banMap.get(roomname);
		
		if (typeof (userIDMap.get(username)) === "undefined") {
			//Check if user is banned from the room
			if ((!banMap.has(roomname) || !list.includes(username))) {
				//Check if the password matches
				if (roomToPassword.has(roomname) && roomToPassword.get(roomname) == password) {

					//update usersRooms map
					const curUser = usersRooms.get(roomname);
					curUser.push(username);
					usersRooms.set(roomname, curUser);
					const owner = roomOwner.get(roomname);
					userIDMap.set(username, userID);

					//Notify client.html to display the chat room
					socket.emit("passed_Password");
					//join the room
					socket.join(roomname);
					//welcome message
					socket.emit("message_to_client", format('ChatBot', 'Welcome to the Chat!'));
					//update owner
					socket.emit("set_owner_to_client", { owner: owner });
					//alert other users
					socket.broadcast.to(roomname).emit("message_to_client", format('ChatBot', `New user ${username} joined the chat!`));
					//update users list
					io.to(roomname).emit("user_login_to_client", { usersList: usersRooms.get(roomname), roomname: roomname });

					//allow messaging
					socket.on('message_to_server', function (data) {
						// This callback runs when the server receives a new message from the client. // log it to the Node.JS output
						io.to(roomname).emit("message_to_client", format(data["userName"], data["message"])); // broadcast the message to other users
					});

					//Send private message
					socket.on("private_message_to_server", function (data) {
						const sender = data["sender"];
						const receiver = data["receiver"];
						const message = data["message"];
						const receiverID = userIDMap.get(receiver);
						io.to(receiverID).to(userID).emit("private_message_to_client", { sender: sender, message: message });
					});

					//Disband Room
					socket.on("disband_to_server",function(data){
						const roomname=data["roomname"];
						const usersInRoom = usersRooms.get(roomname);

						//delete users in the room from the userIDMap
						for (let i=0; i<usersInRoom.length;i++){
							userIDMap.delete(usersInRoom[i]);
						}

						//delete from room map
						usersRooms.delete(roomname);

						//delete from room owner map
						roomOwner.delete(roomname);

						//delete from room to password map
						roomToPassword.delete(roomname);

						//delete banned user from map
						banMap.delete(roomname);

						io.to(roomname).emit("disband_to_client");
						isPrivate=Array.from(roomToPassword.values());
							isPrivate.forEach((element,index)=> {
								if(element==""){
									isPrivate[index]="public";
								}
								else{
									isPrivate[index]="private";
								}
								}
							);
						io.sockets.emit("create_room_to_client", { "rooms": Array.from(usersRooms.keys()), roomPrivacy: isPrivate });
					});

					//Transfer Ownership to another user
					socket.on("transfer_ownership_to_server",function(data){
						const curOwner=data["sender"];
						const newOwner=data["username"];
						const usersList=usersRooms.get(roomname);
						const index= usersList.indexOf(newOwner);
						if (index != -1) {
							roomOwner.set(roomname,newOwner);
							io.to(roomname).emit("set_owner_to_client",{owner:newOwner});
							io.to(roomname).emit("message_to_client",format("ChatBot",`User ${curOwner} has transferred its ownership to ${newOwner}`));	
						}
						else{
							socket.emit("user_not_exist");
						}	
					});
				}
				else {
					socket.emit("failed_Password");
				}
		    }
			else {
				socket.emit("user_ban_to_client"); 
			}
		}
		else{
			socket.emit("username_not_allowed");
		}

			//if user decides to logout
		socket.on("user_logout_to_server",function(data){
			//alert other users
			socket.broadcast.to(roomname).emit("message_to_client",format("ChatBot",`User ${username} has left the chat`));
			//update usersRooms map
			const prevUsers=usersRooms.get(roomname);
			const index= prevUsers.indexOf(username);
			const owner=roomOwner.get(roomname);
			//check if there is an user and if the user is the owner
			if(index!=-1){
				prevUsers.splice(index,1);
			}
			usersRooms.set(roomname,prevUsers);
			userIDMap.delete(username);
			//update users list
			io.to(roomname).emit("user_login_to_client", {usersList:usersRooms.get(roomname),roomname:roomname});
		});

		//if user decides to kickout another user
		socket.on("user_kickout_to_server", function (data) {
			//alert other users
			const username = data['username'];
			const sender = data['sender'];
			
			if (username === roomOwner.get(roomname)) {
				const receiverID = userIDMap.get(sender);
				io.to(receiverID).emit("private_message_to_client", { sender: "ChatBot", message: `You cannot kick out yourself!` });
			}
			else {
				//update usersRooms map
				const prevUsers = usersRooms.get(roomname);
				const index = prevUsers.indexOf(username);
				const owner = roomOwner.get(roomname);
				//check if there is an user and if the user is the owner
				if (index != -1 && index != 0) {
					prevUsers.splice(index, 1);
					const kickID = userIDMap.get(username);
					io.to(kickID).emit("user_kickout_to_client");

					usersRooms.set(roomname, prevUsers);
					userIDMap.delete(username);
					//update users list
					io.to(roomname).emit("user_login_to_client", { usersList: usersRooms.get(roomname), roomname: roomname });

					//socket.emit("remove_user", { username: username, roomname: roomname})
					io.to(roomname).emit("message_to_client", format("ChatBot", `User ${username} got kicked out of the chat`));
				}
				else{
					socket.emit("user_not_exist");
				}				
			}
		});

		//if user decides to kickout another user
		socket.on("user_permaBan_to_server", function (data) {
			//alert other users
			const username = data['username'];
			const sender = data['sender'];

			if (username === roomOwner.get(roomname)) {
				const receiverID = userIDMap.get(sender);
				io.to(receiverID).emit("private_message_to_client", { sender: "ChatBot", message: `You cannot ban the owner!` });
			}
			else {
				//update usersRooms map
				const prevUsers = usersRooms.get(roomname);
				const index = prevUsers.indexOf(username);
				const owner = roomOwner.get(roomname);
				//check if there is an user and if the user is the owner
				if (index != -1 && index != 0) {
					prevUsers.splice(index, 1);
					const kickID = userIDMap.get(username);
					io.to(kickID).emit("user_kickout_to_client");

					usersRooms.set(roomname, prevUsers);
					userIDMap.delete(username);

					if (banMap.has(roomname)) {
						(banMap.get(roomname)).push(username); 
					}
					else {
						let banned = [username];
						banMap.set(roomname, banned); 
					}
					banMap.set(username, roomname); 

					//update users list
					io.to(roomname).emit("user_login_to_client", { usersList: usersRooms.get(roomname), roomname: roomname });

					io.to(roomname).emit("message_to_client", format("ChatBot", `User ${username} is banned from the chat`));
				}
				else{
					socket.emit("user_not_exist");
				}				
			}
		});
	});

	//create a room
	socket.on("create_room_to_server",function(data){
		const roomname=data["roomname"];
		const username = data["username"];
		const password = data["password"];
		if(typeof(userIDMap.get(username))==="undefined"){
			if(typeof(usersRooms.get(roomname))==="undefined"){
				//update roomOwner and usersRooms map
				roomOwner.set(roomname,username);
				usersRooms.set(roomname, []);
				roomToPassword.set(roomname, password); 
				//update existing rooms
				isPrivate=Array.from(roomToPassword.values());
				isPrivate.forEach((element,index)=> {
					if(element==""){
						isPrivate[index]="public";
					}
					else{
						isPrivate[index]="private";
					}
					}
				);
				io.sockets.emit("create_room_to_client",{"rooms":Array.from(usersRooms.keys()),roomPrivacy:isPrivate});
				socket.emit("roomname_allowed");
			}
			else{
				socket.emit("roomname_not_allowed");
			}
		}
		else{
			socket.emit("username_not_allowed");
		}
	});
	
});