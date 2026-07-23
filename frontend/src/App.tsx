import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';

type Step = 'menu' | 'subcategory' | 'interaction' | 'escalation';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  isStreaming?: boolean;
}

const CATEGORIES = {
  Commerciale: [
    "Branchement", "Abonnement", "Résiliation", "Tarification", 
    "Solutions de paiement", "Services digitaux", "Service SMS", 
    "Demande d'attestations", "Réseau Commercial"
  ],
  Technique: [
    "Branchement", "Assainissement", "Eau", "Électricité", "Coupure des fournitures"
  ]
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  
  // Escalation state
  const [phone, setPhone] = useState('');
  const [cil, setCil] = useState('');
  const [escalationError, setEscalationError] = useState('');
  const [claimId, setClaimId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Initial message
      addBotMessage("💬 Bonjour et bienvenue sur le service d’assistance en ligne de Redal !\nJe suis votre assistant virtuel, là pour vous aider 24h/24. Que puis-je faire pour vous aujourd’hui ? 💡\n👉 Je vous invite à choisir une option parmi le menu ci-dessous.");
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
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          category,
          subcategory,
          user_question: userQ
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.fallback) {
          triggerEscalation();
          setIsLoading(false);
          return;
        }
      }

      // Handle SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      const botMsgId = Date.now().toString();
      setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '', isStreaming: true }]);

      let done = false;
      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
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
            data = data.replace(/\\n/g, '\n');
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: m.text + data } : m));
          }
        }
      }
      
      // Ask if they have another question
      setTimeout(() => {
        addBotMessage("Avez-vous une autre question ?");
      }, 1000);
      
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
      const response = await fetch('http://localhost:8000/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: cleanPhone, cil })
      });
      
      const data = await response.json();
      if (response.ok) {
        setClaimId(data.claim_id);
        addBotMessage(`📄 Voici votre numéro de réclamation : ${data.claim_id}\n📌 Conservez ce numéro pour le suivi de votre demande.\nNous vous recontacterons dans les plus brefs délais. Merci pour votre compréhension. 🙏`);
      } else {
        setEscalationError(data.detail || "Une erreur est survenue.");
      }
    } catch (e) {
      setEscalationError("Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
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
      addBotMessage("Merci d’avoir utilisé notre assistant virtuel. Nous espérons avoir répondu à votre demande !\nSi vous avez d’autres questions, n’hésitez pas à revenir à tout moment.\nL’équipe Redal reste à votre écoute. Excellente journée à vous ! 🌟");
      setStep('menu'); // reset internally but keep UI dead or just let them read
    }
  };

  return (
    <div className="App">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <h1>Redal Assistant</h1>
          <p>Toujours à votre écoute, 24h/24</p>
        </div>
        <button 
          onClick={() => setIsDark(!isDark)}
          style={{
            background: 'transparent', border: '1px solid var(--border)', 
            color: 'var(--text-main)', padding: '6px 12px', 
            borderRadius: '20px', cursor: 'pointer', fontSize: '12px'
          }}
        >
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>
      
      <div className="chat-container">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.sender}`}>
            {m.isStreaming ? (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                {m.text}
              </pre>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.text}
              </ReactMarkdown>
            )}
          </div>
        ))}
        {isLoading && step !== 'escalation' && (
          <div className="message bot typing-indicator">
            <span></span><span></span><span></span>
          </div>
        )}

        {step === 'menu' && !isLoading && (
          <div className="options-container">
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} className="btn-option" onClick={() => handleCategorySelect(cat)}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {step === 'subcategory' && !isLoading && (
          <div className="options-container">
            {CATEGORIES[category as keyof typeof CATEGORIES].map(sub => (
              <button key={sub} className="btn-option" onClick={() => handleSubcategorySelect(sub)}>
                {sub}
              </button>
            ))}
          </div>
        )}

        {step === 'escalation' && !claimId && (
          <div className="escalation-form">
            <input type="text" placeholder="📱 Numéro de téléphone (ex: 06...)" value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading} />
            <input type="text" placeholder="🧾 Numéro de CIL" value={cil} onChange={e => setCil(e.target.value)} disabled={isLoading} />
            {escalationError && <div style={{color: 'var(--error)', fontSize: '13px'}}>{escalationError}</div>}
            <button onClick={submitEscalation} disabled={isLoading || !phone || !cil}>
              {isLoading ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        )}

        {messages.length > 0 && messages[messages.length-1].text === "Avez-vous une autre question ?" && !isLoading && (
           <div className="options-container">
             <button className="btn-option" onClick={() => handleRestart(true)}>✅ Oui</button>
             <button className="btn-option" onClick={() => handleRestart(false)}>❌ Non</button>
           </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {(step === 'interaction' || step === 'escalation') && (
        <div className="input-area">
          <input 
            type="text" 
            placeholder="Écrivez votre message..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading || step === 'escalation'}
          />
          <button onClick={handleSendMessage} disabled={isLoading || !inputText.trim() || step === 'escalation'}>
            Envoyer
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
