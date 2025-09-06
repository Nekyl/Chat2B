# Chat 2B 

Um front-end de chat, 100% client-side, para interagir com as APIs do Google Gemini e instâncias locais do Ollama.

O projeto foi criado com uma persona de IA customizada: espirituosa, sarcástica e divertida, visando uma experiência de conversação mais natural e envolvente do que a de assistentes tradicionais.

## ✨ Features

*   **Dual Backend: Gemini & Ollama:** Conecte-se à API do **Google Gemini** ou a qualquer instância local/remota do **Ollama**, com suporte para endpoints customizados (`http/https`).
*   **Suporte a Vision (Multimodal):** Envie imagens anexando arquivos ou colando diretamente no chat ao usar modelos Gemini com capacidade de visão.
*   **Progressive Web App (PWA):** Instale o chat como um aplicativo de desktop ou mobile para acesso rápido e uma experiência mais nativa.
*   **Renderização de Código Avançada:** Suporte a Markdown, syntax highlighting e um botão para copiar o conteúdo dos blocos de código.
*   **Gerenciamento Completo de Chats:** Histórico salvo localmente, com funcionalidades para criar, renomear, exportar e realizar buscas em todas as conversas.
*   **IA Customizável:** Altere o Prompt do Sistema e a Temperatura do modelo diretamente nas configurações para ajustar a persona da IA.

## 🚀 Recommended Models

Para obter a melhor experiência e extrair o máximo da persona customizada, o uso dos seguintes modelos é altamente recomendado:

*   **Gemini 2.5 Flash** ou **Gemini 2.5 Pro**

## ⚙️ Getting Started

Este projeto é 100% client-side, sem necessidade de build steps.

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Nekyl/2B-Chat.git
    ```

2.  **Abra o `index.html`:**
    *   A maneira mais simples é usar uma extensão como o **Live Server** no VS Code para servir os arquivos localmente.
    *   Alternativamente, abrir o `index.html` diretamente no navegador deve funcionar.

### Configuration

Ao abrir o aplicativo, configure sua fonte de API no campo de texto superior:

*   **Para usar o Gemini:**
    1.  Digite `gemini` no campo de fonte.
    2.  Na primeira vez que enviar uma mensagem, o aplicativo solicitará sua **Chave de API do Google AI Studio**. Ela será salva localmente no seu navegador.

*   **Para usar Ollama:**
    1.  Certifique-se de que sua instância do Ollama está em execução.
    2.  Digite `ollama` para usar o endereço padrão (`http://localhost:11434`) ou insira a URL completa do seu servidor Ollama.
