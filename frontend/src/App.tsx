import { useState, useRef, useEffect } from 'react';
import './index.css';
import { type Step, type Message, CATEGORIES } from './types';
import ChatMessage from './components/ChatMessage';
import ChatOptions from './components/ChatOptions';
import EscalationForm from './components/EscalationForm';
import chatIcon from './assets/redalo.jpg';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [isOpen, setIsOpen] = useState(false);

  // Escalation state
  const [phone, setPhone] = useState('');
  const [cil, setCil] = useState('');
  const [escalationError, setEscalationError] = useState('');
  const [claimId, setClaimId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      addBotMessage("💬 Bonjour et bienvenue sur le service d'assistance en ligne de Redal !\nJe suis votre assistant virtuel, là pour vous aider 24h/24. Que puis-je faire pour vous aujourd'hui ? 💡\n👉 Je vous invite à choisir une option parmi le menu ci-dessous.");
    }
  }, []);

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    addUserMessage(cat);
    setStep('subcategory');
    addBotMessage(`Veuillez choisir une sous-catégorie pour ${cat}:`);
  };

  const handleSubcategorySelect = (sub: string) => {
    setSubcategory(sub);
    addUserMessage(sub);
    setStep('interaction');
    addBotMessage(`Vous avez sélectionné: ${sub}. Veuillez formuler votre question librement ci-dessous.`);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userQ = inputText.trim();
    setInputText('');
    addUserMessage(userQ);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          session_id: sessionId,
          category,
          subcategory,
          user_question: userQ
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');



      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let botMsgId = '';
      let isFallback = false;
      let done = false;
      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (!botMsgId && value) {
          botMsgId = Date.now().toString();
          setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '', isStreaming: true }]);
          setIsLoading(false); // Hide typing indicator only when text starts arriving
        }

        const chunkValue = decoder.decode(value);

        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data = line.slice(6);
            if (data === '[DONE]') {
              done = true;
              setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
              break;
            }
            if (data === '[FALLBACK]') {
              done = true;
              isFallback = true;
              setMessages(prev => prev.filter(m => m.id !== botMsgId));
              triggerEscalation();
              break;
            }
            data = data.replace(/\\n/g, '\n');
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: m.text + data } : m));
          }
        }
      }

      if (!isFallback) {
        setTimeout(() => {
          addBotMessage("Avez-vous une autre question ?");
        }, 1001);
      }

    } catch (error) {
      console.error(error);
      addBotMessage("Une erreur est survenue lors de la communication avec le serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerEscalation = () => {
    setStep('escalation');
    addBotMessage("🔄 Merci pour votre demande. Celle-ci nécessite un traitement spécifique par nos équipes.\nAfin de poursuivre efficacement, merci de nous transmettre vos coordonnées:");
  };

  const submitEscalation = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^(06|07)\d{8}$/.test(cleanPhone)) {
      setEscalationError("❌ Numéro de téléphone invalide. Veuillez saisir un numéro commençant par 06 ou 07, au format national.");
      return;
    }
    setEscalationError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: cleanPhone, cil, session_id: sessionId })
      });

      const data = await response.json();
      if (response.ok) {
        setClaimId(data.claim_id);
        addBotMessage(`📄 Voici votre numéro de réclamation : ${data.claim_id}\n📌 Conservez ce numéro pour le suivi de votre demande.\nNous vous recontacterons dans les plus brefs délais. Merci pour votre compréhension. 🙏`);
        setTimeout(() => {
          addBotMessage("Avez-vous une autre question ?");
        }, 1200);
      } else {
        setEscalationError(data.detail || "Une erreur est survenue.");
      }
    } catch (e) {
      setEscalationError("Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEscalation = () => {
    setStep('interaction');
    setEscalationError('');
    addBotMessage("Comment puis-je vous aider autrement ?");
  };

  const handleRestart = (yes: boolean) => {
    if (yes) {
      setStep('menu');
      setCategory('');
      setSubcategory('');
      setClaimId('');
      setPhone('');
      setCil('');
      addBotMessage("👉 Je vous invite à choisir une option parmi le menu ci-dessous.");
    } else {
      addBotMessage("Merci d'avoir utilisé notre assistant virtuel. Nous espérons avoir répondu à votre demande !\nSi vous avez d'autres questions, n'hésitez pas à revenir à tout moment.\nL'équipe Redal reste à votre écoute. Excellente journée à vous ! 🌟");
      setStep('closed');
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className="widget-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
          style={{ padding: 0 }}
        >
          <img src={chatIcon} alt="Chat" className="widget-launcher-img" />
        </button>
      )}

      <div className={`App widget-window ${isOpen ? 'open' : 'closed'}`}>
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', flex: 1 }}>
            <img src={chatIcon} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            <h1 style={{ margin: 0 }}>Redal Assistant</h1>
          </div>
          <button
            className="widget-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className="chat-container">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {isLoading && step !== 'escalation' && (
            <div className="message bot typing-indicator">
              <span></span><span></span><span></span>
            </div>
          )}

          {step === 'menu' && !isLoading && (
            <ChatOptions options={Object.keys(CATEGORIES)} onSelect={handleCategorySelect} />
          )}

          {step === 'subcategory' && !isLoading && (
            <ChatOptions options={CATEGORIES[category as keyof typeof CATEGORIES]} onSelect={handleSubcategorySelect} />
          )}

          {step === 'escalation' && !claimId && (
            <EscalationForm
              phone={phone}
              setPhone={setPhone}
              cil={cil}
              setCil={setCil}
              escalationError={escalationError}
              isLoading={isLoading}
              onSubmit={submitEscalation}
              onCancel={handleCancelEscalation}
            />
          )}

          {messages.length > 0 && messages[messages.length - 1].text === "Avez-vous une autre question ?" && !isLoading && (
            <div className="options-container">
              <button className="btn-option" onClick={() => handleRestart(true)}>✅ Oui</button>
              <button className="btn-option" onClick={() => handleRestart(false)}>❌ Non</button>
            </div>
          )}

          {step === 'closed' && (
            <div className="options-container">
              <button className="btn-option" onClick={() => handleRestart(true)}>
                🔄 Nouvelle Conversation
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {(step === 'interaction' || step === 'escalation') && (
          <div className="input-area">
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="Ask anything..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isLoading || step === 'escalation'}
              />
              <button onClick={handleSendMessage} disabled={isLoading || !inputText.trim() || step === 'escalation'} aria-label="Envoyer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
