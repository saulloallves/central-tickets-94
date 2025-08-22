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
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageData, setImageData] = useState<HTMLImageElement | null>(null);
  const [isImageReady, setIsImageReady] = useState(false);

  // Tamanho fixo do crop (quadrado)
  const CROP_SIZE = 300;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData || !isImageReady) {
      console.log('Cannot draw canvas:', { canvas: !!canvas, imageData: !!imageData, isImageReady });
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('Cannot get canvas context');
      return;
    }

    console.log('Drawing canvas with:', {
      imageWidth: imageData.naturalWidth,
      imageHeight: imageData.naturalHeight,
      zoom,
      position,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calcular dimensões da imagem com zoom
    const imageWidth = imageData.naturalWidth * zoom;
    const imageHeight = imageData.naturalHeight * zoom;

    console.log('Calculated dimensions:', { imageWidth, imageHeight });

    // Desenhar imagem
    try {
      ctx.drawImage(
        imageData,
        position.x,
        position.y,
        imageWidth,
        imageHeight
      );
      console.log('Image drawn successfully');
    } catch (error) {
      console.error('Error drawing image:', error);
      return;
    }

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
  }, [zoom, position, imageData, isImageReady]);

  const initializeImage = useCallback(() => {
    if (!imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    console.log('Initializing image:', {
      naturalWidth: imageData.naturalWidth,
      naturalHeight: imageData.naturalHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });

    // Calcular zoom inicial para que a imagem cubra pelo menos o crop
    const scaleX = CROP_SIZE / imageData.naturalWidth;
    const scaleY = CROP_SIZE / imageData.naturalHeight;
    const initialZoom = Math.max(scaleX, scaleY, 0.1);

    // Centralizar a imagem
    const scaledWidth = imageData.naturalWidth * initialZoom;
    const scaledHeight = imageData.naturalHeight * initialZoom;
    const initialX = (canvas.width - scaledWidth) / 2;
    const initialY = (canvas.height - scaledHeight) / 2;

    console.log('Setting initial values:', {
      initialZoom,
      initialX,
      initialY,
      scaledWidth,
      scaledHeight
    });

    setZoom(initialZoom);
    setPosition({ x: initialX, y: initialY });
    setIsImageReady(true);
  }, [imageData]);

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
    if (!imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
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
    if (!canvas || !imageData) return;

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
    cropCtx.drawImage(
      imageData,
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
    initializeImage();
  };

  // Carregar imagem quando o dialog abrir
  useEffect(() => {
    if (isOpen && imageFile) {
      console.log('Loading new image file:', imageFile.name);
      
      // Reset states
      setIsImageReady(false);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setImageData(null);

      // Create new image
      const img = new Image();
      img.onload = () => {
        console.log('Image loaded successfully');
        setImageData(img);
      };
      img.onerror = (error) => {
        console.error('Error loading image:', error);
      };
      
      // Load image
      img.src = URL.createObjectURL(imageFile);
    }
  }, [isOpen, imageFile]);

  // Initialize image when imageData is ready
  useEffect(() => {
    if (imageData) {
      initializeImage();
    }
  }, [imageData, initializeImage]);

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

          {!isImageReady && (
            <div className="text-center text-sm text-muted-foreground">
              Carregando imagem...
            </div>
          )}

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
                disabled={!isImageReady}
              />
              <ZoomIn className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Arraste a imagem para reposicionar • Use o slider para dar zoom
            </p>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetPosition} disabled={!isImageReady}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
            
            <div className="space-x-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleCrop} disabled={!isImageReady}>
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