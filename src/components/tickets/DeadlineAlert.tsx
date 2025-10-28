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
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 animate-in slide-in-from-top-2 duration-500">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
      <AlertDescription className="flex items-center justify-between gap-4 ml-2">
        <div className="flex items-center gap-2 flex-1">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <span className="font-semibold text-amber-900 dark:text-amber-100">
            ⚠️ ATENÇÃO: Todos os tickets precisam ser resolvidos até as 18h!
          </span>
        </div>
        <div className="text-sm text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap">
          Tempo restante: {timeRemaining}
        </div>
      </AlertDescription>
    </Alert>
  );
};
