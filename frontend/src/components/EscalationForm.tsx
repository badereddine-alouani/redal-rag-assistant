interface EscalationFormProps {
  phone: string;
  setPhone: (val: string) => void;
  cil: string;
  setCil: (val: string) => void;
  escalationError: string;
  isLoading: boolean;
  onSubmit: () => void;
}

const EscalationForm = ({ phone, setPhone, cil, setCil, escalationError, isLoading, onSubmit }: EscalationFormProps) => {
  return (
    <div className="escalation-form">
      <input type="text" placeholder="📱 Numéro de téléphone (ex: 06...)" value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading} />
      <input type="text" placeholder="🧾 Numéro de CIL" value={cil} onChange={e => setCil(e.target.value)} disabled={isLoading} />
      {escalationError && <div style={{color: 'var(--error)', fontSize: '13px'}}>{escalationError}</div>}
      <button onClick={onSubmit} disabled={isLoading || !phone || !cil}>
        {isLoading ? 'Envoi...' : 'Envoyer'}
      </button>
    </div>
  );
};

export default EscalationForm;
