import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function rawPhone(value: string) {
  return value.replace(/\D/g, "");
}

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = rawPhone(phone);
    if (digits.length < 10 || digits.length > 11) {
      toast({ variant: "destructive", title: "Erro", description: "Telefone inválido. Use DDD + número." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem." });
      return;
    }

    if (password.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), phone: digits },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: digits })
        .eq("id", data.user.id);
    }

    toast({ title: "Conta criada com sucesso!", description: "Faça login para continuar." });
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
    setLoading(false);
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" type="tel" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input id="confirmPassword" type="password" placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11" />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Signup;
