import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { api } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executionMode, setExecutionMode] = useState('step');
  const [theme, setTheme] = useState('light');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPromptText, setEditPromptText] = useState('');
  const [rerunStage1ModelLoading, setRerunStage1ModelLoading] = useState(null);
  const [rerunStage2ModelLoading, setRerunStage2ModelLoading] = useState(null);
  const [rerunStage3Loading, setRerunStage3Loading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const initial = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    } catch {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const handleToggleTheme = () => {
    try {
      const next = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    } catch (err) {
      console.error('Failed to toggle theme:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleDeleteConversation = async (id) => {
    const prevConvs = conversations;
    // Optimistic update: remove locally
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setCurrentConversation(null);
    }
    try {
      const res = await api.deleteConversation(id);
      return { ok: true, res };
    } catch (error) {
      // Revert on failure
      setConversations(prevConvs);
      return { ok: false, error };
    }
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(
        currentConversationId,
        content,
        (eventType, event) => {
          switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            break;

          case 'paused':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.paused = true;
              lastMsg.pausedStage = event.stage;
              lastMsg.loading = { ...(lastMsg.loading || {}), stage1: false, stage2: false, stage3: false };
              return { ...prev, messages };
            });
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      },
      executionMode
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  

  const startEditPrompt = () => {
    if (!currentConversation) return;
    const msgIndex = currentConversation.messages.length - 1;
    const userIndex = msgIndex - 1;
    const currentText = currentConversation.messages[userIndex]?.content || '';
    setEditPromptText(currentText);
    setIsEditingPrompt(true);
  };

  const saveEditedPrompt = async (newText) => {
    try {
      setIsResetting(true);
      setIsEditingPrompt(false);
      await new Promise((r) => setTimeout(r, 200));

      // Reset to initial conditions
      setCurrentConversationId(null);
      setCurrentConversation(null);
      setIsLoading(false);
      setRerunStage1ModelLoading(null);
      setRerunStage2ModelLoading(null);
      setRerunStage3Loading(false);

      // Create a fresh conversation
      const newConv = await api.createConversation();
      setConversations((prev) => [{ id: newConv.id, created_at: newConv.created_at, message_count: 0 }, ...prev]);
      setCurrentConversationId(newConv.id);
      setCurrentConversation(newConv);

      // Allow state to settle then start from the beginning with the edited prompt
      await new Promise((r) => setTimeout(r, 50));
      await handleSendMessage(newText);
    } catch (error) {
      console.error('Restart failed:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const cancelEditPrompt = () => {
    setIsEditingPrompt(false);
  };

  const handleRerunStage1Model = async (modelName) => {
    if (!currentConversationId || !currentConversation) return;
    const msgIndex = currentConversation.messages.length - 1;
    try {
      setRerunStage1ModelLoading(modelName);
      const res = await api.rerunStage1Model(currentConversationId, msgIndex, modelName);
      setCurrentConversation((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        lastMsg.stage1 = res.stage1;
        return { ...prev, messages };
      });
    } catch (error) {
      console.error('Failed to rerun Stage 1 model:', error);
    } finally {
      setRerunStage1ModelLoading(null);
    }
  };

  const handleRerunStage2Model = async (modelName) => {
    if (!currentConversationId || !currentConversation) return;
    const msgIndex = currentConversation.messages.length - 1;
    try {
      setRerunStage2ModelLoading(modelName);
      const res = await api.rerunStage2Model(currentConversationId, msgIndex, modelName);
      setCurrentConversation((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        lastMsg.stage2 = res.stage2;
        lastMsg.metadata = res.metadata;
        return { ...prev, messages };
      });
    } catch (error) {
      console.error('Failed to rerun Stage 2 model:', error);
    } finally {
      setRerunStage2ModelLoading(null);
    }
  };

  const handleRerunStage3 = async () => {
    if (!currentConversationId || !currentConversation) return;
    const msgIndex = currentConversation.messages.length - 1;
    try {
      setRerunStage3Loading(true);
      const res = await api.rerunStage3(currentConversationId, msgIndex);
      setCurrentConversation((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        lastMsg.stage3 = res.stage3;
        return { ...prev, messages };
      });
    } catch (error) {
      console.error('Failed to rerun Stage 3:', error);
    } finally {
      setRerunStage3Loading(false);
    }
  };

  const handleContinueNextStage = async () => {
    if (!currentConversationId || !currentConversation) return;
    const msgIndex = currentConversation.messages.length - 1;
    try {
      setIsContinuing(true);
      const res = await api.continueStage(currentConversationId, msgIndex);
      setCurrentConversation((prev) => {
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (res.stage === 'stage2') {
          lastMsg.stage2 = res.data;
          lastMsg.metadata = res.metadata;
          lastMsg.paused = true;
          lastMsg.pausedStage = 'stage2';
        } else if (res.stage === 'stage3') {
          lastMsg.stage3 = res.data;
          lastMsg.paused = false;
          lastMsg.pausedStage = null;
        }
        return { ...prev, messages };
      });
    } catch (error) {
      console.error('Failed to continue next stage:', error);
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        executionMode={executionMode}
        onEditUserMessage={startEditPrompt}
        onRerunStage1Model={handleRerunStage1Model}
        onRerunStage2Model={handleRerunStage2Model}
        onRerunStage3={handleRerunStage3}
        onSetMode={setExecutionMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        editingPrompt={isEditingPrompt}
        editPromptText={editPromptText}
        onEditChange={setEditPromptText}
        onEditSave={saveEditedPrompt}
        onEditCancel={cancelEditPrompt}
        rerunStage1ModelLoading={rerunStage1ModelLoading}
        rerunStage2ModelLoading={rerunStage2ModelLoading}
        rerunStage3Loading={rerunStage3Loading}
        resetting={isResetting}
        onRefreshConversation={() => currentConversationId && loadConversation(currentConversationId)}
        onContinueNextStage={handleContinueNextStage}
        continuing={isContinuing}
      />
      
    </div>
  );
}

export default App;
