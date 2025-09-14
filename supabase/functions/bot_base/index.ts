import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const body = await req.json();
    const rawMessage = body?.text?.message || "";
    const normalized = rawMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // tira acento
      .replace(/[^a-z0-9]/g, "_"); // vira snake_case simples

    console.log("📩 Mensagem recebida:", rawMessage, "→", normalized);

    // Palavras-chave aceitas
    const KEYWORDS = ["menu", "ola_robo", "olá_robo", "abacate"];

    if (KEYWORDS.includes(normalized)) {
      const phone = body?.phone || body?.participantPhone;
      if (!phone) {
        return new Response("Número não encontrado", { status: 400 });
      }

      // 1. Enviar sticker
      const stickerRes = await fetch(
        `${Deno.env.get("ZAPI_INSTANCE_URL")}/send-sticker`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": Deno.env.get("ZAPI_TOKEN") || "",
          },
          body: JSON.stringify({
            phone,
            sticker:
              "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/figurinha-girabot.webp",
          }),
        }
      );
      console.log("📎 Sticker enviado:", stickerRes.status);

      // 2. Enviar menu principal
      const menuRes = await fetch(
        `${Deno.env.get("ZAPI_INSTANCE_URL")}/send-button-list`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": Deno.env.get("ZAPI_TOKEN") || "",
          },
          body: JSON.stringify({
            phone,
            message:
              "👋 Oi! Eu sou o *GiraBot*, seu assistente automático da *Cresci e Perdi*.\n\nAs opções de atendimento mudaram. Como prefere seguir?",
            buttonList: {
              buttons: [
                { id: "autoatendimento_menu", label: "⚡ Autoatendimento" },
                { id: "personalizado_menu", label: "🤵 Atendimento Personalizado" },
                { id: "emergencia_menu", label: "🚨 Estou em Emergência" },
              ],
            },
          }),
        }
      );
      console.log("📋 Menu enviado:", menuRes.status);

      return new Response(
        JSON.stringify({ success: true, step: "menu_principal" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Se não for palavra-chave
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no bot_base:", err);
    return new Response("Erro interno", { status: 500 });
  }
});