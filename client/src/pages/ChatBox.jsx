import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, SendHorizonal } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { addMessages, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';
import Notification from "../components/Notification";

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const { connections } = useSelector((state) => state.connections);
  const { userId } = useParams();
  const { getToken } = useAuth();
  const dispatch = useDispatch();

  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch messages for the current chat
  const fetchUserMessages = async () => {
    try {
      const token = await getToken();
      dispatch(fetchMessages({ token, userId }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (!text && !image) return;

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('to_user_id', userId);
      if (text) formData.append('text', text);
      if (image) formData.append('image', image);

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setText('');
        setImage(null);
        dispatch(addMessages(data.message));
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Fetch messages when userId changes
  useEffect(() => {
    fetchUserMessages();
    return () => dispatch(resetMessages());
  }, [userId]);

  // SSE connection for real-time updates
  useEffect(() => {
    let eventSource;

    const initSSE = async () => {
      const token = await getToken();

      const SSE_URL = `${import.meta.env.VITE_BASEURL}/api/message/stream?token=${token}`;
      eventSource = new EventSource(SSE_URL);

      eventSource.onmessage = (event) => {
        try {
          const newMessage = JSON.parse(event.data);

          // Add message to redux store if relevant to this chat
          if (newMessage.from_user_id === userId || newMessage.to_user_id === userId) {
            dispatch(addMessages(newMessage));
          }

          // Show toast notification if message is from another user
          if (newMessage.from_user_id !== userId) {
            toast.custom((t) => <Notification t={t} message={newMessage} />);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      eventSource.onerror = () => eventSource.close();
    };

    initSSE();

    return () => eventSource?.close();
  }, [userId]);

  // Find the user from connections
  useEffect(() => {
    if (connections.length > 0) {
      const foundUser = connections.find((c) => c._id === userId);
      setUser(foundUser);
    }
  }, [connections, userId]);

  // Scroll to the bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    user && (
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center gap-2 p-2 md:px-10 xl:pl-24 bg-gradient-to-r from-indigo-50 to-purple-50 border-gray-300">
          <img src={user.profile_picture} alt="" className="h-8 w-8 rounded-full" />
          <div>
            <p className="font-medium">{user.full_name}</p>
            <p className="text-sm text-gray-500 -mt-1.5">@{user.username}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="p-5 md:px-10 h-full overflow-y-scroll">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages
              .slice()
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${
                    message.from_user_id === userId ? 'items-start' : 'items-end'
                  }`}
                >
                  <div
                    className={`p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${
                      message.from_user_id === userId ? 'rounded-bl-none' : 'rounded-br-none'
                    }`}
                  >
                    {message.message_type === 'image' && (
                      <img
                        src={message.media_url}
                        className="w-full max-w-sm rounded-lg mb-1"
                        alt=""
                      />
                    )}
                    {message.text && <p>{message.text}</p>}
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4">
          <div className="flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5">
            <input
              type="text"
              className="flex-1 outline-none text-slate-700"
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />

            <label htmlFor="image">
              {image ? (
                <img src={URL.createObjectURL(image)} alt="" className="h-8 w-8 rounded" />
              ) : (
                <ImageIcon className="h-6 w-6 text-gray-400 cursor-pointer" />
              )}
              <input
                type="file"
                id="image"
                accept="image/*"
                hidden
                onChange={(e) => setImage(e.target.files[0])}
              />
            </label>

            <button
              onClick={sendMessage}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  );
};

export default ChatBox;
