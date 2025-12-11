#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import express from "express";
import cors from "cors";
import { OPENAI_MODELS, getAllModels } from "./models.js";

// 카테고리별 최신 (기본) 모델
const DEFAULT_MODELS = {
  chat: OPENAI_MODELS.gpt[0].name, // gpt-5.1
  coding: OPENAI_MODELS.coding[0].name, // gpt-5.1-codex
  image: OPENAI_MODELS.image[0].name, // gpt-image-1
  video: OPENAI_MODELS.video[0].name, // sora-2
  audio: OPENAI_MODELS.audio[0].name, // gpt-realtime
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Type definitions
interface ChatCompletionParams {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

interface CreateImageParams {
  prompt: string;
  model?: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  n?: number;
}

interface CreateEmbeddingParams {
  input: string | string[];
  model?: string;
}

interface TextToSpeechParams {
  input: string;
  model?: "tts-1" | "tts-1-hd";
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
}

interface CreateVideoParams {
  prompt: string;
  model?: string;
  size?: "1280x720" | "1920x1080";
  seconds?: number;
}

// Create server instance
const server = new Server(
  {
    name: "openai-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "chat_completion",
        description: `Generate a chat completion using OpenAI's GPT models. IMPORTANT: Always use the default model (${DEFAULT_MODELS.chat}) unless the user explicitly requests a different model.`,
        inputSchema: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: {
                    type: "string",
                    enum: ["system", "user", "assistant"],
                  },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
              description: "Array of messages in the conversation",
            },
            model: {
              type: "string",
              default: DEFAULT_MODELS.chat,
              description: `ALWAYS use the default value unless user explicitly requests another model. Default: ${DEFAULT_MODELS.chat}`,
            },
            temperature: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Sampling temperature (0-2)",
            },
            max_tokens: {
              type: "number",
              description: "Maximum tokens to generate",
            },
          },
          required: ["messages"],
        },
      },
      {
        name: "create_image",
        description: `Generate images using OpenAI's image models. IMPORTANT: Always use the default model (${DEFAULT_MODELS.image}) unless the user explicitly requests a different model.`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "A text description of the desired image",
            },
            model: {
              type: "string",
              enum: OPENAI_MODELS.image.map((m) => m.name),
              default: DEFAULT_MODELS.image,
              description: `ALWAYS use the default value unless user explicitly requests another model. Default: ${DEFAULT_MODELS.image}`,
            },
            size: {
              type: "string",
              enum: [
                "256x256",
                "512x512",
                "1024x1024",
                "1792x1024",
                "1024x1792",
              ],
              default: "1024x1024",
            },
            quality: {
              type: "string",
              enum: ["standard", "hd"],
              default: "standard",
            },
            n: {
              type: "number",
              minimum: 1,
              maximum: 10,
              default: 1,
              description: "Number of images to generate",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "create_embedding",
        description:
          "Create embeddings for text using OpenAI's embedding models. IMPORTANT: Always use the default model (text-embedding-3-large) for best quality.",
        inputSchema: {
          type: "object",
          properties: {
            input: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Text to embed (string or array of strings)",
            },
            model: {
              type: "string",
              default: "text-embedding-3-large",
              description:
                "ALWAYS use the default value (text-embedding-3-large) for best quality.",
            },
          },
          required: ["input"],
        },
      },
      {
        name: "text_to_speech",
        description:
          "Convert text to speech using OpenAI's TTS models. IMPORTANT: Always use the default model and voice for best quality.",
        inputSchema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "The text to generate audio for",
            },
            model: {
              type: "string",
              enum: ["tts-1", "tts-1-hd"],
              default: "tts-1-hd",
              description:
                "ALWAYS use the default value (tts-1-hd) for high quality.",
            },
            voice: {
              type: "string",
              enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
              default: "nova",
              description:
                "ALWAYS use the default value (nova) for natural sound.",
            },
          },
          required: ["input"],
        },
      },
      {
        name: "create_video",
        description: `Generate videos using OpenAI's Sora models. IMPORTANT: Always use the default model (${DEFAULT_MODELS.video}) unless the user explicitly requests a different model.`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "A text description of the desired video",
            },
            model: {
              type: "string",
              enum: OPENAI_MODELS.video.map((m) => m.name),
              default: DEFAULT_MODELS.video,
              description: `ALWAYS use the default value unless user explicitly requests another model. Default: ${DEFAULT_MODELS.video}`,
            },
            size: {
              type: "string",
              enum: ["1280x720", "1920x1080"],
              default: "1920x1080",
              description:
                "ALWAYS use the default value (1920x1080) for best quality.",
            },
            seconds: {
              type: "number",
              minimum: 1,
              maximum: 60,
              default: 10,
              description: "Video duration in seconds (1-60)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "list_models",
        description: "List all available OpenAI models",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "chat_completion": {
        const params = args as unknown as ChatCompletionParams;
        const response = await openai.chat.completions.create({
          model: params.model ?? DEFAULT_MODELS.chat,
          messages: params.messages,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: response.id,
                  model: response.model,
                  message: response.choices[0]?.message,
                  usage: response.usage,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_image": {
        const params = args as unknown as CreateImageParams;
        const response = await openai.images.generate({
          model: params.model ?? DEFAULT_MODELS.image,
          prompt: params.prompt,
          size: params.size ?? "1024x1024",
          quality: params.quality ?? "standard",
          n: params.n ?? 1,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  created: response.created,
                  images: (response.data ?? []).map((img) => ({
                    url: img.url,
                    revised_prompt: img.revised_prompt,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_embedding": {
        const params = args as unknown as CreateEmbeddingParams;
        const response = await openai.embeddings.create({
          model: params.model ?? "text-embedding-3-large",
          input: params.input,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  model: response.model,
                  embeddings: response.data.map((d) => ({
                    index: d.index,
                    embedding_length: d.embedding.length,
                    embedding_preview: d.embedding.slice(0, 5),
                  })),
                  usage: response.usage,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "text_to_speech": {
        const params = args as unknown as TextToSpeechParams;
        const response = await openai.audio.speech.create({
          model: params.model ?? "tts-1",
          voice: params.voice ?? "alloy",
          input: params.input,
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        const base64Audio = buffer.toString("base64");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  format: "mp3",
                  base64_length: base64Audio.length,
                  audio_base64: base64Audio,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_video": {
        const params = args as unknown as CreateVideoParams;
        const selectedModel = params.model ?? DEFAULT_MODELS.video;
        // Note: Sora 2 API endpoint - this is a placeholder as the actual API might differ
        // Users should check OpenAI's official documentation for the correct endpoint
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "Sora 2 API integration requires OpenAI API access. Please check platform.openai.com/docs for the latest API documentation.",
                  model: selectedModel,
                  prompt: params.prompt,
                  size: params.size ?? "1280x720",
                  seconds: params.seconds ?? 10,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_models": {
        // 카테고리별 모델 목록 반환
        const categorizedModels = {
          gpt: OPENAI_MODELS.gpt,
          coding: OPENAI_MODELS.coding,
          research: OPENAI_MODELS.research,
          image: OPENAI_MODELS.image,
          video: OPENAI_MODELS.video,
          audio: OPENAI_MODELS.audio,
          etc: OPENAI_MODELS.etc,
        };

        // 기본 모델 정보
        const defaults = {
          chat: DEFAULT_MODELS.chat,
          coding: DEFAULT_MODELS.coding,
          image: DEFAULT_MODELS.image,
          video: DEFAULT_MODELS.video,
          audio: DEFAULT_MODELS.audio,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  defaults,
                  models: categorizedModels,
                  total_count: getAllModels().length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const mode = process.env.MCP_MODE || "stdio";
  const port = process.env.PORT || 3500;

  if (mode === "http") {
    // HTTP mode with StreamableHTTPServerTransport
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Stateless mode - 여러 클라이언트 연결 지원
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    app.get("/health", (_req, res) => {
      res.json({ status: "ok", server: "openai-mcp" });
    });

    // Handle all MCP requests (GET for SSE stream, POST for messages, DELETE for session)
    app.all("/mcp", async (req, res) => {
      await transport.handleRequest(req, res, req.body);
    });

    app.listen(port, () => {
      console.error(`OpenAI MCP server running on HTTP port ${port}`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    });
  } else {
    // Default stdio mode
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("OpenAI MCP server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
