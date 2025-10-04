import React from 'react';

export const FloatingOrbs: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Orb 1 */}
      <div 
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-20 animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(201 65% 75%) 0%, transparent 70%)',
          top: '10%',
          left: '10%',
          animation: 'float 20s ease-in-out infinite',
        }}
      />
      
      {/* Orb 2 */}
      <div 
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-15 animate-float-delayed"
        style={{
          background: 'radial-gradient(circle, hsl(201 60% 66%) 0%, transparent 70%)',
          bottom: '20%',
          right: '15%',
          animation: 'float-delayed 25s ease-in-out infinite',
        }}
      />
      
      {/* Orb 3 */}
      <div 
        className="absolute w-64 h-64 rounded-full blur-3xl opacity-10"
        style={{
          background: 'radial-gradient(circle, hsl(201 70% 80%) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse 15s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 30px) scale(1.05); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-40px, 30px) scale(0.95); }
          50% { transform: translate(30px, -20px) scale(1.1); }
          75% { transform: translate(-30px, -30px) scale(1); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.2; transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
};
