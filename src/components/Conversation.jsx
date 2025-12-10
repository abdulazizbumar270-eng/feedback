import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import "../styles/Conversation.css";
import { ACCESS_TOKEN } from "../token";
import { useParams } from 'react-router-dom'
import {jwtDecode} from 'jwt-decode'

const Conversation = ({ conversationId: propConversationId, currentUserId: propCurrentUserId, onBack }) => {
  const params = useParams()
  const conversationId = propConversationId || params.conversationId
  // derive current user id from prop or token
  const [derivedCurrentUserId, setDerivedCurrentUserId] = useState(propCurrentUserId || null)
  const currentUserId = propCurrentUserId || derivedCurrentUserId
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchConversationData = async () => {
      if (!conversationId) {
        console.error("Invalid conversationId:", conversationId);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/conversations/${conversationId}/messages/`);
        const messages = response.data || [];
        setMessages(messages);

        if (messages.length > 0) {
          const participants = messages[0]?.participants || [];
          const chatPartner = participants.find((user) => user.id !== currentUserId);

          if (chatPartner) {
            setChatPartner(chatPartner);
          } else {
            console.error("No valid chat partner found");
          }
        }
      } catch (error) {
        console.error("Error fetching conversation data:", error);
      } finally {
        setLoading(false);
      }
    };

    // ensure we have current user id from token if not provided
    if (!propCurrentUserId) {
      const token = localStorage.getItem(ACCESS_TOKEN)
      if (token) {
        try {
          const decoded = jwtDecode(token)
          if (decoded?.user_id) setDerivedCurrentUserId(decoded.user_id)
        } catch (e) {
          console.warn('Failed to decode token for user id')
        }
      }
    }

    fetchConversationData();
  }, [conversationId, currentUserId, propCurrentUserId]);

  useEffect(() => {
    if (!conversationId) return;
    const token = localStorage.getItem(ACCESS_TOKEN);

    // build ws/wss URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Prefer explicit env var, otherwise default to same hostname but backend port 8000 for dev
    let host = import.meta.env.VITE_API_WS_HOST;
    if (!host) {
      const hostname = window.location.hostname || 'localhost'
      host = `${hostname}:8000`
    }
    const wsUrl = `${protocol}://${host}/ws/chat/${conversationId}/?token=${token}`
    console.log('Attempting WebSocket connection to', wsUrl)
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connection established");
      setSocketReady(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "chat_message") {
          const { id: serverId, message, user, timestamp, temp_id } = data;
          // If we have an optimistic message (temp) for this user, replace it by temp_id first
          setMessages((prevMessages) => {
            if (temp_id) {
              const optimisticIndex = prevMessages.findIndex((m) => m.tempId === temp_id);
              if (optimisticIndex !== -1) {
                const next = [...prevMessages];
                next[optimisticIndex] = { sender: user, content: message, timestamp, id: serverId };
                return next;
              }
            }

            // fallback: find index of an optimistic message that matches content and sender
            const optimisticIndex = prevMessages.findIndex(
              (m) => m.tempId && m.content === message && m.sender?.id === user.id
            );
            if (optimisticIndex !== -1) {
              const next = [...prevMessages];
              next[optimisticIndex] = { sender: user, content: message, timestamp, id: serverId };
              return next;
            }

            // fallback: avoid duplicates by content/user/timestamp proximity
            const isDuplicate = prevMessages.some(
              (m) => m.content === message && m.sender?.id === user.id && Math.abs(new Date(m.timestamp) - new Date(timestamp)) < 1000
            );
            if (isDuplicate) return prevMessages;
            return [...prevMessages, { sender: user, content: message, timestamp, id: serverId }];
          });
          setTypingUser(null);
        } else if (data.type === "typing") {
          const { user, receiver } = data;

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Only show typing indicator if the current user is the receiver
          if (receiver === currentUserId && user.id !== currentUserId) {
            setTypingUser(user);
            // Set new timeout and store the reference
            typingTimeoutRef.current = setTimeout(() => {
              setTypingUser(null);
              typingTimeoutRef.current = null;
            }, 2000);
          }
        } else if (data.type === "online_status") {
          if (data.status === "online") {
            setOnlineUsers((prev) => [...prev, ...data.online_users]);
          } else if (data.status === "offline") {
            setOnlineUsers((prev) =>
              prev.filter((user) => !data.online_users.some((u) => u.id === user.id))
            );
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setSocketReady(false);
    };

    websocket.onclose = (ev) => {
      console.warn('WebSocket closed', ev.code, ev.reason)
      setSocketReady(false);
    }

    setSocket(websocket);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      try { websocket.close() } catch (e) {}
        setSocketReady(false);
    };
  }, [conversationId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    try {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch (e) {
      // ignore
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!conversationId || !newMessage.trim()) {
      console.error("Cannot send message: Invalid conversationId or empty message");
      return;
    }

    if (!currentUserId) {
      console.error("currentUserId not set yet");
      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open. Message not sent.");
      return;
    }

    // create a temporary id for optimistic UI
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const messagePayload = {
      type: "chat_message",
      message: newMessage,
      temp_id: tempId,
      conversation: conversationId,
    };

    // Optimistically add message to UI immediately with a tempId
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        tempId,
        sender: { id: Number(currentUserId) },
        content: newMessage,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      socket.send(JSON.stringify(messagePayload));
    } catch (err) {
      console.error("Failed to send message over WebSocket:", err);
    }

    setNewMessage("");
  };

  const handleTyping = () => {
    // If websocket isn't open yet or chat partner unknown, silently skip typing event
    if (!chatPartner || socket?.readyState !== WebSocket.OPEN) {
      // not ready to send typing event yet
      return;
    }

    const receiverId = chatPartner.id; // Use chatPartner.id as the receiverId

    console.log(`Sending typing event for receiverId: ${receiverId}`);

    socket.send(
      JSON.stringify({
        type: "typing",
        user: currentUserId, // Current user ID
        receiver: receiverId, // Receiver ID from chatPartner
      })
    );
  };

  const debouncedHandleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // only send typing if socket is open and we have a chat partner
    if (chatPartner && socket?.readyState === WebSocket.OPEN) {
      handleTyping();
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await api.delete(`/conversations/${conversationId}/messages/${messageId}/`);
      if (response.status === 204) {
        setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== messageId));
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };
  

  return (
    <div className="conversation-container">
      <div className="conversation-header">
        <button className="back-button" onClick={onBack}>Back</button>
        <h3>{chatPartner ? `Chat with ${chatPartner.username}` : "Chat"}</h3>
        <div className="online-status">
          {onlineUsers.length > 0 ? (
            onlineUsers.map((user) => (
              <span key={user.id} className="online-user">
                {user.username} (online)
              </span>
            ))
          ) : (
            <span>No users online</span>
          )}
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <p>Loading messages...</p>
        ) : (
          messages.map((message, index) => {
            const msgKey = message.id ?? message.tempId ?? index;
            const isSentByCurrentUser = Number(message.sender?.id) === Number(currentUserId);

            return (
              <div key={msgKey} className={`message-wrapper ${isSentByCurrentUser ? "sent" : "received"}`}>
                {!isSentByCurrentUser && (
                  <span className="message-username">
                    {message.sender?.username || "Unknown"}
                  </span>
                )}
                <div className="message-bubble">
                  {message.content}
                  {isSentByCurrentUser && (
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteMessage(message.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <div className="typing-indicator">
          {typingUser.username} is typing...
        </div>
      )}

      <div className="input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value) 
            debouncedHandleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Type a message..."
          className="message-input"
        />
        <button className="send-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Conversation;