interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

const ThemeToggle = ({ isDark, onToggle }: ThemeToggleProps) => {
  return (
    <button 
      onClick={onToggle}
      style={{
        background: 'transparent', border: '1px solid var(--border)', 
        color: 'var(--text-main)', padding: '6px 12px', 
        borderRadius: '20px', cursor: 'pointer', fontSize: '12px'
      }}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
};

export default ThemeToggle;
