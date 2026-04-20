"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  User,
  Bell,
  MapPin,
  LogOut,
  Pencil,
  Trash2,
  Loader2,
  Info,
  ShieldAlert,
} from "lucide-react";

// Components
import { Sidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/create/cropper";
import { api, type UserProfile } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { config, resolveImageUrl } from "@/lib/config";
import { FULL_NAME_PATTERN, USERNAME_PATTERN } from "@/lib/validation";
import { pushClient } from "@/lib/push";

// Utils
import { showToast } from "@/lib/utils/toast"; // Assuming you have a toast utility, otherwise see inline implementation below

const getInitialsFromName = (name?: string | null): string => {
  const source = (name || "").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};

interface CropperImageData {
  dataUrl: string;
  fileName: string;
  sourceId?: string;
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

const convertImageToWebpData = async (file: File): Promise<CropperImageData> => {
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
      sourceId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, refreshSessionUser } = useSessionUser();
  
  // State
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [countryPreviewEnabled, setCountryPreviewEnabled] = useState(true);
  
  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    bio: "",
  });
  const [usernameStatus, setUsernameStatus] = useState<{ valid: boolean; message: string; loading: boolean }>({
    valid: true,
    message: "",
    loading: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarCropperImages, setAvatarCropperImages] = useState<CropperImageData[]>([]);
  const [fullNameError, setFullNameError] = useState<string>("");
  const [usernameTimer, setUsernameTimer] = useState<number | null>(null);

  // Fetch Profile on Mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const data = await api.getProfile(user.username);
        setProfile(data);
        setEditForm({
          fullName: data.fullName,
          username: data.username,
          bio: data.bio || "",
        });
        setPushEnabled(Boolean(data.pushNotificationsEnabled));
        setCountryPreviewEnabled(Boolean(data.showCountryPreview));
      } catch (error) {
        console.error("Failed to load profile", error);
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    return () => {
      if (usernameTimer !== null) {
        window.clearTimeout(usernameTimer);
      }
    };
  }, [usernameTimer]);

  const validateFullNameInput = (value: string): string => {
    const clean = value.trim();
    if (clean.length < 2 || clean.length > 50) {
      return "Full name must be between 2 and 50 characters.";
    }
    if (!FULL_NAME_PATTERN.test(clean)) {
      return "Full name can only contain letters, numbers, spaces, periods, and underscores.";
    }
    return "";
  };

  const validateUsernameInput = (value: string): string => {
    const clean = value.trim().toLowerCase();
    if (clean.length < 3 || clean.length > 20) {
      return "Username must be between 3 and 20 characters.";
    }
    if (!USERNAME_PATTERN.test(clean)) {
      return "Username can only contain lowercase letters, numbers, periods, and underscores.";
    }
    return "";
  };

  // Handle Username Validation
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setEditForm((prev) => ({ ...prev, username: val }));

    const formatError = validateUsernameInput(val);
    if (formatError) {
      setUsernameStatus({ valid: false, message: formatError, loading: false });
      return;
    }

    if (val === user?.username || val === profile?.username) {
      setUsernameStatus({ valid: true, message: "Current username", loading: false });
      return;
    }

    setUsernameStatus({ valid: false, message: "Checking...", loading: true });

    if (usernameTimer !== null) {
      window.clearTimeout(usernameTimer);
    }

    // Debounce check
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.checkUsername(val);
        if (res.available) {
          setUsernameStatus({ valid: true, message: "Available", loading: false });
        } else {
          setUsernameStatus({ valid: false, message: res.message || "Taken", loading: false });
        }
      } catch {
        setUsernameStatus({ valid: false, message: "Error checking", loading: false });
      }
    }, 600);
    setUsernameTimer(timer);
  };

  // Save Profile (Bio, Name, Username)
  const handleSaveProfile = async () => {
    const normalizedUsername = editForm.username.trim().toLowerCase();
    const normalizedFullName = editForm.fullName.trim();

    const fullNameChanged = normalizedFullName !== (profile?.fullName ?? "");
    if (fullNameChanged) {
      const nextFullNameError = validateFullNameInput(normalizedFullName);
      setFullNameError(nextFullNameError);
      if (nextFullNameError) {
        showToast(nextFullNameError, "error");
        return;
      }
    } else {
      setFullNameError("");
    }

    if (!usernameStatus.valid && normalizedUsername !== user?.username) {
      showToast("Please fix username errors", "error");
      return;
    }

    setIsSaving(true);
    try {
      const updates: { fullName?: string; bio?: string; username?: string } = {};
      
      if (fullNameChanged) updates.fullName = normalizedFullName;
      if (editForm.bio !== profile?.bio) updates.bio = editForm.bio;
      if (normalizedUsername !== profile?.username) updates.username = normalizedUsername;

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        return;
      }

      const result = await api.updateProfile(updates);
      
      if (result.success) {
        // Update local session state
        if (user && result.user) {
          updateUser({
            fullName: result.user.fullName,
            username: result.user.username,
          });
          setProfile((prev) => prev ? { ...prev, ...result.user } : null);
        }
        setIsEditing(false);
        showToast("Profile updated successfully!", "success");
      } else {
        showToast(result.message || "Update failed", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to update profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Avatar Upload
  const handleAvatarUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB", "error");
      return;
    }

    try {
      const converted = await convertImageToWebpData(file);
      setAvatarCropperImages([converted]);
      setShowAvatarCropper(true);
    } catch (error) {
      console.error(error);
      showToast("Failed to process avatar image", "error");
    }
  };

  const handleAvatarCropConfirm = async (
    croppedImages: { dataUrl: string; fileName: string; sourceId?: string }[],
  ) => {
    const first = croppedImages[0];
    if (!first) {
      setShowAvatarCropper(false);
      setAvatarCropperImages([]);
      return;
    }

    setShowAvatarCropper(false);
    setAvatarCropperImages([]);
    setIsUploadingAvatar(true);
    showToast("Uploading avatar...", "success");
    try {
      const dims = await getImageDimensionsFromDataUrl(first.dataUrl);
      const uploaded = await api.uploadImage({
        fileBase64: first.dataUrl.replace(/^data:/, ""),
        width: dims.width,
        height: dims.height,
        exif: "{}",
      });

      const updated = await api.updateProfile({ avatarImgId: uploaded.id, clearAvatar: false });
      if (!updated.success || !updated.user) {
        throw new Error(updated.message || "Failed to save avatar.");
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              avatarUrl: updated.user?.avatarUrl || null,
            }
          : prev
      );
      updateUser({ avatarUrl: updated.user.avatarUrl || null });
      await refreshSessionUser();

      showToast("Avatar uploaded successfully", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to upload avatar", "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const triggerFileInput = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleAvatarUpload(file);
    };
    input.click();
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove your avatar?")) return;
    try {
      const updated = await api.updateProfile({ clearAvatar: true });
      if (!updated.success) throw new Error(updated.message || "Failed to remove avatar.");
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      updateUser({ avatarUrl: null });
      await refreshSessionUser();
      showToast("Avatar removed", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to remove avatar", "error");
    }
  };

  const togglePushNotifications = async () => {
    const newState = !pushEnabled;
    setPushEnabled(newState);
    try {
      if (newState) {
        if (!pushClient.isSupported()) {
          throw new Error("Push notifications are not supported in this browser.");
        }
        const permission = await pushClient.requestPermission();
        if (permission !== "granted") {
          throw new Error("Notification permission was not granted.");
        }
        const subscription = await pushClient.subscribe();
        const json = subscription.toJSON();
        const auth = json.keys?.auth;
        const p256dh = json.keys?.p256dh;
        if (!json.endpoint || !auth || !p256dh) {
          throw new Error("Invalid push subscription data.");
        }
        await api.registerPushSubscription({
          endpoint: json.endpoint,
          auth,
          p256dh,
          userAgent: navigator.userAgent,
        });
      } else {
        const endpoint = await pushClient.unsubscribe();
        if (endpoint) {
          await api.unregisterPushSubscription(endpoint);
        }
      }

      const result = await api.updateProfile({ pushNotificationsEnabled: newState });
      if (!result.success || !result.user) throw new Error(result.message || "Failed to update push settings.");
      const updatedUser = result.user;
      setProfile((prev) =>
        prev
          ? { ...prev, pushNotificationsEnabled: updatedUser.pushNotificationsEnabled }
          : prev
      );
      showToast(newState ? "Push notifications enabled" : "Push notifications disabled", "success");
    } catch (error) {
      setPushEnabled(!newState);
      console.error(error);
      showToast(error instanceof Error ? error.message : "Failed to update push notification settings", "error");
    }
  };

  const toggleCountryPreview = async () => {
    const newState = !countryPreviewEnabled;
    setCountryPreviewEnabled(newState);
    try {
      const result = await api.updateProfile({ showCountryPreview: newState });
      if (!result.success || !result.user) throw new Error(result.message || "Failed to update country preview settings.");
      const updatedUser = result.user;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              showCountryPreview: updatedUser.showCountryPreview,
            }
          : prev
      );
      showToast(newState ? "Country preview enabled" : "Country preview disabled", "success");
    } catch (error) {
      setCountryPreviewEnabled(!newState);
      console.error(error);
      showToast("Failed to update country preview settings", "error");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex">
        <Sidebar />
        <main className="flex-1 ml-14 lg:ml-14 min-h-screen bg-black flex flex-col relative">
          <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-violet-500/20 px-4 sm:px-6 py-4 flex-shrink-0">
            <div className="max-w-5xl mx-auto flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-28 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-44 bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
              <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] p-4">
                <div className="w-32 h-32 mx-auto rounded-xl bg-zinc-800 animate-pulse" />
                <div className="h-3 w-28 mx-auto mt-4 bg-zinc-800 rounded animate-pulse" />
              </div>

              <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] overflow-hidden">
                <div className="h-11 border-b border-zinc-800/50 px-4 flex items-center">
                  <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-20 bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              </div>

              {[...Array(4)].map((_, i) => (
                <div key={`settings-skeleton-${i}`} className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-28 bg-zinc-800 rounded animate-pulse" />
                      <div className="h-3 w-40 bg-zinc-800 rounded animate-pulse" />
                    </div>
                    <div className="w-11 h-6 bg-zinc-800 rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />
      
      <main className="flex-1 ml-14 lg:ml-14 min-h-screen bg-black flex flex-col relative">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-violet-500/20 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Settings className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Settings</h1>
                <p className="text-xs text-zinc-500">Manage your account & preferences</p>
              </div>
            </div>
            {isEditing && (
              <Button 
                onClick={() => setIsEditing(false)} 
                variant="ghost" 
                size="sm"
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
            )}
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            
            {/* 1. Profile Picture Card */}
            <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] backdrop-blur-sm hover:border-zinc-700 transition-all p-4 hover:bg-white/[0.03] flex flex-col items-center">
              <div className="relative group mb-4">
                  <Avatar size="xl" className="border border-violet-500/20">
                  <AvatarImage src={resolveImageUrl(profile.avatarUrl)} alt={profile.fullName} />
                  <InitialsAvatarFallback initials={getInitialsFromName(profile.fullName)} className="text-[3rem] bg-transparent" />
                </Avatar>
                
                {/* Overlay Actions */}
                <div
                  className={`absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center gap-2 ${isUploadingAvatar ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity ${isUploadingAvatar ? "cursor-wait" : "cursor-pointer"}`}
                  onClick={() => {
                    if (isUploadingAvatar) return;
                    triggerFileInput();
                  }}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <>
                      <Pencil className="w-4 h-4 text-white" />
                      <Trash2 className="w-4 h-4 text-red-400" onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }} />
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1 text-center">
                {isUploadingAvatar ? "Uploading avatar..." : "Click to change or remove"}
              </p>
            </div>

            {/* 2. Profile Details Card */}
            <div className="break-inside-avoid mb-2 rounded-xl bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.03] transition-all overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-violet-400" />
                  <h3 className="font-semibold text-white text-sm">Overview</h3>
                </div>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="text-zinc-400 hover:text-white">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <div className="p-4 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <input 
                        type="text" 
                        value={editForm.fullName}
                        onChange={(e) => {
                          const next = e.target.value;
                          setEditForm({ ...editForm, fullName: next });
                          setFullNameError(validateFullNameInput(next));
                        }}
                        className="w-full bg-zinc-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:bg-zinc-500/20"
                      />
                      {fullNameError && (
                        <p className="mt-1 text-xs text-red-500">{fullNameError}</p>
                      )}
                    </div>
                    <div>
                        <div className="relative">
                        <input 
                          type="text" 
                          value={editForm.username}
                          onChange={handleUsernameChange}
                          className={`w-full bg-zinc-900/50 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none ${usernameStatus.loading ? 'bg-zinc-500/20' : usernameStatus.valid ? 'border-green-500/20' : 'border-red-500/20'}`}
                        />
                        {usernameStatus.loading && <Loader2 className="w-3 h-3 text-zinc-500 absolute right-3 top-3 animate-spin" />}
                        {!usernameStatus.loading && usernameStatus.message && (
                          <span className={`absolute right-3 top-2.5 text-xs ${usernameStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                            {usernameStatus.message}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <textarea 
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        rows={3}
                        maxLength={160}
                        className="w-full bg-zinc-500/[0.05] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:bg-zinc-500/[0.09] resize-none"
                        placeholder="Tell us about yourself..."
                      />
                      <div className="text-right text-[10px] text-zinc-600 mt-1">{editForm.bio.length}/160</div>
                    </div>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={isSaving || (!usernameStatus.valid && editForm.username !== user.username)}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 flex flex-col items-center">
                    <div>
                      <div className="text-md font-semibold mb-1 text-white">{profile.fullName}</div>
                      <div className="text-xs flex flex-col items-center text-zinc-500">@{profile.username}</div>
                    </div>
                    {profile.bio && (
                      <div className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/30">
                        {profile.bio}
                      </div>
                    )}
                    {!profile.bio && <div className="text-sm text-zinc-600 italic">No bio yet.</div>}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Notifications Card */}
            <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.05] transition-all p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-fuchsia-500/10">
                    <Bell className="w-4 h-4 text-fuchsia-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Push Notifications</h3>
                    <p className="text-xs text-zinc-500">Get alerts for activity</p>
                  </div>
                </div>
                <button 
                  onClick={togglePushNotifications}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${pushEnabled ? 'bg-violet-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* 4. Country Preview Card */}
            <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.05] transition-all p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <MapPin className="w-4 h-4 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Country Preview</h3>
                    <p className="text-xs text-zinc-500">Show country on your profile</p>
                  </div>
                </div>
                <button
                  onClick={toggleCountryPreview}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${countryPreviewEnabled ? 'bg-violet-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${countryPreviewEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* 5. About / App Info */}
            <div className="break-inside-avoid mb-4 rounded-xl bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.05] transition-all p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-pink-400" />
                <h3 className="font-semibold text-white text-sm">About Guffie</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Version</span>
                  <span className="font-mono text-white">1.0.0</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Build</span>
                  <span className="font-mono text-white">{config.apiBaseUrl.includes('localhost') ? 'Dev' : 'Prod'}</span>
                </div>
              </div>
            </div>

            {/* 6. Danger Zone */}
            <div className="break-inside-avoid mb-4 rounded-xl bg-red-700/[0.07] backdrop-blur-sm hover:bg-red-500/[0.07] transition-all p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-red-400 text-sm">Account</h3>
              </div>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full bg-white/[0.1] border border-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </div>

          </div>
        </div>

        <AnimatePresence>
          {showAvatarCropper && avatarCropperImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black"
            >
              <ImageCropper
                images={avatarCropperImages}
                onConfirm={(cropped) => void handleAvatarCropConfirm(cropped)}
                onCancel={() => {
                  setShowAvatarCropper(false);
                  setAvatarCropperImages([]);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
