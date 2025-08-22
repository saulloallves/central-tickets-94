import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, ZoomIn, ZoomOut, Check, X } from "lucide-react";

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  onCrop: (croppedBlob: Blob) => void;
  imageFile: File;
}

export function ImageCropper({ isOpen, onClose, onCrop, imageFile }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Tamanho fixo do crop (quadrado)
  const CROP_SIZE = 300;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calcular dimensões da imagem com zoom
    const imageWidth = image.naturalWidth * zoom;
    const imageHeight = image.naturalHeight * zoom;

    // Desenhar imagem
    ctx.drawImage(
      image,
      position.x,
      position.y,
      imageWidth,
      imageHeight
    );

    // Desenhar overlay escuro
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Limpar área do crop (criar "buraco" transparente)
    ctx.globalCompositeOperation = 'destination-out';
    const cropX = (canvas.width - CROP_SIZE) / 2;
    const cropY = (canvas.height - CROP_SIZE) / 2;
    ctx.fillRect(cropX, cropY, CROP_SIZE, CROP_SIZE);

    // Voltar ao modo normal
    ctx.globalCompositeOperation = 'source-over';

    // Desenhar borda do crop
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, CROP_SIZE, CROP_SIZE);
  }, [zoom, position, imageLoaded]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    // Calcular posição inicial para centralizar a imagem
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const canvasAspect = canvas.width / canvas.height;

    let initialZoom = 1;
    let initialX = 0;
    let initialY = 0;

    // Calcular zoom inicial para que a imagem cubra pelo menos o crop
    if (imageAspect > canvasAspect) {
      initialZoom = CROP_SIZE / image.naturalHeight;
    } else {
      initialZoom = CROP_SIZE / image.naturalWidth;
    }

    // Centralizar a imagem
    initialX = (canvas.width - image.naturalWidth * initialZoom) / 2;
    initialY = (canvas.height - image.naturalHeight * initialZoom) / 2;

    setZoom(initialZoom);
    setPosition({ x: initialX, y: initialY });
    setImageLoaded(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (value: number[]) => {
    const newZoom = value[0];
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    // Ajustar posição para manter o centro
    const zoomRatio = newZoom / zoom;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    setPosition(prev => ({
      x: centerX - (centerX - prev.x) * zoomRatio,
      y: centerY - (centerY - prev.y) * zoomRatio
    }));

    setZoom(newZoom);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    // Criar canvas para o crop final
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = CROP_SIZE;
    cropCanvas.height = CROP_SIZE;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    // Calcular área de crop na imagem original
    const cropX = (canvas.width - CROP_SIZE) / 2;
    const cropY = (canvas.height - CROP_SIZE) / 2;

    // Desenhar apenas a área cortada
    const imageWidth = image.naturalWidth * zoom;
    const imageHeight = image.naturalHeight * zoom;

    cropCtx.drawImage(
      image,
      // Área de origem na imagem
      (cropX - position.x) / zoom,
      (cropY - position.y) / zoom,
      CROP_SIZE / zoom,
      CROP_SIZE / zoom,
      // Destino no canvas de crop
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    // Converter para blob
    cropCanvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob);
        onClose();
      }
    }, 'image/jpeg', 0.9);
  };

  const resetPosition = () => {
    handleImageLoad();
  };

  // Carregar imagem quando o dialog abrir
  useEffect(() => {
    if (isOpen && imageFile) {
      const img = imageRef.current;
      if (img) {
        img.src = URL.createObjectURL(imageFile);
      }
    }
  }, [isOpen, imageFile]);

  // Redesenhar canvas quando houver mudanças
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar Foto do Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Canvas de crop */}
          <div className="relative flex justify-center">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="border border-gray-200 cursor-move select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Imagem invisível para carregar */}
          <img
            ref={imageRef}
            onLoad={handleImageLoad}
            className="hidden"
            alt="Preview"
          />

          {/* Controles de zoom */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <ZoomOut className="h-4 w-4" />
              <Slider
                value={[zoom]}
                onValueChange={handleZoomChange}
                min={0.1}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Arraste a imagem para reposicionar • Use o slider para dar zoom
            </p>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetPosition}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
            
            <div className="space-x-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleCrop}>
                <Check className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}