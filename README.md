# Chat2B

> **Acesse agora:** [nekyl.github.io/Chat2B](https://nekyl.github.io/Chat2B/)

O **Chat2B** é um front-end de chat moderno, **100% client-side**, projetado para oferecer uma interface rápida, privada e altamente customizável para interagir com os principais modelos de linguagem do mercado. Seja usando APIs de nuvem ou modelos rodando localmente, o Chat2B coloca o controle na sua mão.

A experiência é centrada na **2B**, uma persona de IA exclusiva: espirituosa, sarcástica e divertida. Diferente de assistentes tradicionais e robóticos, a 2B foi refinada para ser uma companhia envolvente, capaz de equilibrar deboche inteligente com suporte técnico de alta qualidade.

---

## 🚀 Diferenciais e Possibilidades

### 🌐 Compatibilidade Universal (OpenAI SDK & Mais)
O Chat2B não está limitado a um único provedor. Ele é compatível com qualquer serviço que siga o padrão de API da OpenAI, além de suporte nativo para:
*   **Google Gemini:** Integração total com modelos 1.5 e 2.0 (Flash/Pro).
*   **OpenAI:** Use GPT-4o, GPT-4 Turbo e outros via chave de API oficial.
*   **Groq & xAI (Grok):** Performance extrema com modelos Llama 3 e Grok.
*   **Endpoints Customizados:** Conecte-se a qualquer gateway compatível com o SDK da OpenAI apenas inserindo a URL.

### 🏠 Poder Local com Ollama e LM Studio
Privacidade total e custo zero. O Chat2B integra-se perfeitamente com instâncias locais:
*   **Ollama:** Suporte nativo para detecção de modelos e streaming.
*   **LM Studio / LocalAI:** Basta apontar para o endpoint local (ex: `http://localhost:1234/v1`) para usar seus modelos locais com a interface fluida do Chat2B.

### 🖼️ Visão e Multimodalidade
*   **Suporte a Vision:** Anexe imagens (upload ou colar) para análise detalhada em modelos compatíveis (Gemini, GPT-4o, etc).
*   **Edição Integrada:** Ferramenta de crop e ajuste de imagem antes do envio.
*   **Suporte a Vídeo:** Envio de pequenos clipes para modelos que suportam entrada de vídeo (Gemini).

### 📱 Experiência PWA (Instalável)
Transforme o Chat2B em um aplicativo nativo no seu Windows, Mac, Android ou iOS. Graças ao suporte a **Progressive Web App**, você tem acesso rápido sem precisar abrir o navegador toda vez.

---

## ✨ Funcionalidades Principais

*   **Zero Backend:** Suas chaves de API e históricos nunca saem do seu navegador. Tudo é processado localmente.
*   **Persona Ajustável:** Além da 2B, você pode modificar o *System Prompt* e a *Temperatura* globalmente ou por chat para moldar o comportamento da IA.
*   **Busca Global:** Encontre qualquer termo em todas as suas conversas passadas instantaneamente.

---

## ⚙️ Como Começar

### Versão Web (Recomendado)
Acesse [nekyl.github.io/Chat2B](https://nekyl.github.io/Chat2B/) e comece a usar imediatamente. Suas configurações serão salvas no `localStorage` do navegador.

### Rodando Localmente
Se preferir hospedar você mesmo ou modificar o código:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Nekyl/Chat2B.git
    ```
2.  **Abra o `index.html`:**
    *   Recomendamos usar a extensão **Live Server** no VS Code.
    *   Ou apenas abra o arquivo diretamente no navegador.

### Configuração de API
No campo de fonte (topo da tela), você pode digitar:
*   `gemini`, `openai`, `groq` ou `grok` para usar os provedores oficiais.
*   `ollama` ou `localhost:11434` para sua instância local do Ollama.
*   Uma URL completa (ex: `https://sua-api.com/v1`) para provedores customizados.

---

## 🛠️ Tecnologias Utilizadas

*   **Vanilla JS / CSS / HTML:** Sem frameworks pesados, garantindo velocidade instantânea.
*   **Marked.js:** Para um processamento de Markdown robusto.
*   **Highlight.js:** Para blocos de código elegantes.
*   **FontAwesome:** Iconografia profissional.

