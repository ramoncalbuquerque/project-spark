import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <p className="text-foreground">
            Se o email existir, você receberá um link de recuperação.
          </p>
          <Link to="/login" className="text-primary hover:underline text-sm">
            Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Enviar link de recuperação"
          )}
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Voltar ao login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
