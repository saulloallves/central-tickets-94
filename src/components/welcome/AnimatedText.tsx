import React from 'react';

interface AnimatedTextProps {
  text: string;
  startDelay?: number;
  wordDelay?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  startDelay = 0,
  wordDelay = 80,
  className = '',
  as: Component = 'span',
}) => {
  const words = text.split(' ');

  return (
    <Component className={className}>
      {words.map((word, index) => {
        const delay = startDelay + (index * wordDelay);
        return (
          <span
            key={`${word}-${index}`}
            className="word-animate"
            style={{
              animation: `word-appear 0.5s ease-out forwards`,
              animationDelay: `${delay}ms`,
            }}
          >
            {word}
          </span>
        );
      })}
    </Component>
  );
};
