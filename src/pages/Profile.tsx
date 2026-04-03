import { useState, useRef, useEffect } from "react";
import { Camera, Save, Lock, Phone, Mail, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const Profile = () => {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Perfil salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (err: any) {
      toast.error("Erro ao alterar senha: " + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-6 px-4 space-y-6">
      <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-border">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={fullName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
        {uploading && (
          <span className="text-xs text-muted-foreground">Enviando...</span>
        )}
      </div>

      <Separator />

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="profile-name" className="flex items-center gap-1.5">
          <UserIcon className="h-3.5 w-3.5" /> Nome
        </Label>
        <Input
          id="profile-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Seu nome completo"
          className="h-11"
        />
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Email
        </Label>
        <Input
          value={user?.email || ""}
          readOnly
          disabled
          className="h-11 bg-muted/50"
        />
      </div>

      {/* Phone */}
      <div className="space-y-1">
        <Label htmlFor="profile-phone" className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Telefone
        </Label>
        <Input
          id="profile-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(00) 00000-0000"
          className="h-11"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full h-11 gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar alterações"}
      </Button>

      <Separator />

      {/* Password */}
      {!showPassword ? (
        <Button
          variant="outline"
          className="w-full h-11 gap-2"
          onClick={() => setShowPassword(true)}
        >
          <Lock className="h-4 w-4" />
          Trocar senha
        </Button>
      ) : (
        <div className="space-y-3 p-4 border border-border rounded-lg">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Trocar Senha
          </h3>
          <div className="space-y-1">
            <Label htmlFor="new-pw">Nova senha</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pw">Confirmar senha</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="h-11"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowPassword(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword}
              className="flex-1"
            >
              {changingPassword ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
