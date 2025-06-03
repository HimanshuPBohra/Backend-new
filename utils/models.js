export const aiModels = [
    {
        "name": "Anthropic: Claude 3.7 Sonnet",
        "logo": "/claude.png",
        "model": "anthropic/claude-3.7-sonnet",
        "cost": "$4.8/K input imgs"
    },
    {
        "name": "Google: Gemini Flash 2.0",
        "logo": "/gemini.png",
        "model": "google/gemini-2.0-flash-001",
        "cost": "$0.0258/K input imgs"
    },
    {
        "name": "xAI: Grok 2 Vision 1212",
        "logo": "/grok.png",
        "model": "x-ai/grok-2-vision-1212",
        "cost": "$3.6/K input imgs"
    },
    {
        "name": "Meta: Llama 3.2 90B Vision Instruct",
        "logo": "/metaai.png",
        "model": "meta-llama/llama-3.2-90b-vision-instruct",
        "cost": "$5.146/K input imgs"
    },
    // {
    //     "name": "OpenAI: GPT-4.5 (Preview)",
    //     "logo": "/openai.png",
    //     "model": "openai/gpt-4.5-preview",
    //     "cost": "$108.4/K input imgs"
    // },
    {
        "name": "OpenAI: ChatGPT-4.1",
        "logo": "/openai.png",
        "model": "openai/gpt-4.1",
        "cost": "$7.225/K input imgs"
    }
];

export const defaultAIModel = "openai/chatgpt-4o-latest";
