import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  Target,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Clock,
  Users,
  FileCheck,
  Send,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { useDailyReportSettings } from "@/hooks/useDailyReportSettings";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";

interface ArticleStats {
  article_id: string;
  titulo: string;
  categoria: string;
  usos_total: number;
  feedback_positivo: number;
  feedback_negativo: number;
  taxa_resolucao?: number;
  usado_pela_ia: boolean;
  aprovado: boolean;
}

interface KnowledgeMetrics {
  total_articles: number;
  approved_articles: number;
  ai_enabled_articles: number;
  total_usage: number;
  positive_feedback: number;
  negative_feedback: number;
  pending_suggestions: number;
}

export function RelatoriosTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const { reportPhone, isLoading: isLoadingPhone, updatePhone, isUpdating, isValidPhone } = useDailyReportSettings();
  const [phoneInput, setPhoneInput] = useState('');
  const [metrics, setMetrics] = useState<KnowledgeMetrics>({
    total_articles: 0,
    approved_articles: 0,
    ai_enabled_articles: 0,
    total_usage: 0,
    positive_feedback: 0,
    negative_feedback: 0,
    pending_suggestions: 0
  });
  const [articleStats, setArticleStats] = useState<ArticleStats[]>([]);
  const [resolutionStats, setResolutionStats] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('30'); // dias

  const handleSendDailyReport = async () => {
    setSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-report');
      
      if (error) throw error;
      
      toast({
        title: "✅ Relatório disparado!",
        description: `Relatório enviado com sucesso para WhatsApp. Total de tickets hoje: ${data.summary?.total_abertos || 0}`,
      });
    } catch (error: any) {
      console.error('Erro ao disparar relatório:', error);
      toast({
        title: "❌ Erro ao disparar relatório",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSendingReport(false);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Buscar métricas gerais
      const [articlesRes, usageRes, suggestionsRes, resolutionRes] = await Promise.all([
        supabase.from('knowledge_articles').select('aprovado, usado_pela_ia, feedback_positivo, feedback_negativo'),
        supabase.from('v_kb_articles_usage').select('*'),
        supabase.from('knowledge_suggestions').select('status'),
        supabase.from('v_kb_resolution_rate').select('*')
      ]);

      if (articlesRes.data) {
        const totalArticles = articlesRes.data.length;
        const approvedArticles = articlesRes.data.filter(a => a.aprovado).length;
        const aiEnabledArticles = articlesRes.data.filter(a => a.usado_pela_ia).length;
        const totalPositiveFeedback = articlesRes.data.reduce((sum, a) => sum + (a.feedback_positivo || 0), 0);
        const totalNegativeFeedback = articlesRes.data.reduce((sum, a) => sum + (a.feedback_negativo || 0), 0);

        setMetrics(prev => ({
          ...prev,
          total_articles: totalArticles,
          approved_articles: approvedArticles,
          ai_enabled_articles: aiEnabledArticles,
          positive_feedback: totalPositiveFeedback,
          negative_feedback: totalNegativeFeedback
        }));
      }

      if (usageRes.data) {
        const totalUsage = usageRes.data.reduce((sum: number, item: any) => sum + (item.usos_total || 0), 0);
        setMetrics(prev => ({ ...prev, total_usage: totalUsage }));
        setArticleStats(usageRes.data as ArticleStats[]);
      }

      if (suggestionsRes.data) {
        const pendingSuggestions = suggestionsRes.data.filter(s => s.status === 'pending').length;
        setMetrics(prev => ({ ...prev, pending_suggestions: pendingSuggestions }));
      }

      if (resolutionRes.data) {
        setResolutionStats(resolutionRes.data);
      }
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUsageEffectiveness = (positive: number, negative: number) => {
    const total = positive + negative;
    if (total === 0) return 0;
    return Math.round((positive / total) * 100);
  };

  const getStatusBadge = (approved: boolean, aiEnabled: boolean) => {
    if (!approved) return <Badge variant="destructive">Não Aprovado</Badge>;
    if (!aiEnabled) return <Badge variant="secondary">IA Desabilitada</Badge>;
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  useEffect(() => {
    fetchMetrics();
  }, [filterPeriod]);

  useEffect(() => {
    if (reportPhone && !phoneInput) {
      setPhoneInput(reportPhone);
    }
  }, [reportPhone]);

  const handleUpdateReportPhone = () => {
    if (isValidPhone(phoneInput)) {
      updatePhone(phoneInput);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Relatórios e Analytics</h2>
            <p className="text-muted-foreground">Acompanhe o desempenho da base de conhecimento e eficácia da IA</p>
          </div>
        </div>
      </div>

      {/* Configuração do Número de Destino */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Configuração de Destino do Relatório
          </CardTitle>
          <CardDescription>
            Configure o número de WhatsApp que receberá os relatórios diários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="tel"
                placeholder="5511977256029"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="max-w-xs"
                disabled={isLoadingPhone}
              />
              <Button 
                onClick={handleUpdateReportPhone}
                disabled={isUpdating || !isValidPhone(phoneInput) || phoneInput === reportPhone}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Número'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato: Código do país + DDD + número (ex: 5511977256029)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Relatório Diário WhatsApp */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Send className="h-5 w-5" />
            Relatório Diário via WhatsApp
          </CardTitle>
          <CardDescription className="text-blue-800">
            Dispare o relatório diário manualmente ou aguarde o envio automático às 20h
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleSendDailyReport}
              disabled={sendingReport}
              className="gap-2"
            >
              {sendingReport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Disparar Relatório Agora
                </>
              )}
            </Button>
            <div className="text-sm text-muted-foreground">
              <p>📱 Destino: {reportPhone || 'Não configurado'}</p>
              <p>⏰ Próximo envio automático: Hoje às 20:00</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Alert className="border-green-200 bg-green-50">
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          <strong>Relatórios e Analytics:</strong> Acompanhe o desempenho da base de conhecimento e eficácia da IA. 
          Use estas métricas para identificar conteúdo que precisa ser atualizado ou expandido.
        </AlertDescription>
      </Alert>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Artigos</p>
                <p className="text-2xl font-bold">{metrics.total_articles}</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.approved_articles} aprovados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usados pela IA</p>
                <p className="text-2xl font-bold">{metrics.ai_enabled_articles}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((metrics.ai_enabled_articles / metrics.total_articles) * 100) || 0}% do total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ThumbsUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Feedback Positivo</p>
                <p className="text-2xl font-bold">{metrics.positive_feedback}</p>
                <p className="text-xs text-muted-foreground">
                  {getUsageEffectiveness(metrics.positive_feedback, metrics.negative_feedback)}% eficácia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sugestões Pendentes</p>
                <p className="text-2xl font-bold">{metrics.pending_suggestions}</p>
                <p className="text-xs text-muted-foreground">
                  Para revisão
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtros de Período</CardTitle>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Top Artigos por Uso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Artigos Mais Utilizados
          </CardTitle>
          <CardDescription>
            Ranking dos artigos mais consultados pela IA
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articleStats
                .sort((a, b) => (b.usos_total || 0) - (a.usos_total || 0))
                .slice(0, 10)
                .map((article) => (
                  <TableRow key={article.article_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{article.titulo}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{article.categoria}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{article.usos_total || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{article.feedback_positivo || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsDown className="h-4 w-4 text-red-500" />
                          <span className="text-sm">{article.feedback_negativo || 0}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(article.aprovado, article.usado_pela_ia)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Taxa de Resolução */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Taxa de Resolução por Artigo
          </CardTitle>
          <CardDescription>
            Eficácia dos artigos em resolver problemas (baseado no feedback)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead>Resoluções Positivas</TableHead>
                <TableHead>Resoluções Negativas</TableHead>
                <TableHead>Taxa de Sucesso</TableHead>
                <TableHead>Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolutionStats
                .sort((a, b) => (b.taxa_resolucao || 0) - (a.taxa_resolucao || 0))
                .slice(0, 10)
                .map((stat) => (
                  <TableRow key={stat.article_id}>
                    <TableCell>
                      <p className="font-medium">{stat.titulo}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{stat.resolucoes_positivas || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{stat.resolucoes_negativas || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min((stat.taxa_resolucao || 0) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round((stat.taxa_resolucao || 0) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(stat.taxa_resolucao || 0) >= 0.8 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (stat.taxa_resolucao || 0) >= 0.5 ? (
                        <Target className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Artigos que Precisam de Atenção */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            Artigos que Precisam de Atenção
          </CardTitle>
          <CardDescription>
            Artigos com feedback negativo ou baixa taxa de resolução
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Feedback Negativo</TableHead>
                <TableHead>Ação Sugerida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articleStats
                .filter(article => (article.feedback_negativo || 0) > (article.feedback_positivo || 0))
                .slice(0, 5)
                .map((article) => (
                  <TableRow key={article.article_id}>
                    <TableCell>
                      <p className="font-medium">{article.titulo}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Alto feedback negativo</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600 font-medium">
                        {article.feedback_negativo || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Revisar conteúdo</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              {articleStats.filter(article => (article.feedback_negativo || 0) > (article.feedback_positivo || 0)).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-center text-muted-foreground">
                      <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum artigo precisa de atenção no momento</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}