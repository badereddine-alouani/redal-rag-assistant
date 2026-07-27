interface ChatOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
}

const ChatOptions = ({ options, onSelect }: ChatOptionsProps) => {
  return (
    <div className="options-container">
      {options.map((option) => (
        <button key={option} className="btn-option" onClick={() => onSelect(option)}>
          {option}
        </button>
      ))}
    </div>
  );
};

export default ChatOptions;
