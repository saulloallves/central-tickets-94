import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Unidade {
  id: string;
  grupo: string;
}

interface UnidadeComboboxProps {
  unidades: Unidade[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export const UnidadeCombobox = ({ 
  unidades, 
  value, 
  onValueChange, 
  placeholder = "Selecione uma unidade..." 
}: UnidadeComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const selectedUnidade = unidades.find((unidade) => 
    unidade && unidade.id === value
  );

  const filteredUnidades = useMemo(() => {
    if (!searchValue) return unidades.filter(u => u && u.grupo);
    return unidades.filter((unidade) =>
      unidade && 
      unidade.grupo && 
      typeof unidade.grupo === 'string' &&
      unidade.grupo.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [unidades, searchValue]);

  const handleSelect = (unidadeId: string) => {
    onValueChange(unidadeId === value ? "" : unidadeId);
    setOpen(false);
    setSearchValue('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedUnidade?.grupo ? selectedUnidade.grupo : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-background border" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Digite para filtrar unidades..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="border-0 p-0 h-11 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredUnidades.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma unidade encontrada.
            </div>
          ) : (
            <div className="p-1">
              {filteredUnidades.map((unidade) => {
                if (!unidade || !unidade.id || !unidade.grupo) return null;
                
                return (
                  <div
                    key={unidade.id}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === unidade.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelect(unidade.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === unidade.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {unidade.grupo}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};