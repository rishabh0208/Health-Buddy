import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Send,
  MessageSquare,
  Activity,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Heart,
  User,
  Info,
  BookOpen,
  LogOut,
  X,
  Moon,
  Sun,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

function App({ currentUserId, setCurrentUserId }) {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [timeFilter, setTimeFilter] = useState("week");
  const [symptomData, setSymptomData] = useState([]);
  const [chartData, setChartData] = useState([]);

  const [showUserInfo, setShowUserInfo] = useState(false);
  const [userData, setUserData] = useState(null);
  const bottomRef = useRef(null);

  const deleteChat = async (chatId) => {
    if (!confirm("Are you sure you want to delete this chat?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove the deleted chat from the chat history
        setChatHistory(chatHistory.filter((chat) => chat._id !== chatId));

        // If the current chat is the one being deleted, reset to create a new chat
        if (currentChat.chatId === chatId) {
          setCurrentChat({
            chatId: null,
            messages: [],
          });
        }
      } else {
        console.error("Failed to delete chat");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  // Theme colors
  const theme = {
    light: {
      background: "#f9f7f2",
      sidebar: "#eae6dd",
      border: "#e2ded5",
      text: "#3d3d3d",
      secondaryText: "#777777",
      cardBg: "white",
      accent: "#d89171",
      accentHover: "#c68266",
    },
    dark: {
      background: "#1a1a1a",
      sidebar: "#262626",
      border: "#333333",
      text: "#e0e0e0",
      secondaryText: "#a0a0a0",
      cardBg: "#333333",
      accent: "#d89171",
      accentHover: "#c68266",
    },
  };

  // Get current theme based on darkMode state
  const currentTheme = darkMode ? theme.dark : theme.light;

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // Save preference to localStorage
    localStorage.setItem("darkMode", !darkMode);
  };

  // Load darkMode preference from localStorage on initial mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === "true");
    }
  }, []);

  // Add this to your useEffect that fetches user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUserId) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/users/${currentUserId}`
        );
        const data = await response.json();

        // If the health summary doesn't exist, fetch it
        if (!data.healthSummary) {
          try {
            const summaryResponse = await fetch(
              `${API_BASE_URL}/users/${currentUserId}/health-summary`
            );
            const summaryData = await summaryResponse.json();
            data.healthSummary = summaryData.summary;
          } catch (summaryError) {
            console.error("Error loading health summary:", summaryError);
          }
        }

        setUserData(data);
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    loadUserData();
  }, [currentUserId]);

  useEffect(() => {
    const loadSymptoms = async () => {
      if (!currentUserId) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/users/${currentUserId}/symptoms?filter=${timeFilter}`
        );
        const data = await response.json();

        setSymptomData(data);

        // Transform data for chart
        const chartData = data.map((item) => ({
          symptom: item.symptom,
          count: item.count,
          dates: item.dates,
        }));
        setChartData(chartData);
      } catch (error) {
        console.error("Error loading symptoms:", error);
      }
    };

    loadSymptoms();
  }, [currentUserId, timeFilter]);

  useEffect(() => {
    const loadUserChats = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/chats/user/${currentUserId}`
        );
        const chats = await response.json();
        setChatHistory(chats);
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };

    if (currentUserId) {
      loadUserChats();
    }
  }, [currentUserId]);

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const [currentChat, setCurrentChat] = useState({
    chatId: null, // Existing chat ID or null for new
    messages: [],
  });

  const handleSubmit = async () => {
    // if (!input.trim()) return;

    // Ensure we have a user ID (you'll need to implement user creation/login)
    if (!currentUserId) {
      alert("Please create a user first");
      return;
    }

    let messageContent = input;
    if (selectedMood && !input) {
      messageContent = selectedMood;
    }

    // Add user message to local state
    const updatedMessages = [
      ...currentChat.messages,
      { role: "user", content: messageContent },
    ];
    setCurrentChat({ ...currentChat, messages: updatedMessages });
    setInput("");
    setResponse("");

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: messageContent,
          userId: currentUserId,
          chatId: currentChat.chatId,
        }),
      });
      // In your handleSubmit function, after getting the response:
      const retrievedContextHeader = response.headers.get(
        "X-Retrieved-Context"
      );

      let retrievedChunks = [];
      if (retrievedContextHeader) {
        try {
          retrievedChunks = JSON.parse(atob(retrievedContextHeader));
        } catch (error) {
          console.error("Error parsing retrieved context:", error);
        }
      }

      setCurrentChat((prev) => {
        const messages = [...prev.messages];
        const aiIndex = messages.findIndex(
          (msg) => msg.role === "assistant" && msg.content === ""
        );

        if (aiIndex !== -1) {
          messages.splice(aiIndex, 0, {
            role: "system",
            content: `🔍 Relevant Information:\n${retrievedChunks.join(
              "\n\n"
            )}`,
          });
        }
        return { ...prev, messages };
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      // Check for new chat ID in headers
      const newChatId = response.headers.get("X-Chat-Id");
      if (newChatId) {
        setCurrentChat((prev) => ({
          ...prev,
          chatId: newChatId,
        }));
      }

      // Add AI response placeholder
      setCurrentChat((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "assistant", content: "" }],
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        fullResponse += textChunk;
        setResponse((prev) => prev + textChunk);

        // Update the last message with streaming text
        setCurrentChat((prev) => {
          const messages = [...prev.messages];
          messages[messages.length - 1].content = fullResponse;
          return { ...prev, messages };
        });
      }

      // Final update to ensure completeness
      setCurrentChat((prev) => {
        const messages = [...prev.messages];
        messages[messages.length - 1].content = fullResponse;
        return { ...prev, messages };
      });
    } catch (error) {
      console.error("Error:", error);
      // Rollback optimistic updates if needed
      setCurrentChat((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -1),
      }));
    }
  };

  const loadChatHistory = async (chatId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chat = await response.json();

      // Ensure convo exists and is an array
      if (!chat?.convo || !Array.isArray(chat.convo)) {
        throw new Error("Invalid chat data structure");
      }

      // Convert to message format with proper error handling
      const messages = chat.convo
        .filter((msg) => msg.sender && msg.message) // Filter out invalid entries
        .map((msg) => ({
          role: msg.sender,
          content: msg.message,
          timestamp: msg.createdAt, // Add timestamp if needed
        }));

      setCurrentChat({
        chatId: chat._id,
        messages,
        title: chat.name,
      });
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  useEffect(() => {
    if (selectedMood) {
      handleSubmit();
    }
  }, [selectedMood]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentChat.messages]);

  return (
    <div
      className="flex h-screen"
      style={{ backgroundColor: currentTheme.background }}
    >
      {/* Left Sidebar - Chat History */}
      <div
        className={`${
          leftSidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 flex flex-col relative border-r`}
        style={{
          backgroundColor: currentTheme.sidebar,
          borderColor: currentTheme.border,
          color: currentTheme.text,
        }}
      >
        {!leftSidebarOpen && (
          <button
            onClick={() => setLeftSidebarOpen(true)}
            className="absolute -right-8 top-4 p-1 rounded-r-md"
            style={{ backgroundColor: currentTheme.sidebar }}
          >
            <ChevronRight size={16} style={{ color: currentTheme.text }} />
          </button>
        )}

        {leftSidebarOpen && (
          <>
            <div
              className="p-4 border-b flex justify-between items-center"
              style={{ borderColor: currentTheme.border }}
            >
              <div className="flex items-center">
                <h2
                  className="font-bold text-xl"
                  style={{ color: currentTheme.text }}
                >
                  Past Conversations
                </h2>
              </div>
              <button
                onClick={() => setLeftSidebarOpen(false)}
                style={{ color: currentTheme.secondaryText }}
                className="hover:text-[#3d3d3d]"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            <button
              onClick={() => {
                setCurrentChat({
                  chatId: null,
                  messages: [],
                });
                setSelectedMood("");
              }}
              className="mx-4 hover:cursor-pointer px-4 py-2 rounded-3xl text-white text-left font-medium my-2"
              style={{
                backgroundColor: currentTheme.accent,
                color: "white",
              }}
            >
              + New Conversation
            </button>
            <div className="overflow-y-auto flex-grow">
              {chatHistory.map((chat) => {
                return (
                  <div
                    key={chat._id}
                    className="px-4 py-3 hover:bg-[#e2ded5] cursor-pointer relative"
                    style={{
                      color: currentTheme.text,
                      "&:hover": {
                        backgroundColor: darkMode ? "#333333" : "#e2ded5",
                      },
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex items-start flex-grow"
                        onClick={() => {
                          loadChatHistory(chat._id);
                        }}
                      >
                        <MessageSquare
                          size={16}
                          className="mt-1 mr-2 flex-shrink-0"
                          style={{ color: currentTheme.secondaryText }}
                        />
                        <div>
                          <h3
                            className="font-medium truncate"
                            style={{ color: currentTheme.text }}
                          >
                            {chat.name}
                          </h3>
                          <p
                            style={{ color: currentTheme.secondaryText }}
                            className="text-sm"
                          >
                            {chat.date}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat._id);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="p-4 mt-auto border-t"
              style={{ borderColor: currentTheme.border }}
            >
              <button
                onClick={() => setCurrentUserId(null)}
                className="flex items-center w-full p-2 cursor-pointer"
                style={{ color: currentTheme.secondaryText }}
              >
                <LogOut size={16} className="mr-2" />
                <span>Logout</span>
              </button>
              <button
                className="flex items-center  p-2 mt-2 cursor-pointer"
                style={{ color: currentTheme.secondaryText }}
                onClick={() => setShowUserInfo(true)}
              >
                <User size={16} className="mr-2" />
                <span>Profile</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div
        className="flex-grow flex flex-col h-full overflow-hidden"
        style={{ backgroundColor: currentTheme.background }}
      >
        {/* Chat Header */}
        <div
          className="my-3 mx-4 rounded-xl p-4 border shadow-sm flex items-center justify-between"
          style={{
            backgroundColor: currentTheme.cardBg,
            borderColor: currentTheme.border,
          }}
        >
          <div className="flex items-center">
            <div className="rounded-2xl p-2 mr-3"></div>
            <div>
              <h1
                className="font-bold text-xl"
                style={{ color: currentTheme.text }}
              >
                Humanoid AI
              </h1>
              <p
                className="text-sm"
                style={{ color: currentTheme.secondaryText }}
              >
                Your health assistant
              </p>
            </div>
          </div>
        </div>

        {!currentChat.chatId && (
          <div className="max-w-3xl mx-auto mb-4">
            <div
              className="p-8 rounded-lg my-50 border shadow-2xl"
              style={{
                backgroundColor: currentTheme.cardBg,
                borderColor: currentTheme.border,
              }}
            >
              <label
                className="flex flex-col text-2xl m-16 my-8 font-medium mt-2"
                style={{ color: currentTheme.text }}
              >
                What are you experiencing today?
                <p
                  className="font-normal text-lg self-center"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Tell us about your symptoms
                </p>
              </label>
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="w-full p-2 mb-6 border rounded-lg outline-none"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                }}
              >
                <option value="">Select a symptom</option>
                <option value="weakness">Weakness</option>
                <option value="fatigue">Fatigue</option>
                <option value="headache">Headache</option>
                <option value="fever">Fever</option>
                <option value="anxiety">Anxiety</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-grow overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto">
            {currentChat.messages.map((message, index) => (
              <div
                key={index}
                className={`mb-6 ${message.role === "user" ? "ml-auto" : ""}`}
              >
                {message.role === "system" ? (
                  <div className="mb-4 mx-4 bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                    <div className="text-sm text-blue-800">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({
                            node,
                            inline,
                            className,
                            children,
                            ...props
                          }) {
                            const match = /language-(\w+)/.exec(
                              className || ""
                            );
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={okaidia}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg overflow-hidden"
                                wrapLongLines
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code
                                className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          pre({ children }) {
                            return <div className="my-2">{children}</div>;
                          },
                          a({ children, href }) {
                            return (
                              <a
                                href={href}
                                className="text-blue-600 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            );
                          },
                          ul({ children }) {
                            return (
                              <ul className="list-disc pl-6 mb-2">
                                {children}
                              </ul>
                            );
                          },
                          ol({ children }) {
                            return (
                              <ol className="list-decimal pl-6 mb-2">
                                {children}
                              </ol>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-start ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === "user" ? "ml-2" : "mr-2"
                      }`}
                      style={{
                        backgroundColor:
                          message.role === "user"
                            ? currentTheme.accent
                            : "#555555",
                      }}
                    >
                      {message.role === "user" ? (
                        <User size={16} className="text-white" />
                      ) : (
                        <Heart size={16} className="text-white" />
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-lg max-w-xl shadow-sm border ${
                        message.role === "user" ? "text-right" : ""
                      }`}
                      style={{
                        backgroundColor: currentTheme.cardBg,
                        borderColor: currentTheme.border,
                        color: currentTheme.text,
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({
                            node,
                            inline,
                            className,
                            children,
                            ...props
                          }) {
                            const match = /language-(\w+)/.exec(
                              className || ""
                            );
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={okaidia}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg overflow-hidden"
                                wrapLongLines
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code
                                className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          pre({ children }) {
                            return <div className="my-2">{children}</div>;
                          },
                          a({ children, href }) {
                            return (
                              <a
                                href={href}
                                className="text-blue-600 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            );
                          },
                          ul({ children }) {
                            return (
                              <ul className="list-disc pl-6 mb-2">
                                {children}
                              </ul>
                            );
                          },
                          ol({ children }) {
                            return (
                              <ol className="list-decimal pl-6 mb-2">
                                {children}
                              </ol>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        {/* Input Area */}
        {currentChat.chatId ? (
          <div
            className="p-4 border-t"
            style={{ borderColor: currentTheme.border }}
          >
            <div className="max-w-3xl mx-auto">
              <div
                className="flex items-center border rounded-lg shadow-sm"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="How can I help you today?"
                  className="flex-grow p-3 outline-none rounded-lg"
                  style={{
                    backgroundColor: currentTheme.cardBg,
                    color: currentTheme.text,
                  }}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button
                  onClick={handleSubmit}
                  className="p-3 hover:text-[#c68266]"
                  style={{ color: currentTheme.accent }}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Right Sidebar - Insights */}
      <div
        className={`${
          rightSidebarOpen ? "w-72" : "w-0"
        } border-l transition-all duration-300 flex flex-col relative`}
        style={{
          backgroundColor: currentTheme.sidebar,
          borderColor: currentTheme.border,
          color: currentTheme.text,
        }}
      >
        {!rightSidebarOpen && (
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="absolute -left-8 top-4 p-1 rounded-l-md"
            style={{ backgroundColor: currentTheme.sidebar }}
          >
            <ChevronLeft size={16} style={{ color: currentTheme.text }} />
          </button>
        )}

        {rightSidebarOpen && (
          <>
            <div
              className="p-4 border-b flex justify-between items-center"
              style={{ borderColor: currentTheme.border }}
            >
              <div className="flex items-center">
                <Info
                  size={18}
                  className="mr-2"
                  style={{ color: currentTheme.secondaryText }}
                />
                <h2 className="font-bold" style={{ color: currentTheme.text }}>
                  Health Insights
                </h2>
              </div>
              <button
                onClick={() => setRightSidebarOpen(false)}
                style={{ color: currentTheme.secondaryText }}
                className="hover:text-[#3d3d3d]"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h3
                    className="font-medium text-sm uppercase flex items-center"
                    style={{ color: currentTheme.secondaryText }}
                  >
                    <Activity size={14} className="mr-1" />
                    Topics Discussed
                  </h3>
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="text-xs border rounded p-1"
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderColor: currentTheme.border,
                      color: currentTheme.text,
                    }}
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {symptomData.map((item, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 rounded border"
                      style={{
                        backgroundColor: currentTheme.cardBg,
                        borderColor: currentTheme.border,
                        color: currentTheme.text,
                      }}
                    >
                      {item.symptom} ({item.count})
                    </span>
                  ))}
                  {symptomData.length === 0 && (
                    <span
                      className="text-xs"
                      style={{ color: currentTheme.secondaryText }}
                    >
                      No symptoms recorded
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3
                  className="font-medium text-sm uppercase mb-2 flex items-center"
                  style={{ color: currentTheme.secondaryText }}
                >
                  <Calendar size={14} className="mr-1" />
                  Symptom Tracker
                </h3>
                <div
                  className="p-3 rounded-lg border h-64"
                  style={{
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                  }}
                >
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="symptom" fontSize={12} />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: currentTheme.cardBg,
                            color: currentTheme.text,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill={currentTheme.accent}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      className="text-center text-sm h-full flex items-center justify-center"
                      style={{ color: currentTheme.secondaryText }}
                    >
                      No symptom data available
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3
                  className="font-medium text-sm uppercase mb-2 flex items-center"
                  style={{ color: currentTheme.secondaryText }}
                >
                  <BookOpen size={14} className="mr-1" />
                  Health Summary
                </h3>
                <div
                  className="p-3 rounded-lg border text-sm"
                  style={{
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                  }}
                >
                  {userData?.healthSummary ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, children }) => (
                          <p
                            style={{ color: currentTheme.text }}
                            className="mb-2"
                          >
                            {children}
                          </p>
                        ),
                        strong: ({ node, children }) => (
                          <span className="font-semibold">{children}</span>
                        ),
                        em: ({ node, children }) => (
                          <span className="italic">{children}</span>
                        ),
                        ul: ({ node, children }) => (
                          <ul className="list-disc pl-4 mb-2">{children}</ul>
                        ),
                        ol: ({ node, children }) => (
                          <ol className="list-decimal pl-4 mb-2">{children}</ol>
                        ),
                        li: ({ node, children }) => (
                          <li className="mb-1">{children}</li>
                        ),
                      }}
                    >
                      {userData.healthSummary}
                    </ReactMarkdown>
                  ) : (
                    <p
                      className="italic"
                      style={{ color: currentTheme.secondaryText }}
                    >
                      Your health summary will appear here as you continue your
                      wellness journey.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div
              className="mt-auto p-4 border-t"
              style={{ borderColor: currentTheme.border }}
            >
              <button
                className="w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                }}
              >
                <Activity size={16} className="mr-2" />
                View Health Timeline
              </button>
            </div>
          </>
        )}
      </div>

      {showUserInfo && userData && (
        <div className="fixed inset-0 backdrop-blur-md bg-transparent flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 max-w-md w-full border shadow-lg"
            style={{
              backgroundColor: currentTheme.background,
              borderColor: currentTheme.border,
            }}
          >
            <div
              className="flex justify-between items-center mb-4 border-b pb-3"
              style={{ borderColor: currentTheme.border }}
            >
              <div className="flex items-center">
                <User
                  size={20}
                  className="mr-2"
                  style={{ color: currentTheme.accent }}
                />
                <h2
                  className="text-xl font-bold"
                  style={{ color: currentTheme.text }}
                >
                  User Profile
                </h2>
              </div>
              <button
                onClick={() => setShowUserInfo(false)}
                style={{ color: currentTheme.secondaryText }}
                className="hover:text-[#3d3d3d]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Theme Toggle Button */}
            <div
              className="p-4 rounded-lg border my-4 font-medium"
              style={{
                backgroundColor: currentTheme.cardBg,
                borderColor: currentTheme.border,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="" style={{ color: currentTheme.text }}>
                  Theme
                </p>
                <button onClick={toggleDarkMode}>
                  {darkMode ? (
                    <div className="cursor-pointer">
                      <Sun size={16} className="mr-1.5 text-white" />
                      <span className=" text-white">Light</span>
                    </div>
                  ) : (
                    <div className="cursor-pointer">
                      <Moon size={16} className="mr-1.5 " />
                      <span>Dark</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Name
                </p>
                <p className="font-medium" style={{ color: currentTheme.text }}>
                  {userData.name}
                </p>
              </div>
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Email
                </p>
                <p className="font-medium" style={{ color: currentTheme.text }}>
                  {userData.email}
                </p>
              </div>
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Age
                </p>
                <p className="font-medium" style={{ color: currentTheme.text }}>
                  {userData.age}
                </p>
              </div>
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Menstruation Cycle
                </p>
                <p
                  className="font-medium capitalize"
                  style={{ color: currentTheme.text }}
                >
                  {userData.menstruationCycleType}
                </p>
              </div>
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.border,
                }}
              >
                <p
                  className="text-sm"
                  style={{ color: currentTheme.secondaryText }}
                >
                  Account Created
                </p>
                <p className="font-medium" style={{ color: currentTheme.text }}>
                  {new Date(userData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
