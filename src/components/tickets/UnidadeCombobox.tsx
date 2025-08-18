import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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

  const selectedUnidade = unidades.find((unidade) => unidade.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedUnidade ? selectedUnidade.grupo : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para filtrar unidades..." />
          <CommandList>
            <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
            <CommandGroup>
              {unidades.map((unidade) => (
                <CommandItem
                  key={unidade.id}
                  value={unidade.grupo}
                  onSelect={() => {
                    onValueChange(unidade.id === value ? "" : unidade.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === unidade.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {unidade.grupo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};