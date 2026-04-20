/**
* Create Post Page
* Updated to match the visual identity of Login/Register pages.
*/
"use client";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Image as ImageIcon, X, VenetianMask,
  Lightbulb, CheckCircle, Loader2, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// Components
import { Sidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/create/cropper";
import { api } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { resolveImageUrl } from "@/lib/config";

const MAX_IMAGES = 5;
const MAX_CHARS = 500;

interface ImagePreview {
  url: string;
  file: File;
  width: number;
  height: number;
  exif: Record<string, unknown>;
  sourceId?: string;
}

interface CropperImageData {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
  exif: Record<string, unknown>;
  sourceId: string;
}

const toWebpFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return `${fileName}.webp`;
  return `${fileName.slice(0, dotIndex)}.webp`;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const getImageDimensionsFromDataUrl = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to read image dimensions"));
    img.src = dataUrl;
  });

const extractExifPayload = (file: File): Record<string, unknown> => ({
  originalFileName: file.name,
  originalMimeType: file.type,
  originalSize: file.size,
  originalLastModified: file.lastModified,
});

const convertImageToWebpAndStripExif = async (file: File): Promise<CropperImageData> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.drawImage(img, 0, 0);

    const webpBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("WebP conversion failed"));
          return;
        }
        resolve(blob);
      }, "image/webp", 0.9);
    });

    const webpFile = new File([webpBlob], toWebpFileName(file.name), { type: "image/webp" });
    const dataUrl = await readFileAsDataUrl(webpFile);

    return {
      dataUrl,
      fileName: webpFile.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      exif: extractExifPayload(file),
      sourceId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function CreatePost() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImages, setCropperImages] = useState<CropperImageData[]>([]);
  const [cropperLockedRatio, setCropperLockedRatio] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { user: currentUser } = useSessionUser();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [content]);

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
  };

  const processIncomingImages = async (incomingFiles: File[]) => Promise.all(incomingFiles.map(convertImageToWebpAndStripExif));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (isAnonymous) {
        showToast("Images are disabled for anonymous posts", "error");
        return;
      }
      if (!e.target.files || e.target.files.length === 0) return;

      if (images.length + e.target.files.length > MAX_IMAGES) {
        showToast(`Maximum ${MAX_IMAGES} images allowed`, "error");
        return;
      }

      const validFiles = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
      if (validFiles.length !== e.target.files.length) {
        showToast("Some files are not valid images", "error");
        return;
      }

      const convertedForCropper = await processIncomingImages(validFiles);
      setCropperImages(convertedForCropper);
      setShowCropper(true);
    } catch {
      showToast("Could not process one or more images", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleCropperAddMore = async (files: FileList) => {
    try {
      if (isAnonymous) {
        showToast("Images are disabled for anonymous posts", "error");
        return;
      }
      const allFiles = Array.from(files);
      const validFiles = allFiles.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length !== allFiles.length) {
        showToast("Some files are not valid images", "error");
        return;
      }

      const currentTotal = images.length + cropperImages.length;
      if (currentTotal + validFiles.length > MAX_IMAGES) {
        showToast(`Maximum ${MAX_IMAGES} images allowed`, "error");
        return;
      }

      const convertedForCropper = await processIncomingImages(validFiles);
      setCropperImages((prev) => [...prev, ...convertedForCropper]);
    } catch {
      showToast("Could not add more images", "error");
    }
  };

  const handleCropperConfirm = async (
    croppedImages: { dataUrl: string; fileName: string; sourceId?: string }[],
    lockedRatioUsed: number
  ) => {
    const cropperMetaBySourceId = new Map<string, CropperImageData>();
    for (const item of cropperImages) {
      cropperMetaBySourceId.set(item.sourceId, item);
    }

    setShowCropper(false);
    setCropperImages([]);
    setCropperLockedRatio(lockedRatioUsed);

    // Convert dataURLs back to Files/Blobs for submission
    const newPreviews: ImagePreview[] = await Promise.all(croppedImages.map(async (img) => {
      const byteString = atob(img.dataUrl.split(',')[1]);
      const mimeString = img.dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const { width, height } = await getImageDimensionsFromDataUrl(img.dataUrl);
      const meta = img.sourceId ? cropperMetaBySourceId.get(img.sourceId) : undefined;

      return {
        url: img.dataUrl,
        file: new File([blob], img.fileName, { type: mimeString }),
        width,
        height,
        exif: meta?.exif ?? {},
        sourceId: img.sourceId,
      };
    }));

    setImages(prev => [...prev, ...newPreviews]);
    showToast(`${newPreviews.length} image(s) added!`, "success");
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) {
      showToast("Post cannot be empty", "error");
      return;
    }
    if (content.length > MAX_CHARS) {
      showToast("Content exceeds character limit", "error");
      return;
    }

    if (isAnonymous && images.length > 0) {
      showToast("Anonymous posts cannot include images", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedImageIds = isAnonymous
        ? []
        : await Promise.all(images.map(async (img) => {
        console.log("[CreatePost] Upload EXIF JSON", { fileName: img.file.name, exif: img.exif });

        const uploaded = await api.uploadImage({
          fileBase64: img.url.replace(/^data:/, ""),
          width: img.width,
          height: img.height,
          exif: JSON.stringify(img.exif ?? {}),
        });

        return uploaded.imgid;
      }));

      const createdPost = await api.createPost({
        content: content.trim(),
        images: uploadedImageIds.length > 0 ? uploadedImageIds : undefined,
        anon: isAnonymous,
      });

      await Promise.all(
        uploadedImageIds.map(async (imgid) => {
          try {
            await api.linkImageToPost(imgid, createdPost.id);
          } catch (err) {
            console.warn("[CreatePost] Failed to link image to post", { imgid, postId: createdPost.id, err });
          }
        })
      );

      showToast(isAnonymous ? "Anonymous post created!" : "Post created successfully!", "success");
      
      // Reset and Navigate
      setContent("");
      setImages([]);
      setIsAnonymous(false);
      setCropperLockedRatio(null);
      navigate("/");
    } catch {
      showToast("Failed to create post", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAnonymous = () => {
    setIsAnonymous((prev) => {
      const next = !prev;
      if (next) {
        setImages([]);
        setShowCropper(false);
        setCropperImages([]);
        showToast("Anonymous mode enabled: images disabled", "success");
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Global Styles for Fonts/Animations */}
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap");
        .font-great-vibes { font-family: "Great Vibes", cursive; font-weight: 400; }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-gradient { animation: gradient 8s ease infinite; }
      `}</style>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-14 flex-1 min-h-screen bg-black flex flex-col relative">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-violet-500/20">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-semibold text-white tracking-wide">Create Post</h1>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && images.length === 0)}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_-5px_rgba(139,92,246,0.4)]"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
            </Button>
          </div>
        </header>

        {/* Form Container */}
        <div className="p-6 lg:p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-2">
            
            {/* Main Card - Matches Register/Login aesthetic */}
            <div className="bg-zinc-950 rounded-3xl border border-violet-500/20 shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] overflow-hidden">
              
              {/* Author Info */}
              <div className="flex items-center gap-4 p-3 border-b border-white/5">
                <button
                  onClick={() => currentUser?.username && navigate(`/${currentUser.username}`)}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-10 w-10 border border-violet-500/30">
                    <AvatarImage src={resolveImageUrl(currentUser?.avatarUrl)} />
                    <InitialsAvatarFallback className="pt-0.2 bg-transparent pl-0.2 text-sm" initials={currentUser?.initials ?? "U"} />
                  </Avatar>
                </button>
                <div className="flex-1">
                  <div className="font-semibold text-white text-md">{isAnonymous ? "Anonymous" : (currentUser?.fullName ?? "User")}</div>
                  <div className="text-gray-500 text-xs">
                    {isAnonymous ? "Identity hidden" : `@${currentUser?.username ?? "user"} · Just now`}
                  </div>
                </div>
              </div>

              {/* Anonymous Toggle */}
              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 rounded-lg shadow-lg shadow-violet-400/10">
                    <VenetianMask className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Post Anonymously</div>
                    <div className="text-xs text-gray-500">Your identity will be hidden from viewers</div>
                  </div>
                </div>
                <button
                  onClick={toggleAnonymous}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${isAnonymous ? "bg-violet-500" : "bg-zinc-700"}`}
                >
                  <div
                    className={`absolute top-1/2 left-1 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-300 ${
                      isAnonymous ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Content Input */}
              <div className="p-3">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-white text-base leading-relaxed placeholder-gray-600 focus:outline-none resize-none"
                />
              </div>

              {/* Image Previews */}
              {!isAnonymous && images.length > 0 && (
                <div className="px-6 pb-2">
                  <div className="flex flex-wrap gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-white/10 shadow-md">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => removeImage(idx)} className="p-1.5 bg-red-500/90 hover:bg-red-600 rounded-lg text-white backdrop-blur-sm transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Image Button */}
              <div className="px-3 pb-3">
                <label className="inline-flex items-center gap-3 px-3 py-3 rounded-xl border transition-all cursor-pointer text-sm font-medium border-dashed border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5 text-gray-400 hover:text-violet-300">
                  <ImageIcon className="w-3 h-4" />
                  <span>
                    {isAnonymous
                      ? "Disabled"
                      : `Add Images${images.length > 0 ? ` (${images.length}/${MAX_IMAGES})` : ` (Max ${MAX_IMAGES})`}`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isAnonymous}
                  />
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between px-3 py-3 border-t border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  {/* Future: Emoji, Poll, etc. */}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className={content.length > MAX_CHARS ? "text-red-400" : ""}>{content.length}</span>
                  <span>/</span>
                  <span>{MAX_CHARS}</span>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0" />
                </div>
                <div className="text-xs text-gray-400 space-y-1.5 leading-relaxed">
                  <p><strong className="text-gray-300">Tips for a great post:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>Keep it concise and engaging</li>
                    <li>Add an image to get more visibility</li>
                    <li>Use Shift+Enter for line breaks</li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Cropper Modal */}
        <AnimatePresence>
          {showCropper && cropperImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black"
            >
              <ImageCropper
                images={cropperImages}
                onConfirm={handleCropperConfirm}
                initialLockedRatio={cropperLockedRatio}
                onAddMore={handleCropperAddMore}
                onCancel={() => {
                  setShowCropper(false);
                  setCropperImages([]);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-violet-500/20 rounded-xl px-6 py-3 shadow-2xl shadow-violet-500/10 z-50 flex items-center gap-3 backdrop-blur-md"
            >
              {toast.type === "success" ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <X className="w-5 h-5 text-red-400" />
              )}
              <span className="text-sm font-medium text-white">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
