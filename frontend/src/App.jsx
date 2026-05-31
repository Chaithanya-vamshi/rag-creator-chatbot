import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Video, 
  Layers, 
  Sparkles, 
  BarChart3, 
  User, 
  Users, 
  Clock, 
  Calendar, 
  Eye, 
  ThumbsUp, 
  MessageSquare, 
  Hash, 
  Key, 
  ChevronDown, 
  Check, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';

export default function App() {
  // Dynamic API base path (Localhost vs Vercel Monorepo routing)
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '/_/backend';

  // Video URLs
  const [urlA, setUrlA] = useState('https://www.youtube.com/watch?v=WhyStartupsFail');
  const [urlB, setUrlB] = useState('https://www.instagram.com/reel/FounderMorningRoutine');
  
  // API Keys
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);

  // Chat State
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [citations, setCitations] = useState([]);

  const messagesEndRef = useRef(null);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedOpenai = localStorage.getItem('creator_openai_key') || '';
    const savedGemini = localStorage.getItem('creator_gemini_key') || '';
    setOpenaiKey(savedOpenai);
    setGeminiKey(savedGemini);
  }, []);

  const saveKeys = () => {
    localStorage.setItem('creator_openai_key', openaiKey);
    localStorage.setItem('creator_gemini_key', geminiKey);
    setShowApiKeys(false);
  };

  // Run initial video ingestion analysis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!urlA || !urlB) {
      setError('Please provide URLs for both Video A and Video B.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setVideoA(null);
    setVideoB(null);
    
    // Clear chat history on new ingestion
    setMessages([]);
    setCitations([]);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_a: urlA, url_b: urlB }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed.');
      }

      const data = await response.json();
      setVideoA(data.video_a);
      setVideoB(data.video_b);
      
      // Inject welcome message
      setMessages([
        {
          role: 'assistant',
          content: `### 👋 Welcome to CreatorRAG Coach!

I have successfully ingested both social assets and built a specialized index over their transcripts and performance data:
*   **Video A (YouTube)**: "${data.video_a.title}" by **${data.video_a.creator}**
*   **Video B (Instagram)**: "${data.video_b.title}" by **${data.video_b.creator}**

Click any of the quick suggestion chips below or ask me a question in the chat pane to start our competitive review!`
        }
      ]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server connection failed. Make sure the FastAPI backend is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Chat Query handler
  const handleSendQuery = async (queryText) => {
    const activeQuery = queryText || query;
    if (!activeQuery.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: activeQuery }]);
    setQuery('');
    setIsTyping(true);
    setCitations([]); // Reset current query citations

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          openai_api_key: openaiKey,
          gemini_api_key: geminiKey
        })
      });

      if (!response.ok) {
        throw new Error('Streaming failed. Please retry.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';
      
      // Add a placeholder message for the assistant that we will stream into
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Process SSE lines
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'citations') {
                setCitations(data.citations);
              } else if (data.type === 'token') {
                assistantMsg += data.content;
                // Update the last message in history
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMsg };
                  return updated;
                });
              } else if (data.type === 'error') {
                throw new Error(data.content);
              }
            } catch (jsonErr) {
              // Ignore boundary JSON issues
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `❌ **Error**: ${err.message || 'Failed to complete RAG streaming. Please verify API connections.'}` }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // SVG Radial Progress parameters
  const getRadialStyles = (rate) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    // Scale rate: We assume 25% ER is an absolute premium metric
    const maxVal = 25;
    const progress = Math.min(rate, maxVal);
    const strokeDashoffset = circumference - (circumference * progress) / maxVal;
    
    // Color coding based on score
    let strokeColor = 'var(--accent-pink)';
    if (rate >= 10.0) strokeColor = 'var(--accent-emerald)';
    else if (rate >= 4.0) strokeColor = 'var(--accent-indigo)';
    
    return {
      strokeDasharray: circumference,
      strokeDashoffset,
      strokeColor
    };
  };

  // Simple clean markdown-to-HTML parser function to render beautiful formatting without external dependencies
  const parseMarkdown = (text) => {
    if (!text) return '';
    
    // Escape standard HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    // Tables support
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let parsedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table>';
        }
        
        // Skip separator lines like |---|
        if (line.includes('---') || line.includes(':---')) continue;
        
        const cols = line.split('|').slice(1, -1);
        tableHtml += '<tr>';
        for (const col of cols) {
          const isHeader = i === 0 || (lines[i-1] && !lines[i-1].trim().startsWith('|'));
          const cellContent = col.trim()
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
          tableHtml += isHeader ? `<th>${cellContent}</th>` : `<td>${cellContent}</td>`;
        }
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table>';
          parsedLines.push(tableHtml);
          tableHtml = '';
        }
        parsedLines.push(lines[i]);
      }
    }
    if (inTable) {
      tableHtml += '</table>';
      parsedLines.push(tableHtml);
    }

    html = parsedLines.join('\n');

    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
    
    // Bold / Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Bullet Points
    html = html.replace(/^\*\s(.*)$/gm, '<li>$1</li>');
    html = html.replace(/^\-\s(.*)$/gm, '<li>$1</li>');
    
    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    // Citations highlights
    html = html.replace(/\[(Video [A|B]),\s(\d{2}:\d{2})\]/g, '<span class="citation-badge $1">$1 ($2)</span>');
    
    // New lines to br (unless already wrapped in block elements)
    return html.split('\n').map(l => {
      if (l.startsWith('<h') || l.startsWith('<t') || l.startsWith('<u') || l.startsWith('<l')) return l;
      return `<p>${l}</p>`;
    }).join('');
  };

  const suggestionChips = [
    "What's the engagement rate of each?",
    "Why did Video A get more engagement than Video B?",
    "Compare the hooks in the first 5 seconds.",
    "Who is the creator of Video B and what's their follower count?",
    "Suggest improvements for Video B based on what worked in A."
  ];

  return (
    <div className="app-container">
      {/* 1. HEADER */}
      <header className="app-header glass">
        <div>
          <h1 className="app-title">
            <Bot className="app-logo" size={32} />
            <span className="text-gradient-indigo">CreatorRAG</span>
            <span className="text-gradient-cyan" style={{ marginLeft: '0.4rem', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>v1.0</span>
          </h1>
          <p className="app-subtitle">Full-Stack Social Video Ingestion, Analytics & AI Coach</p>
        </div>
        
        <div className="header-controls">
          <button 
            className={`api-config-trigger ${showApiKeys ? 'active' : ''}`}
            onClick={() => setShowApiKeys(!showApiKeys)}
          >
            <Key size={16} />
            Configure LLM Keys
            <ChevronDown size={14} style={{ transform: showApiKeys ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          
          {showApiKeys && (
            <div className="api-drawer glass">
              <div className="api-input-group">
                <label>OpenAI API Key</label>
                <input 
                  type="password" 
                  placeholder="sk-..." 
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
              <div className="api-input-group">
                <label>Gemini API Key</label>
                <input 
                  type="password" 
                  placeholder="AIzaSy..." 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>
              <button className="btn-primary" style={{ padding: '0.5rem', width: '100%', justifyContent: 'center', fontSize: '0.85rem' }} onClick={saveKeys}>
                <Check size={16} /> Save Credentials
              </button>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Keys are stored locally in your browser. Leave empty to use free mock comparative engine.
              </p>
            </div>
          )}
        </div>
      </header>

      {/* 2. URL INPUT PANEL */}
      <section className="url-panel glass glow-card">
        <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="url-inputs-grid">
            <div className="input-card">
              <div className="input-label-container">
                <span className="input-label">
                  <Video size={18} className="text-gradient-indigo" />
                  Video A URL
                </span>
                <span className="platform-badge youtube">YouTube</span>
              </div>
              <div className="url-input-wrapper">
                <Bot size={16} />
                <input 
                  type="text" 
                  className="url-input" 
                  value={urlA} 
                  onChange={(e) => setUrlA(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={isAnalyzing}
                />
              </div>
            </div>

            <div className="input-card">
              <div className="input-label-container">
                <span className="input-label">
                  <Layers size={18} className="text-gradient-cyan" />
                  Video B URL
                </span>
                <span className="platform-badge instagram">Instagram Reel</span>
              </div>
              <div className="url-input-wrapper">
                <Bot size={16} />
                <input 
                  type="text" 
                  className="url-input" 
                  value={urlB} 
                  onChange={(e) => setUrlB(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  disabled={isAnalyzing}
                />
              </div>
            </div>
          </div>

          <div className="action-row">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <div className="status-dot loading" style={{ marginRight: '0.2rem' }}></div>
                  Extracting Metadata & Indexing Transcripts...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Analyze & Compare Assets
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-pink)', fontSize: '0.85rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* 3. METADATA COMPARISON DASHBOARD */}
      {videoA && videoB ? (
        <section className="dashboard-grid">
          {/* VIDEO A CARD */}
          <div className="video-card glass video-a">
            <div className="card-header-main">
              <div className="creator-info-row">
                <div className="creator-avatar">{videoA.creator.slice(0,2).toUpperCase()}</div>
                <div className="creator-meta">
                  <h3>{videoA.creator}</h3>
                  <p className="creator-followers">
                    <Users size={12} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} />
                    {videoA.follower_count.toLocaleString()} subscribers
                  </p>
                </div>
              </div>
              <span className="video-tag">VIDEO A</span>
            </div>
            
            <h2 className="video-main-title">{videoA.title}</h2>
            {videoA.is_mocked && <span className="mock-badge-alert"><Info size={12} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} /> Scraper limited - Loaded Analytical Template</span>}
            
            <div className="stats-subgrid">
              <div className="stat-widget">
                <div className="stat-icon-wrap"><Eye size={16} /></div>
                <div className="stat-values">
                  <span className="label">Views</span>
                  <span className="val">{videoA.views.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><ThumbsUp size={16} /></div>
                <div className="stat-values">
                  <span className="label">Likes</span>
                  <span className="val">{videoA.likes.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><MessageSquare size={16} /></div>
                <div className="stat-values">
                  <span className="label">Comments</span>
                  <span className="val">{videoA.comments.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><Clock size={16} /></div>
                <div className="stat-values">
                  <span className="label">Duration</span>
                  <span className="val">{videoA.duration}s</span>
                </div>
              </div>
            </div>

            <div className="visual-comparison-box">
              <div className="radial-container">
                <div className="radial-svg-wrap">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                    <circle 
                      cx="36" 
                      cy="36" 
                      r="28" 
                      fill="none" 
                      stroke={getRadialStyles(videoA.engagement_rate).strokeColor} 
                      strokeWidth="6" 
                      strokeDasharray={getRadialStyles(videoA.engagement_rate).strokeDasharray}
                      strokeDashoffset={getRadialStyles(videoA.engagement_rate).strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div className="radial-label-inside" style={{ color: getRadialStyles(videoA.engagement_rate).strokeColor }}>
                    {videoA.engagement_rate}%
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700' }}>Engagement Rate</h4>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>(Likes + Comments) / Views</p>
                </div>
              </div>
              
              {videoA.engagement_rate > videoB.engagement_rate ? (
                <div className="comparison-trend-badge positive">
                  <TrendingUp size={14} />
                  +{round(videoA.engagement_rate - videoB.engagement_rate, 2)}% vs B
                </div>
              ) : (
                <div className="comparison-trend-badge negative">
                  <TrendingDown size={14} />
                  -{round(videoB.engagement_rate - videoA.engagement_rate, 2)}% vs B
                </div>
              )}
            </div>

            <div className="hashtag-row">
              {videoA.hashtags.slice(0, 5).map((tag, i) => (
                <span key={i} className="hashtag-tag"><Hash size={10} style={{ display: 'inline', marginRight: '0.05rem' }} />{tag.replace('#','')}</span>
              ))}
            </div>
          </div>

          {/* VIDEO B CARD */}
          <div className="video-card glass video-b">
            <div className="card-header-main">
              <div className="creator-info-row">
                <div className="creator-avatar">{videoB.creator.slice(0,2).toUpperCase()}</div>
                <div className="creator-meta">
                  <h3>{videoB.creator}</h3>
                  <p className="creator-followers">
                    <Users size={12} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} />
                    {videoB.follower_count.toLocaleString()} followers
                  </p>
                </div>
              </div>
              <span className="video-tag">VIDEO B</span>
            </div>
            
            <h2 className="video-main-title">{videoB.title}</h2>
            {videoB.is_mocked && <span className="mock-badge-alert"><Info size={12} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} /> Scraper limited - Loaded Analytical Template</span>}
            
            <div className="stats-subgrid">
              <div className="stat-widget">
                <div className="stat-icon-wrap"><Eye size={16} /></div>
                <div className="stat-values">
                  <span className="label">Views</span>
                  <span className="val">{videoB.views.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><ThumbsUp size={16} /></div>
                <div className="stat-values">
                  <span className="label">Likes</span>
                  <span className="val">{videoB.likes.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><MessageSquare size={16} /></div>
                <div className="stat-values">
                  <span className="label">Comments</span>
                  <span className="val">{videoB.comments.toLocaleString()}</span>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-icon-wrap"><Clock size={16} /></div>
                <div className="stat-values">
                  <span className="label">Duration</span>
                  <span className="val">{videoB.duration}s</span>
                </div>
              </div>
            </div>

            <div className="visual-comparison-box">
              <div className="radial-container">
                <div className="radial-svg-wrap">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                    <circle 
                      cx="36" 
                      cy="36" 
                      r="28" 
                      fill="none" 
                      stroke={getRadialStyles(videoB.engagement_rate).strokeColor} 
                      strokeWidth="6" 
                      strokeDasharray={getRadialStyles(videoB.engagement_rate).strokeDasharray}
                      strokeDashoffset={getRadialStyles(videoB.engagement_rate).strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div className="radial-label-inside" style={{ color: getRadialStyles(videoB.engagement_rate).strokeColor }}>
                    {videoB.engagement_rate}%
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700' }}>Engagement Rate</h4>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>(Likes + Comments) / Views</p>
                </div>
              </div>
              
              {videoB.engagement_rate > videoA.engagement_rate ? (
                <div className="comparison-trend-badge positive">
                  <TrendingUp size={14} />
                  +{round(videoB.engagement_rate - videoA.engagement_rate, 2)}% vs A
                </div>
              ) : (
                <div className="comparison-trend-badge negative">
                  <TrendingDown size={14} />
                  -{round(videoA.engagement_rate - videoB.engagement_rate, 2)}% vs A
                </div>
              )}
            </div>

            <div className="hashtag-row">
              {videoB.hashtags.slice(0, 5).map((tag, i) => (
                <span key={i} className="hashtag-tag"><Hash size={10} style={{ display: 'inline', marginRight: '0.05rem' }} />{tag.replace('#','')}</span>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className="empty-dashboard-placeholder glass">
          <BarChart3 size={48} />
          <div>
            <h3>Comparative Dashboard</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Submit URLs above to compute cross-platform engagement deltas and unlock the streaming RAG chat environment.</p>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE CHAT PANEL */}
      {videoA && videoB && (
        <section className="main-workspace-container">
          {/* LEFT: CHAT CONTAINER */}
          <div className="chat-panel glass">
            <div className="chat-header">
              <span style={{ fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={18} className="text-gradient-indigo" />
                AI Content Strategist
              </span>
              <div className="chat-status">
                {isTyping ? (
                  <>
                    <div className="status-dot loading"></div>
                    Thinking...
                  </>
                ) : (
                  <>
                    <div className="status-dot"></div>
                    Indexed & Ready
                  </>
                )}
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message-bubble ${msg.role}`}>
                  <span className="message-meta">{msg.role === 'user' ? 'Creator' : 'Strategist Coach'}</span>
                  <div 
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                  />
                </div>
              ))}
              {isTyping && (
                <div className="message-bubble assistant" style={{ padding: '0.75rem 1.25rem' }}>
                  <span className="message-meta">Thinking</span>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', alignItems: 'center' }}>
                    <div className="status-dot loading" style={{ width: '6px', height: '6px', animationDelay: '0s' }}></div>
                    <div className="status-dot loading" style={{ width: '6px', height: '6px', animationDelay: '0.2s' }}></div>
                    <div className="status-dot loading" style={{ width: '6px', height: '6px', animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* QUICK SUGGESTION CHIPS */}
            <div className="suggestions-wrapper">
              <h4 className="suggestions-title">Quick Analytical Queries</h4>
              <div className="chips-container">
                {suggestionChips.map((chip, idx) => (
                  <button 
                    key={idx} 
                    className="chip-btn"
                    onClick={() => handleSendQuery(chip)}
                    disabled={isTyping}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* CHAT INPUT BAR */}
            <div className="chat-input-bar">
              <input 
                type="text" 
                className="chat-input-field" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
                placeholder="Ask about hook comparisons, CTAs, and performance recommendations..."
                disabled={isTyping}
              />
              <button 
                className="btn-icon"
                onClick={() => handleSendQuery()}
                disabled={isTyping || !query.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* RIGHT: CITATION PANEL */}
          <div className="citations-panel glass">
            <div className="citations-header">
              <Layers size={18} className="text-gradient-cyan" />
              RAG Source Citations
            </div>
            
            <div className="citations-list">
              {citations.length > 0 ? (
                citations.map((c, i) => (
                  <div key={i} className="citation-card glow-card">
                    <div className="citation-card-header">
                      <span className={`citation-badge ${c.video_id === 'Video A' ? 'a' : 'b'}`}>
                        {c.video_id}
                      </span>
                      <span className="citation-time">
                        <Clock size={10} style={{ display: 'inline', marginRight: '0.2rem' }} />
                        {c.formatted_time}
                      </span>
                    </div>
                    <p className="citation-text">"{c.text}"</p>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Source: {c.video_title}
                    </span>
                  </div>
                ))
              ) : (
                <div className="citations-empty-state">
                  <Bot size={36} />
                  <div>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>No Citations Loaded</h5>
                    <p style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>When the AI coach responds, the specific transcript source chunks indexed in ChromaDB will appear here in real-time.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// Float helper utility
function round(value, decimals) {
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}
