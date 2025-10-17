import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMobileUnitTickets } from '@/hooks/useMobileUnitTickets';
import { MobileTicketCard } from '@/components/mobile/MobileTicketCard';
import { Button } from '@/components/ui/button';

export default function UnitTickets() {
  const navigate = useNavigate();
  const { 
    unidade, 
    ticketsAbertos, 
    ticketsFechados, 
    loading, 
    error,
    codigoGrupo 
  } = useMobileUnitTickets();
  
  const [activeTab, setActiveTab] = useState<'abertos' | 'fechados'>('abertos');
  
  const currentTickets = activeTab === 'abertos' ? ticketsAbertos : ticketsFechados;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando tickets...</p>
        </div>
      </div>
    );
  }

  if (error || !unidade) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar</h3>
          <p className="text-muted-foreground mb-4">{error || 'Unidade não encontrada'}</p>
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header Fixo */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="p-4">
          <h1 className="text-lg font-bold">{unidade.grupo}</h1>
          <p className="text-sm opacity-90">{unidade.cidade}/{unidade.uf} • Código: {codigoGrupo}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b bg-background sticky top-[72px] z-10">
        <button
          onClick={() => setActiveTab('abertos')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'abertos'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Abertos ({ticketsAbertos.length})
        </button>
        <button
          onClick={() => setActiveTab('fechados')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'fechados'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Fechados ({ticketsFechados.length})
        </button>
      </div>

      {/* Lista de Tickets */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentTickets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum ticket {activeTab === 'abertos' ? 'aberto' : 'fechado'}
            </p>
          </div>
        ) : (
          currentTickets.map(ticket => (
            <MobileTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => navigate(`/mobile/tickets/${ticket.id}?codigo_grupo=${codigoGrupo}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
