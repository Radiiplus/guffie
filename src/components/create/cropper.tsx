/**
* Image Cropper Component
* Fully functional multi-image cropper with drag, resize, zoom, and rotate.
*/
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORTED_ASPECT_RATIOS = [
  { label: "1:1", ratio: 1, icon: "square" },
  { label: "4:5", ratio: 0.8, icon: "rectangle-vertical" },
  { label: "3:4", ratio: 0.75, icon: "rectangle-vertical" },
  { label: "2:3", ratio: 0.66, icon: "rectangle-vertical" },
  { label: "4:3", ratio: 1.33, icon: "rectangle-horizontal" },
  { label: "3:2", ratio: 1.5, icon: "rectangle-horizontal" },
  { label: "16:9", ratio: 1.77, icon: "rectangle-horizontal" },
];

interface ImageData {
  dataUrl: string;
  fileName: string;
  sourceId?: string;
}

interface CroppedImage {
  dataUrl: string;
  fileName: string;
  sourceId?: string;
}

interface ImageCropperProps {
  images: ImageData[];
  onConfirm: (cropped: CroppedImage[], lockedRatioUsed: number) => void;
  onCancel: () => void;
  initialLockedRatio?: number | null;
  onAddMore?: (files: FileList) => void;
}

export function ImageCropper({
  images,
  onConfirm,
  onCancel,
  initialLockedRatio,
  onAddMore,
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // UI State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [aspectRatioIndex, setAspectRatioIndex] = useState(4); // Default 4:3
  const [lockedRatio, setLockedRatio] = useState<number | null>(initialLockedRatio ?? null);
  const [croppedResults, setCroppedResults] = useState<{ dataUrl: string; fileName: string; sourceId?: string; index: number }[]>([]);

  // Canvas Interaction State Refs (to avoid re-renders during drag)
  const stateRef = useRef({
    image: new Image(),
    imageX: 0, imageY: 0, imageWidth: 0, imageHeight: 0, rotation: 0, scale: 1,
    cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0,
    isDragging: false, dragStartX: 0, dragStartY: 0, dragCropStartX: 0, dragCropStartY: 0,
    isPanning: false, panStartX: 0, panStartY: 0, panImageStartX: 0, panImageStartY: 0,
    isResizing: false, resizeHandle: "", resizeStartX: 0, resizeStartY: 0,
    resizeCropStartX: 0, resizeCropStartY: 0, resizeCropStartW: 0, resizeCropStartH: 0,
    containerWidth: 0, containerHeight: 0,
  });

  const currentRatio = lockedRatio !== null ? lockedRatio : SUPPORTED_ASPECT_RATIOS[aspectRatioIndex].ratio;
  const canChangeAspectRatio = lockedRatio === null && (images.length === 1 || currentImageIndex === 0);

  function getMaxCropForRatio(imageWidth: number, imageHeight: number, ratio: number) {
    const imageRatio = imageWidth / imageHeight;
    if (imageRatio < ratio) {
      const cropWidth = imageWidth;
      return { cropWidth, cropHeight: cropWidth / ratio };
    }

    const cropHeight = imageHeight;
    return { cropWidth: cropHeight * ratio, cropHeight };
  }

  function clampImageToCrop(state = stateRef.current) {
    const cropCenterX = state.cropX + state.cropWidth / 2;
    const cropCenterY = state.cropY + state.cropHeight / 2;

    let imageCenterX = state.imageX + state.imageWidth / 2;
    let imageCenterY = state.imageY + state.imageHeight / 2;

    const scaledWidth = state.imageWidth * state.scale;
    const scaledHeight = state.imageHeight * state.scale;

    if (scaledWidth <= state.cropWidth) {
      imageCenterX = cropCenterX;
    } else {
      const minCenterX = state.cropX + state.cropWidth - scaledWidth / 2;
      const maxCenterX = state.cropX + scaledWidth / 2;
      imageCenterX = Math.min(Math.max(imageCenterX, minCenterX), maxCenterX);
    }

    if (scaledHeight <= state.cropHeight) {
      imageCenterY = cropCenterY;
    } else {
      const minCenterY = state.cropY + state.cropHeight - scaledHeight / 2;
      const maxCenterY = state.cropY + scaledHeight / 2;
      imageCenterY = Math.min(Math.max(imageCenterY, minCenterY), maxCenterY);
    }

    state.imageX = imageCenterX - state.imageWidth / 2;
    state.imageY = imageCenterY - state.imageHeight / 2;
  }

  function clampCropToImage(state = stateRef.current) {
    const imageLeft = state.imageX;
    const imageTop = state.imageY;
    const imageRight = state.imageX + state.imageWidth;
    const imageBottom = state.imageY + state.imageHeight;

    // Locked ratio should cap only the maximum crop size.
    // Users can still resize smaller; output is later expanded to the final locked ratio frame.
    const { cropWidth: maxCropWidth, cropHeight: maxCropHeight } = getMaxCropForRatio(
      state.imageWidth,
      state.imageHeight,
      currentRatio
    );

    if (state.cropWidth > maxCropWidth) {
      state.cropWidth = maxCropWidth;
      state.cropHeight = state.cropWidth / currentRatio;
    }

    if (state.cropHeight > maxCropHeight) {
      state.cropHeight = maxCropHeight;
      state.cropWidth = state.cropHeight * currentRatio;
    }

    const minX = imageLeft;
    const maxX = imageRight - state.cropWidth;
    const minY = imageTop;
    const maxY = imageBottom - state.cropHeight;

    state.cropX = Math.min(Math.max(state.cropX, minX), maxX);
    state.cropY = Math.min(Math.max(state.cropY, minY), maxY);
  }

  // Initialize Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      stateRef.current.image = img;
      resetCropBox(img);
    };
    img.src = images[currentImageIndex].dataUrl;
    
    // Reset zoom/scale on image change
    stateRef.current.scale = 1;
    stateRef.current.rotation = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageIndex, images]);

  // Helper: Reset Crop Box based on container and ratio
  function resetCropBox(img: HTMLImageElement) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    
    // Fit image into container initially
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let displayW = cw * 0.8;
    let displayH = displayW / imgRatio;
    
    if (displayH > ch * 0.8) {
      displayH = ch * 0.8;
      displayW = displayH * imgRatio;
    }

    const x = (cw - displayW) / 2;
    const y = (ch - displayH) / 2;

    // Fit the crop box to selected ratio using the largest size inside the image.
    const { cropWidth: cropW, cropHeight: cropH } = getMaxCropForRatio(displayW, displayH, currentRatio);

    stateRef.current = {
      ...stateRef.current,
      image: img,
      imageX: x, imageY: y, imageWidth: displayW, imageHeight: displayH,
      cropX: x + (displayW - cropW) / 2,
      cropY: y + (displayH - cropH) / 2,
      cropWidth: cropW, cropHeight: cropH,
      containerWidth: cw, containerHeight: ch,
      isDragging: false, isResizing: false, isPanning: false, rotation: 0, scale: 1
    };
    clampCropToImage(stateRef.current);
    clampImageToCrop(stateRef.current);
    renderCanvas();
  }

  useEffect(() => {
    if (stateRef.current.image?.src) {
      resetCropBox(stateRef.current.image);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRatio]);

  // Render Loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !stateRef.current.image) return;

    const { containerWidth, containerHeight, image, imageX, imageY, imageWidth, imageHeight, rotation, scale, cropX, cropY, cropWidth, cropHeight } = stateRef.current;

    canvas.width = containerWidth;
    canvas.height = containerHeight;
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    // Draw Image (with pan/zoom/rotate)
    ctx.save();
    ctx.translate(imageX + imageWidth / 2, imageY + imageHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    ctx.restore();

    // Draw Grid & Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

    // Grid Lines (Rule of Thirds)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const thirdW = cropWidth / 3;
    const thirdH = cropHeight / 3;
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(cropX + i * thirdW, cropY);
      ctx.lineTo(cropX + i * thirdW, cropY + cropHeight);
      ctx.moveTo(cropX, cropY + i * thirdH);
      ctx.lineTo(cropX + cropWidth, cropY + i * thirdH);
    }
    ctx.stroke();

    // Draw Resize Handles
    const handleSize = 10;
    const handles = [
      { x: cropX - handleSize/2, y: cropY - handleSize/2, cursor: "nwse-resize", name: "nw" },
      { x: cropX + cropWidth - handleSize/2, y: cropY - handleSize/2, cursor: "nesw-resize", name: "ne" },
      { x: cropX - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: "nesw-resize", name: "sw" },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: "nwse-resize", name: "se" },
      { x: cropX + cropWidth / 2 - handleSize/2, y: cropY - handleSize/2, cursor: "ns-resize", name: "n" },
      { x: cropX + cropWidth / 2 - handleSize/2, y: cropY + cropHeight - handleSize/2, cursor: "ns-resize", name: "s" },
      { x: cropX - handleSize/2, y: cropY + cropHeight / 2 - handleSize/2, cursor: "ew-resize", name: "w" },
      { x: cropX + cropWidth - handleSize/2, y: cropY + cropHeight / 2 - handleSize/2, cursor: "ew-resize", name: "e" },
    ];

    ctx.fillStyle = "#a78bfa"; // Violet-400
    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x + handleSize/2, h.y + handleSize/2, handleSize/2, 0, Math.PI * 2);
      ctx.fill();
    });

  }, []);

  // --- Event Handlers ---

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getMousePos(e);
    const { cropX, cropY, cropWidth, cropHeight } = stateRef.current;
    const handleSize = 15; // Hit area slightly larger than visual

    // Check Resize Handles
    const handles = [
      { x: cropX, y: cropY, name: "nw" },
      { x: cropX + cropWidth, y: cropY, name: "ne" },
      { x: cropX, y: cropY + cropHeight, name: "sw" },
      { x: cropX + cropWidth, y: cropY + cropHeight, name: "se" },
      { x: cropX + cropWidth / 2, y: cropY, name: "n" },
      { x: cropX + cropWidth / 2, y: cropY + cropHeight, name: "s" },
      { x: cropX, y: cropY + cropHeight / 2, name: "w" },
      { x: cropX + cropWidth, y: cropY + cropHeight / 2, name: "e" },
    ];

    for (const h of handles) {
      if (Math.abs(x - h.x) < handleSize && Math.abs(y - h.y) < handleSize) {
        stateRef.current.isResizing = true;
        stateRef.current.resizeHandle = h.name;
        stateRef.current.resizeStartX = x;
        stateRef.current.resizeStartY = y;
        stateRef.current.resizeCropStartX = cropX;
        stateRef.current.resizeCropStartY = cropY;
        stateRef.current.resizeCropStartW = cropWidth;
        stateRef.current.resizeCropStartH = cropHeight;
        return;
      }
    }

    // Check Crop Box (Drag Crop)
    if (x >= cropX && x <= cropX + cropWidth && y >= cropY && y <= cropY + cropHeight) {
      stateRef.current.isDragging = true;
      stateRef.current.dragStartX = x;
      stateRef.current.dragStartY = y;
      stateRef.current.dragCropStartX = cropX;
      stateRef.current.dragCropStartY = cropY;
      return;
    }

    // Otherwise Pan Image
    stateRef.current.isPanning = true;
    stateRef.current.panStartX = x;
    stateRef.current.panStartY = y;
    stateRef.current.panImageStartX = stateRef.current.imageX;
    stateRef.current.panImageStartY = stateRef.current.imageY;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getMousePos(e);
    const s = stateRef.current;

    if (s.isResizing) {
      const dx = x - s.resizeStartX;
      const dy = y - s.resizeStartY;
      let newW = s.resizeCropStartW;
      let newH = s.resizeCropStartH;
      let newX = s.resizeCropStartX;
      let newY = s.resizeCropStartY;

      const minSize = 50;

      switch (s.resizeHandle) {
        case "e":
          newW = Math.max(minSize, s.resizeCropStartW + dx);
          newH = newW / currentRatio;
          newY = s.resizeCropStartY + (s.resizeCropStartH - newH) / 2;
          break;
        case "w":
          newW = Math.max(minSize, s.resizeCropStartW - dx);
          newH = newW / currentRatio;
          newX = s.resizeCropStartX + (s.resizeCropStartW - newW);
          newY = s.resizeCropStartY + (s.resizeCropStartH - newH) / 2;
          break;
        case "s":
          newH = Math.max(minSize, s.resizeCropStartH + dy);
          newW = newH * currentRatio;
          newX = s.resizeCropStartX + (s.resizeCropStartW - newW) / 2;
          break;
        case "n":
          newH = Math.max(minSize, s.resizeCropStartH - dy);
          newW = newH * currentRatio;
          newY = s.resizeCropStartY + (s.resizeCropStartH - newH);
          newX = s.resizeCropStartX + (s.resizeCropStartW - newW) / 2;
          break;
        default:
          if (s.resizeHandle.includes('e')) {
            newW = Math.max(minSize, s.resizeCropStartW + dx);
            newH = newW / currentRatio;
          }
          if (s.resizeHandle.includes('w')) {
            newW = Math.max(minSize, s.resizeCropStartW - dx);
            newX = s.resizeCropStartX + (s.resizeCropStartW - newW);
            newH = newW / currentRatio;
          }
          if (s.resizeHandle.includes('s')) {
            newH = Math.max(minSize, s.resizeCropStartH + dy);
            newW = newH * currentRatio;
          }
          if (s.resizeHandle.includes('n')) {
            newH = Math.max(minSize, s.resizeCropStartH - dy);
            newY = s.resizeCropStartY + (s.resizeCropStartH - newH);
            newW = newH * currentRatio;
          }
      }
      
      s.cropWidth = newW;
      s.cropHeight = newH;
      s.cropX = newX;
      s.cropY = newY;
      clampCropToImage(s);
      clampImageToCrop(s);
      renderCanvas();
      return;
    }

    if (s.isDragging) {
      const dx = x - s.dragStartX;
      const dy = y - s.dragStartY;
      s.cropX = s.dragCropStartX + dx;
      s.cropY = s.dragCropStartY + dy;
      clampCropToImage(s);
      clampImageToCrop(s);
      renderCanvas();
      return;
    }

    if (s.isPanning) {
      const dx = x - s.panStartX;
      const dy = y - s.panStartY;
      s.imageX = s.panImageStartX + dx;
      s.imageY = s.panImageStartY + dy;
      clampImageToCrop(s);
      renderCanvas();
    }
  };

  const handleMouseUp = () => {
    stateRef.current.isDragging = false;
    stateRef.current.isResizing = false;
    stateRef.current.isPanning = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + (direction * zoomIntensity);
    
    const newScale = Math.min(Math.max(stateRef.current.scale * factor, 0.5), 5);
    stateRef.current.scale = newScale;
    clampImageToCrop();
    renderCanvas();
  };

  const loadImageFromDataUrl = (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });

  const cropImageCenteredToRatio = (img: HTMLImageElement, ratio: number) => {
    const sourceRatio = img.naturalWidth / img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sWidth = img.naturalWidth;
    let sHeight = img.naturalHeight;

    if (sourceRatio > ratio) {
      sHeight = img.naturalHeight;
      sWidth = sHeight * ratio;
      sx = (img.naturalWidth - sWidth) / 2;
    } else {
      sWidth = img.naturalWidth;
      sHeight = sWidth / ratio;
      sy = (img.naturalHeight - sHeight) / 2;
    }

    const outWidth = 800;
    const outHeight = Math.round(outWidth / ratio);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    canvas.width = outWidth;
    canvas.height = outHeight;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outWidth, outHeight);
    return canvas.toDataURL("image/webp", 0.85);
  };

  const handleConfirm = async () => {
    const { image, cropX, cropY, cropWidth, cropHeight, rotation, scale } = stateRef.current;
    
    // Create offscreen canvas for final output
    const outputCanvas = document.createElement("canvas");
    const outCtx = outputCanvas.getContext("2d");
    if (!outCtx) return;

    // Calculate source coordinates relative to original image
    // We need to reverse the transformations applied during drawing
    // This is complex with rotation. Simplified approach:
    // Draw the visible cropped area onto a temp canvas, then extract.
    
    // Better approach for rotated images:
    // 1. Create a canvas with original image dimensions.
    // 2. Draw original image rotated onto it? No, that crops corners.
    // 3. Use context transforms to draw only the crop region.
    
    // Let's stick to the visual crop:
    // The crop box is in Screen Coordinates. The image is transformed.
    // We need to map the Screen Crop Box back to Image Coordinates.
    
    // Simplified: Assume user wants exactly what they see in the box.
    // We can draw the current canvas state (which has the image + overlay) 
    // but we need JUST the image part inside the crop.
    
    // Robust Method:
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if(!tempCtx) return;
    
    // Set temp canvas to crop size
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    
    // Draw the portion of the main canvas (which contains the transformed image)
    // But wait, main canvas has the dark overlay. We can't use main canvas directly.
    // We must re-apply the transform to the temp context.
    
    tempCtx.save();
    // Translate to center of crop (to match main canvas logic relative to image center)
    // Actually, simpler:
    // The main canvas draws: Translate(ImageCenter) -> Rotate -> Scale -> DrawImage(Image, -W/2, -H/2)
    // We want to draw the part of that image that falls inside [cropX, cropY, cropW, cropH].
    
    // Inverse Transform:
    // ScreenPoint -> (Translate -ImageCenter) -> Rotate -Angle -> Scale 1/Scale -> ImagePoint
    
    const cx = stateRef.current.imageX + stateRef.current.imageWidth / 2;
    const cy = stateRef.current.imageY + stateRef.current.imageHeight / 2;
    
    // Function to map screen coord to image coord
    const mapCoord = (sx: number, sy: number) => {
        const x = sx - cx;
        const y = sy - cy;
        
        // Rotate inverse
        const rad = -(rotation * Math.PI) / 180;
        const rx = x * Math.cos(rad) - y * Math.sin(rad);
        const ry = x * Math.sin(rad) + y * Math.cos(rad);
        
        // Scale inverse
        const ix = rx / scale + stateRef.current.imageWidth / 2;
        const iy = ry / scale + stateRef.current.imageHeight / 2;
        
        // Map display size to natural size
        const natX = (ix / stateRef.current.imageWidth) * image.naturalWidth;
        const natY = (iy / stateRef.current.imageHeight) * image.naturalHeight;
        
        return { x: natX, y: natY };
    };

    const topLeft = mapCoord(cropX, cropY);
    const bottomRight = mapCoord(cropX + cropWidth, cropY + cropHeight);
    
    const sWidth = Math.abs(bottomRight.x - topLeft.x);
    const sHeight = Math.abs(bottomRight.y - topLeft.y);
    const sX = Math.min(topLeft.x, bottomRight.x);
    const sY = Math.min(topLeft.y, bottomRight.y);

    // Output dimensions (maintain aspect ratio or fixed width?)
    // Let's output at max 800px width maintaining aspect
    const outWidth = 800;
    const outHeight = Math.round(outWidth / currentRatio);

    outputCanvas.width = outWidth;
    outputCanvas.height = outHeight;

    outCtx.drawImage(image, sX, sY, sWidth, sHeight, 0, 0, outWidth, outHeight);
    
    const dataUrl = outputCanvas.toDataURL("image/webp", 0.85);
    
    const newResult = {
      dataUrl,
      fileName: images[currentImageIndex].fileName,
      sourceId: images[currentImageIndex].sourceId,
      index: currentImageIndex
    };

    if (lockedRatio === null) {
      setLockedRatio(currentRatio);
    }

    const resultsByIndex = new Map<number, { dataUrl: string; fileName: string; sourceId?: string; index: number }>();
    for (const result of croppedResults) {
      resultsByIndex.set(result.index, result);
    }
    resultsByIndex.set(currentImageIndex, newResult);

    const completedResults = await Promise.all(
      images.map(async (imgData, index) => {
        const existing = resultsByIndex.get(index);
        if (existing) return existing;

        const img = await loadImageFromDataUrl(imgData.dataUrl);
        return {
          dataUrl: cropImageCenteredToRatio(img, currentRatio),
          fileName: imgData.fileName,
          sourceId: imgData.sourceId,
          index,
        };
      })
    );

    const sortedCompletedResults = completedResults.sort((a, b) => a.index - b.index);
    setCroppedResults(sortedCompletedResults);
    const finalResults = sortedCompletedResults.map(({ dataUrl, fileName, sourceId }) => ({ dataUrl, fileName, sourceId }));
    onConfirm(finalResults, currentRatio);
  };

  const croppedByIndex = new Map<number, string>();
  for (const result of croppedResults) {
    croppedByIndex.set(result.index, result.dataUrl);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-white/10 bg-zinc-950 shrink-0">
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full">
          <X className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-white tabular-nums">{currentImageIndex + 1}/{images.length}</span>
          
          {canChangeAspectRatio && (
            <div className="flex items-center gap-2 px-1.5 py-1.5 bg-zinc-900 rounded-lg border border-white/10">
              <button
                onClick={() => setAspectRatioIndex(prev => (prev - 1 + SUPPORTED_ASPECT_RATIOS.length) % SUPPORTED_ASPECT_RATIOS.length)}
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold min-w-[2rem] text-center text-violet-400 uppercase tracking-wider">
                {SUPPORTED_ASPECT_RATIOS[aspectRatioIndex].label}
              </span>
              <button
                onClick={() => setAspectRatioIndex(prev => (prev + 1) % SUPPORTED_ASPECT_RATIOS.length)}
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          
          {!canChangeAspectRatio && (
            <span className="text-xs text-violet-400 font-bold uppercase tracking-wider bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">
              Locked: {SUPPORTED_ASPECT_RATIOS.find(r => Math.abs(r.ratio - currentRatio) < 0.01)?.label}
            </span>
          )}
          
          {onAddMore && (
            <Button variant="ghost" onClick={() => document.getElementById('add-more-input')?.click()} className="text-gray-300 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg h-8 px-2 gap-1">
              <Plus className="w-3 h-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Add More</span>
            </Button>
          )}
          <input
            type="file"
            id="add-more-input"
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) onAddMore?.(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </div>

        <Button variant="ghost" size="icon" onClick={handleConfirm} className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-full">
          <Check className="w-3 h-3" />
        </Button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="relative flex-1 bg-black overflow-hidden flex items-center justify-center cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas 
          ref={canvasRef} 
          className="touch-none max-w-full max-h-full block" 
        />
        {/* Hint Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none bg-black/50 px-1 py-1 rounded-full backdrop-blur-sm">
          Drag to move crop • Drag image to pan • Scroll to zoom
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-3 px-2 py-2 border-t border-white/10 bg-zinc-950 overflow-x-auto shrink-0 scrollbar-hide">
        {images.map((img, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentImageIndex(idx)}
            className={`shrink-0 w-10 h-10 rounded-lg overflow-hidden border-0.8 cursor-pointer transition-all ${
              idx === currentImageIndex 
                ? 'border-violet-500 ring-2 ring-violet-500/20 scale-105' 
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <img src={croppedByIndex.get(idx) ?? img.dataUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

    </div>
  );
}
