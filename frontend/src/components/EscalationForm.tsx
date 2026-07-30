interface EscalationFormProps {
  phone: string;
  setPhone: (val: string) => void;
  cil: string;
  setCil: (val: string) => void;
  escalationError: string;
  isLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

const EscalationForm = ({ phone, setPhone, cil, setCil, escalationError, isLoading, onSubmit, onCancel }: EscalationFormProps) => {
  return (
    <div className="escalation-form">
      <input type="text" placeholder="📱 Numéro de téléphone (ex: 06...)" value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading} />
      <input type="text" placeholder="🧾 Numéro de CIL" value={cil} onChange={e => setCil(e.target.value)} disabled={isLoading} />
      {escalationError && <div style={{color: 'var(--error)', fontSize: '13px'}}>{escalationError}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button onClick={onCancel} disabled={isLoading} style={{ backgroundColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Annuler
        </button>
        <button onClick={onSubmit} disabled={isLoading || !phone || !cil} style={{ flex: 1 }}>
          {isLoading ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
};

export default EscalationForm;
