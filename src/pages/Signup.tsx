import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function rawPhone(value: string) {
  return value.replace(/\D/g, "");
}

type AccountRole = "leader" | "member" | null;

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>(null);
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [showCustomDept, setShowCustomDept] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.rpc("get_departments");
      if (data) {
        setDepartments(data as string[]);
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = rawPhone(phone);
    if (digits.length < 10 || digits.length > 11) {
      toast({ variant: "destructive", title: "Erro", description: "Telefone inválido. Use DDD + número." });
      return;
    }

    if (!accountRole) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione o tipo de conta." });
      return;
    }

    const finalDepartment = showCustomDept ? customDepartment.trim() : department;

    if (accountRole === "leader" && !finalDepartment) {
      toast({ variant: "destructive", title: "Erro", description: "Informe o departamento que você lidera." });
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
        .update({
          full_name: fullName.trim(),
          phone: digits,
          role: accountRole,
          department: (showCustomDept ? customDepartment.trim() : department) || null,
        })
        .eq("id", data.user.id);

      // Link with existing contact by phone
      const { data: matchingContacts } = await supabase
        .from("contacts")
        .select("id, department, position, linked_profile_id")
        .eq("phone", digits)
        .is("linked_profile_id", null)
        .limit(1);

      if (matchingContacts && matchingContacts.length > 0) {
        const contact = matchingContacts[0];

        await supabase
          .from("contacts")
          .update({ linked_profile_id: data.user.id })
          .eq("id", contact.id);

        // Copy contact metadata to profile if not already set
        const enrichUpdate: { department?: string; position?: string } = {};
        if (contact.department && !finalDepartment) enrichUpdate.department = contact.department;
        if (contact.position) enrichUpdate.position = contact.position;

        if (Object.keys(enrichUpdate).length > 0) {
          await supabase
            .from("profiles")
            .update(enrichUpdate)
            .eq("id", data.user.id);
        }
      }
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

        {/* Account type selection */}
        <div className="space-y-2">
          <Label>Tipo de conta</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountRole("leader")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                accountRole === "leader"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Shield className={cn("h-6 w-6", accountRole === "leader" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", accountRole === "leader" ? "text-primary" : "text-foreground")}>Líder</span>
              <span className="text-[11px] leading-tight text-muted-foreground">Crio e delego tarefas para meu time</span>
            </button>
            <button
              type="button"
              onClick={() => { setAccountRole("member"); setDepartment(""); }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                accountRole === "member"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <User className={cn("h-6 w-6", accountRole === "member" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", accountRole === "member" ? "text-primary" : "text-foreground")}>Colaborador</span>
              <span className="text-[11px] leading-tight text-muted-foreground">Executo tarefas atribuídas a mim</span>
            </button>
          </div>
        </div>

        {/* Department */}
        {accountRole && (
          <div className="space-y-2">
            <Label htmlFor="department">
              {accountRole === "leader" ? "Qual departamento você lidera?" : "Seu departamento (opcional)"}
            </Label>
            {!showCustomDept ? (
              <Select
                value={department}
                onValueChange={(val) => {
                  if (val === "__other__") {
                    setShowCustomDept(true);
                    setDepartment("");
                  } else {
                    setDepartment(val);
                  }
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value="__other__">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do departamento"
                  value={customDepartment}
                  onChange={(e) => setCustomDepartment(e.target.value)}
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => { setShowCustomDept(false); setCustomDepartment(""); }}
                >
                  Voltar
                </Button>
              </div>
            )}
          </div>
        )}

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
