import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserEquipes } from "@/hooks/useUserEquipes";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Save, Loader2, User, Mail, Phone, Users, Activity, Shield, Lock, Ticket, MessageSquare, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageCropper } from "@/components/profile/ImageCropper";

export default function Profile() {
  const { user } = useAuth();
  const { profile, updateProfile, isLoading: profileLoading } = useProfile();
  const { userEquipes, loading: equipesLoading, getPrimaryEquipe } = useUserEquipes();
  const { activity, loading: activityLoading } = useUserActivity();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [formData, setFormData] = useState({
    nome_completo: profile?.nome_completo || "",
    email: profile?.email || user?.email || "",
    telefone: profile?.telefone || "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar dados do perfil com o formulário
  useEffect(() => {
    if (profile) {
      setFormData({
        nome_completo: profile.nome_completo || "",
        email: profile.email || user?.email || "",
        telefone: profile.telefone || "",
      });
    }
  }, [profile, user]);

  // Seleção de arquivo para crop
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro", 
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedImageFile(file);
    setIsCropperOpen(true);
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload de avatar após crop
  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!user) {
      console.error('No user found');
      return;
    }

    console.log('Starting avatar upload process...', {
      userId: user.id,
      blobSize: croppedBlob.size,
      blobType: croppedBlob.type
    });

    setIsUploadingAvatar(true);

    try {
      // Criar nome único para o arquivo
      const fileName = `${user.id}/avatar.jpg`;
      console.log('Upload filename:', fileName);

      // Upload para o storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          upsert: true, // Substitui se já existir
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Obter URL público
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Adicionar timestamp para evitar cache
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Atualizar perfil com nova URL do avatar
      const result = await updateProfile({ avatar_url: urlWithTimestamp });
      console.log('Profile update result:', result);

      toast({
        title: "Sucesso",
        description: "Avatar atualizado com sucesso"
      });

    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: `Não foi possível fazer upload da imagem: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Salvar dados do perfil
  const handleSave = async () => {
    setIsLoading(true);

    try {
      const result = await updateProfile(formData);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Perfil atualizado com sucesso"
        });
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o perfil",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 8 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro", 
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso"
      });

      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a senha",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 pt-12" data-main-content>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e configurações
          </p>
        </div>

        {/* Avatar */}
        <Card>
          <CardHeader>
            <CardTitle>Foto do Perfil</CardTitle>
            <CardDescription>
              Esta será sua foto exibida no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage 
                    src={profile?.avatar_url} 
                    key={profile?.avatar_url} // Force re-render when URL changes
                  />
                  <AvatarFallback className="text-2xl">
                    {profile?.nome_completo?.charAt(0)?.toUpperCase() || 
                     profile?.email?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div>
                <h3 className="font-medium">Alterar foto</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Formatos aceitos: JPG, PNG. Máximo 5MB
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Escolher foto
                    </>
                  )}
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Informações Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Mantenha seus dados sempre atualizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome_completo" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome Completo
                </Label>
                <Input
                  id="nome_completo"
                  value={formData.nome_completo}
                  onChange={(e) => handleInputChange('nome_completo', e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Minhas Equipes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Minhas Equipes
              </CardTitle>
              <CardDescription>
                Equipes internas das quais você faz parte
              </CardDescription>
            </CardHeader>
            <CardContent>
              {equipesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : userEquipes.length > 0 ? (
                <div className="space-y-3">
                  {userEquipes.map((equipe) => (
                    <div key={equipe.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{equipe.equipes.nome}</p>
                        <p className="text-xs text-muted-foreground capitalize">{equipe.role}</p>
                      </div>
                      {equipe.is_primary && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Primária
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sem equipe interna</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Minha Atividade */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Minha Atividade
              </CardTitle>
              <CardDescription>
                Estatísticas de atendimento e atividade no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 border rounded-lg">
                      <Ticket className="h-8 w-8 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold">{activity.ticketsAtendidos}</div>
                      <div className="text-sm text-muted-foreground">Tickets Atendidos</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <MessageSquare className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{activity.respostasEnviadas}</div>
                      <div className="text-sm text-muted-foreground">Respostas Enviadas</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{activity.ultimasInteracoes.length}</div>
                      <div className="text-sm text-muted-foreground">Interações Recentes</div>
                    </div>
                  </div>

                  {activity.ultimasInteracoes.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Últimos Atendimentos</h4>
                      <div className="space-y-2">
                        {activity.ultimasInteracoes.map((interacao, index) => (
                          <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">#{interacao.codigo_ticket}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {interacao.mensagem_preview}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(interacao.created_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Segurança
              </CardTitle>
              <CardDescription>
                Altere sua senha e gerencie configurações de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Nova Senha
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handlePasswordChange} 
                  disabled={isChangingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  variant="outline"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Image Cropper */}
      {selectedImageFile && (
        <ImageCropper
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          onCrop={handleCroppedImage}
          imageFile={selectedImageFile}
        />
      )}
    </div>
  );
}