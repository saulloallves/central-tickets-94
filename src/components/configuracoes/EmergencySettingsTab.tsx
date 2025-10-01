import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { useEmergencySettings, EmergencyNumber } from "@/hooks/useEmergencySettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function EmergencySettingsTab() {
  const { emergencyNumbers, isLoading, addNumber, removeNumber, isUpdating } = useEmergencySettings();
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  const validatePhone = (phone: string): boolean => {
    // Remove tudo que não é número
    const cleaned = phone.replace(/\D/g, '');
    
    // Deve ter 11 dígitos (DDD + 9 dígitos) ou 13 (55 + DDD + 9 dígitos)
    return cleaned.length === 11 || cleaned.length === 13;
  };

  const formatPhone = (phone: string): string => {
    // Remove tudo que não é número
    let cleaned = phone.replace(/\D/g, '');
    
    // Adiciona 55 se tiver apenas 11 dígitos
    if (cleaned.length === 11) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  };

  const handleAddNumber = () => {
    if (!newName.trim()) {
      alert('Por favor, insira um nome para o contato.');
      return;
    }

    if (!validatePhone(newPhone)) {
      alert('Por favor, insira um telefone válido (11 dígitos com DDD ou 13 com código do país).');
      return;
    }

    const formattedPhone = formatPhone(newPhone);
    
    addNumber({
      name: newName.trim(),
      phone: formattedPhone
    });

    setNewName("");
    setNewPhone("");
  };

  const handleRemoveClick = (index: number) => {
    setRemoveIndex(index);
  };

  const confirmRemove = () => {
    if (removeIndex !== null) {
      removeNumber(removeIndex);
      setRemoveIndex(null);
    }
  };

  const generateMessagePreview = () => {
    const mentions = emergencyNumbers.map(num => `@${num.phone}`).join(' ');
    const mentionedList = emergencyNumbers.map(num => num.phone);
    
    return {
      message: `🚨 *PROTOCOLO EMERGÊNCIA* 🚨\n\nAdicionamos ${mentions} @{{concierge_phone}} para auxiliar sua unidade\n\n*De maneira direta, nos informe o ocorrido para que possamos auxiliar com mais rapidez.*`,
      mentioned: [...mentionedList, '{{concierge_phone}}']
    };
  };

  if (isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  const preview = generateMessagePreview();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Números de Emergência Fora do Horário</CardTitle>
          <CardDescription>
            Configure os números que serão adicionados aos grupos quando uma emergência for acionada fora do horário comercial.
            O concierge da unidade sempre será adicionado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estes números serão adicionados ao grupo WhatsApp automaticamente quando uma emergência for acionada fora do horário de atendimento.
            </AlertDescription>
          </Alert>

          {/* Lista de números existentes */}
          <div className="space-y-2">
            <Label>Números Cadastrados ({emergencyNumbers.length}/10)</Label>
            {emergencyNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum número cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {emergencyNumbers.map((number: EmergencyNumber, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{number.name}</p>
                      <p className="text-sm text-muted-foreground">{number.phone}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveClick(index)}
                      disabled={isUpdating}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar novo número */}
          {emergencyNumbers.length < 10 && (
            <div className="space-y-4 pt-4 border-t">
              <Label>Adicionar Novo Número</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Contato</Label>
                  <Input
                    id="name"
                    placeholder="Ex: João Silva"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (com DDD)</Label>
                  <Input
                    id="phone"
                    placeholder="Ex: 11999887766 ou 5511999887766"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddNumber}
                disabled={isUpdating || !newName.trim() || !newPhone.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Número
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview da mensagem */}
      <Card>
        <CardHeader>
          <CardTitle>Preview da Mensagem</CardTitle>
          <CardDescription>
            Esta é a mensagem que será enviada quando uma emergência for acionada fora do horário
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <pre className="text-sm whitespace-pre-wrap font-mono">{preview.message}</pre>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Mencionados: {preview.mentioned.length} pessoas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de confirmação de remoção */}
      <AlertDialog open={removeIndex !== null} onOpenChange={() => setRemoveIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este número de emergência? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
