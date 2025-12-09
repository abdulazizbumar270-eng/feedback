import React, { useEffect, useState } from "react";
import api from "../api";
import {jwtDecode} from "jwt-decode";
import Conversation from "./Conversation";
import "../styles/ChatList.css";
import { ACCESS_TOKEN } from "../token";



  const ChatList = () => {
    const [conversations, setConversations] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [currentUserId, setCurrentUserId] = useState(null);
    const [activeConversation, setActiveConversation] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
      const initializeData = async () => {
        try {
          const token = localStorage.getItem(ACCESS_TOKEN);
          if (token) {
            const decodedToken = jwtDecode(token);
            setCurrentUserId(decodedToken.user_id);
          }

          const userResponse = await api.get("users/");
          setUsers(userResponse.data);
          console.log('ChatList: fetched users', userResponse.data);

          const conversationResponse = await api.get("conversations/");
          setConversations(conversationResponse.data);
          console.log('ChatList: fetched conversations', conversationResponse.data);
        } catch (error) {
          console.error("Error initializing data:", error);
        }
      };

      initializeData();
    }, []);

    const handleStartConversation = async () => {
      if (selectedUser && currentUserId) {
        const participants = [selectedUser, currentUserId];
        try {
          const response = await api.post("conversations/", { participants });
          setConversations([...conversations, response.data]);
          setActiveConversation(response.data);
          setErrorMessage("");
        } catch (error) {
          if (error.response?.data?.error) {
            setErrorMessage(error.response.data.error);
          } else {
            setErrorMessage("An unexpected error occurred. Please try again.");
          }
        }
      }
    };

    const handleMessageAdmin = async () => {
      console.log('handleMessageAdmin: currentUserId, users, visibleUsers', currentUserId, users, visibleUsers);
      const admin = visibleUsers.find((u) => u.is_staff || u.is_superuser) || visibleUsers[0];
      console.log('handleMessageAdmin: chosen admin', admin);
      if (!admin) return setErrorMessage('No admin available to message');
      const participants = [admin.id, currentUserId];
      console.log('handleMessageAdmin: participants payload', participants);
      try {
        const response = await api.post('conversations/', { participants });
        console.log('handleMessageAdmin: conversation created', response.data);
        setConversations([...conversations, response.data]);
        setActiveConversation(response.data);
        setErrorMessage('');
      } catch (error) {
        console.error('handleMessageAdmin error', error.response || error);
        setErrorMessage(error.response?.data?.error || 'Could not start conversation with admin');
      }
    }

    const handleSelectConversation = (conversation) => {
      setActiveConversation(conversation);
      setErrorMessage("");
    };

    const handleBackToChatList = () => {
      setActiveConversation(null);
    };

    // Treat the first fetched user as the admin.
    const adminUser = users && users.length ? users[0] : null;
    const isAdmin = adminUser ? Number(adminUser.id) === Number(currentUserId) : false;

    // Visible users: if current user is the admin show all other users; otherwise show only the admin (if not self).
    const visibleUsers = (() => {
      if (!adminUser) return [];
      if (isAdmin) {
        return users.filter((u) => Number(u.id) !== Number(currentUserId));
      }
      return Number(adminUser.id) !== Number(currentUserId) ? [adminUser] : [];
    })();

    console.log('ChatList: adminUser, isAdmin, visibleUsers', adminUser, isAdmin, visibleUsers);

    return (
      <div className="chat-list-container">
        <div className={`chat-sidebar ${activeConversation ? "slide-out" : "slide-in"}`}>
          <header className="chat-header">
            <h1>Welcome to ChitChat</h1>
            <p>Connect with your friends instantly!</p>
          </header>
          <div className="user-selector">
            <select onChange={(e) => setSelectedUser(Number(e.target.value))} value={selectedUser || ""}>
              <option value="" disabled>
                Select a user to chat with
              </option>
              {visibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
            <button onClick={handleStartConversation} disabled={!visibleUsers.length || !selectedUser}>Start Conversation</button>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </div>
          <div className="conversation-list">
            <h2>Active Conversations</h2>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="conversation-item"
                onClick={() => handleSelectConversation(conversation)}
              >
                <p>
                  {conversation.participants
                    .filter((user) => user.id !== currentUserId)
                    .map((user) => user.username)
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          {activeConversation ? (
            <Conversation
              conversationId={activeConversation.id}
              currentUserId={currentUserId}
              onBack={handleBackToChatList}
            />
          ) : (
            <p className="no-conversation-message">Select a conversation to view.</p>
          )}
        </div>
      </div>
    );
  };

  export default ChatList;