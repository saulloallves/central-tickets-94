import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const DeadlineAlert = () => {
  const [showAlert, setShowAlert] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Mostrar alerta apenas entre 17h e 18h
      if (currentHour === 17 || (currentHour === 18 && currentMinute === 0)) {
        setShowAlert(true);
        
        // Calcular tempo restante até 18h
        const deadline = new Date(now);
        deadline.setHours(18, 0, 0, 0);
        const diff = deadline.getTime() - now.getTime();
        const minutesLeft = Math.floor(diff / 60000);
        
        if (minutesLeft > 0) {
          setTimeRemaining(`${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}`);
        } else {
          setTimeRemaining('0 minutos');
        }
      } else {
        setShowAlert(false);
      }
    };

    // Verificar imediatamente
    checkTime();

    // Verificar a cada minuto
    const interval = setInterval(checkTime, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!showAlert) return null;

  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 animate-in slide-in-from-top-2 duration-500 p-4 md:p-5">
      <AlertTriangle className="h-6 w-6 md:h-7 md:w-7 text-amber-600 dark:text-amber-500" />
      <AlertDescription className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 ml-2">
        <div className="flex items-center gap-3 flex-1">
          <Clock className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-500" />
          <span className="text-base md:text-lg font-bold text-amber-900 dark:text-amber-100">
            ⚠️ ATENÇÃO: Todos os tickets precisam ser resolvidos até as 18h!
          </span>
        </div>
        <div className="text-base md:text-lg text-amber-700 dark:text-amber-300 font-bold whitespace-nowrap ml-8 md:ml-0">
          Tempo restante: {timeRemaining}
        </div>
      </AlertDescription>
    </Alert>
  );
};
