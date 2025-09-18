import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
      {/* SEO Meta Tags */}
      <title>Página Não Encontrada - 404</title>
      <meta name="description" content="A página que você procurou não foi encontrada. Volte para a página inicial ou explore outras seções do sistema." />
      <meta name="robots" content="noindex, nofollow" />
      
      <main className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="liquid-glass-card max-w-md w-full text-center">
          <CardContent className="p-8 space-y-6">
            {/* 404 Number with gradient */}
            <div className="space-y-2">
              <h1 className="text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                404
              </h1>
              <div className="w-20 h-1 bg-gradient-primary mx-auto rounded-full"></div>
            </div>

            {/* Error Message */}
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-foreground">
                Página não encontrada
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A página que você estava procurando não existe ou foi movida. 
                Verifique a URL ou volte para a página inicial.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                asChild 
                className="flex-1 liquid-glass-button"
                variant="default"
              >
                <Link to="/">
                  <Home className="w-4 h-4 mr-2" />
                  Voltar ao Início
                </Link>
              </Button>
              
              <Button 
                asChild 
                variant="outline" 
                className="flex-1"
                onClick={() => window.history.back()}
              >
                <button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </button>
              </Button>
            </div>

            {/* Additional Help */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Precisa de ajuda? Entre em contato com o suporte
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default NotFound;
