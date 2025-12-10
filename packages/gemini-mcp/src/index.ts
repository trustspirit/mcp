#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  TaskType,
} from "@google/generative-ai";
import express from "express";
import cors from "cors";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Type definitions
interface GenerateContentParams {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

interface ChatParams {
  messages: Array<{
    role: "user" | "model";
    content: string;
  }>;
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface EmbedContentParams {
  content: string | string[];
  model?: string;
  taskType?:
    | "RETRIEVAL_QUERY"
    | "RETRIEVAL_DOCUMENT"
    | "SEMANTIC_SIMILARITY"
    | "CLASSIFICATION"
    | "CLUSTERING";
}

interface CountTokensParams {
  content: string;
  model?: string;
}

interface AnalyzeImageParams {
  imageUrl: string;
  prompt?: string;
  model?: string;
}

interface CreateVideoParams {
  prompt: string;
  model?: string;
  duration?: number;
  resolution?: string;
}

interface GenerateImageParams {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  negativePrompt?: string;
}

// Safety settings
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Create server instance
const server = new Server(
  {
    name: "gemini-mcp",
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
        name: "generate_content",
        description:
          "Generate text content using Google Gemini models. Supports various generation parameters.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The text prompt to generate content from",
            },
            model: {
              type: "string",
              default: "gemini-3.0-pro",
              description:
                "The Gemini model to use (gemini-3.0-pro, gemini-3.0-flash, gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash)",
            },
            systemInstruction: {
              type: "string",
              description: "System instruction to guide the model behavior",
            },
            temperature: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Controls randomness (0-2)",
            },
            maxOutputTokens: {
              type: "number",
              description: "Maximum number of tokens to generate",
            },
            topP: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Nucleus sampling parameter",
            },
            topK: {
              type: "number",
              description: "Top-k sampling parameter",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "chat",
        description:
          "Have a multi-turn conversation with Gemini. Supports conversation history.",
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
                    enum: ["user", "model"],
                  },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
              description: "Array of messages in the conversation",
            },
            model: {
              type: "string",
              default: "gemini-3.0-pro",
            },
            systemInstruction: {
              type: "string",
              description: "System instruction for the conversation",
            },
            temperature: {
              type: "number",
              minimum: 0,
              maximum: 2,
            },
            maxOutputTokens: {
              type: "number",
            },
          },
          required: ["messages"],
        },
      },
      {
        name: "embed_content",
        description:
          "Generate embeddings for text content. Useful for semantic search and similarity.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Text content to embed (string or array of strings)",
            },
            model: {
              type: "string",
              default: "text-embedding-004",
              description:
                "The embedding model to use (text-embedding-004, embedding-001)",
            },
            taskType: {
              type: "string",
              enum: [
                "RETRIEVAL_QUERY",
                "RETRIEVAL_DOCUMENT",
                "SEMANTIC_SIMILARITY",
                "CLASSIFICATION",
                "CLUSTERING",
              ],
              description: "The type of task for the embedding",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "count_tokens",
        description:
          "Count the number of tokens in a given text for a specific model.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The text to count tokens for",
            },
            model: {
              type: "string",
              default: "gemini-3.0-pro",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "analyze_image",
        description:
          "Analyze an image using Gemini's vision capabilities. Provide an image URL and a prompt.",
        inputSchema: {
          type: "object",
          properties: {
            imageUrl: {
              type: "string",
              description: "URL of the image to analyze",
            },
            prompt: {
              type: "string",
              default: "Describe this image in detail",
              description: "The prompt/question about the image",
            },
            model: {
              type: "string",
              default: "gemini-3.0-pro",
            },
          },
          required: ["imageUrl"],
        },
      },
      {
        name: "create_video",
        description:
          "Generate videos using Google Veo 3. Creates high-quality videos from text prompts.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "A text description of the desired video",
            },
            model: {
              type: "string",
              default: "veo-3",
              description: "The video generation model to use (veo-3)",
            },
            duration: {
              type: "number",
              minimum: 1,
              maximum: 60,
              default: 10,
              description: "Video duration in seconds",
            },
            resolution: {
              type: "string",
              enum: ["720p", "1080p"],
              default: "1080p",
              description: "Video resolution",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "generate_image",
        description:
          "Generate images using Imagen 3 (Nano Banana Pro). Creates high-quality images from text prompts.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "A text description of the desired image",
            },
            model: {
              type: "string",
              default: "imagen-3",
              description:
                "The image generation model to use (imagen-3, nano-banana-pro)",
            },
            aspectRatio: {
              type: "string",
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
              default: "1:1",
              description: "Image aspect ratio",
            },
            negativePrompt: {
              type: "string",
              description: "What to avoid in the generated image",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "list_models",
        description: "List available Gemini models",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { data: base64, mimeType: contentType };
}

// TaskType mapping
const taskTypeMap: Record<string, TaskType> = {
  RETRIEVAL_QUERY: TaskType.RETRIEVAL_QUERY,
  RETRIEVAL_DOCUMENT: TaskType.RETRIEVAL_DOCUMENT,
  SEMANTIC_SIMILARITY: TaskType.SEMANTIC_SIMILARITY,
  CLASSIFICATION: TaskType.CLASSIFICATION,
  CLUSTERING: TaskType.CLUSTERING,
};

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_content": {
        const params = args as unknown as GenerateContentParams;
        const modelName = params.model ?? "gemini-3.0-pro";
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: params.systemInstruction,
          safetySettings,
          generationConfig: {
            temperature: params.temperature,
            maxOutputTokens: params.maxOutputTokens,
            topP: params.topP,
            topK: params.topK,
          },
        });

        const result = await model.generateContent(params.prompt);
        const response = result.response;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  text: response.text(),
                  usageMetadata: response.usageMetadata,
                  finishReason: response.candidates?.[0]?.finishReason,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "chat": {
        const params = args as unknown as ChatParams;
        const modelName = params.model ?? "gemini-3.0-pro";
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: params.systemInstruction,
          safetySettings,
          generationConfig: {
            temperature: params.temperature,
            maxOutputTokens: params.maxOutputTokens,
          },
        });

        // Convert messages to Gemini format
        const history = params.messages.slice(0, -1).map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });
        const lastMessage = params.messages[params.messages.length - 1];
        const result = await chat.sendMessage(lastMessage.content);
        const response = result.response;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  text: response.text(),
                  usageMetadata: response.usageMetadata,
                  finishReason: response.candidates?.[0]?.finishReason,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "embed_content": {
        const params = args as unknown as EmbedContentParams;
        const modelName = params.model ?? "text-embedding-004";
        const model = genAI.getGenerativeModel({ model: modelName });

        const contents = Array.isArray(params.content)
          ? params.content
          : [params.content];

        const embeddings = await Promise.all(
          contents.map(async (text) => {
            const result = await model.embedContent({
              content: { parts: [{ text }], role: "user" },
              taskType: params.taskType
                ? taskTypeMap[params.taskType]
                : undefined,
            });
            return {
              embedding_length: result.embedding.values.length,
              embedding_preview: result.embedding.values.slice(0, 5),
            };
          })
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  model: modelName,
                  embeddings,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "count_tokens": {
        const params = args as unknown as CountTokensParams;
        const modelName = params.model ?? "gemini-3.0-pro";
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.countTokens(params.content);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalTokens: result.totalTokens,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "analyze_image": {
        const params = args as unknown as AnalyzeImageParams;
        const modelName = params.model ?? "gemini-3.0-pro";
        const model = genAI.getGenerativeModel({
          model: modelName,
          safetySettings,
        });

        const imageData = await fetchImageAsBase64(params.imageUrl);

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          },
          { text: params.prompt ?? "Describe this image in detail" },
        ]);

        const response = result.response;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  text: response.text(),
                  usageMetadata: response.usageMetadata,
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
        // Note: Veo 3 API integration placeholder
        // Google's Veo 3 API access requires specific setup through Google AI Studio
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "Veo 3 API integration requires Google AI Studio access. Please check ai.google.dev for the latest API documentation.",
                  model: params.model ?? "veo-3",
                  prompt: params.prompt,
                  duration: params.duration ?? 10,
                  resolution: params.resolution ?? "1080p",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "generate_image": {
        const params = args as unknown as GenerateImageParams;
        // Note: Imagen 3 (Nano Banana Pro) API integration placeholder
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "Imagen 3 / Nano Banana Pro API integration requires Google AI Studio access. Please check ai.google.dev for documentation.",
                  model: params.model ?? "imagen-3",
                  prompt: params.prompt,
                  aspectRatio: params.aspectRatio ?? "1:1",
                  negativePrompt: params.negativePrompt,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_models": {
        const models = [
          {
            id: "gemini-3.0-pro",
            description: "Gemini 3.0 Pro - Most advanced multimodal model",
          },
          {
            id: "gemini-3.0-flash",
            description: "Gemini 3.0 Flash - Fast and efficient 3.0 model",
          },
          {
            id: "gemini-2.0-flash-exp",
            description:
              "Gemini 2.0 Flash (experimental) - Advanced performance",
          },
          {
            id: "gemini-exp-1206",
            description: "Gemini experimental 2024-12-06 - Advanced reasoning",
          },
          {
            id: "gemini-1.5-pro-latest",
            description: "Gemini 1.5 Pro latest - Most capable 1.5 model",
          },
          {
            id: "gemini-1.5-pro",
            description: "Gemini 1.5 Pro - Stable version",
          },
          {
            id: "gemini-1.5-flash-latest",
            description: "Gemini 1.5 Flash latest - Fast and efficient",
          },
          {
            id: "gemini-1.5-flash",
            description: "Gemini 1.5 Flash - Stable version",
          },
          {
            id: "gemini-1.5-flash-8b",
            description: "Gemini 1.5 Flash 8B - Lightweight and fast",
          },
          {
            id: "text-embedding-004",
            description: "Text embedding model (768 dimensions)",
          },
          {
            id: "embedding-001",
            description: "Legacy embedding model",
          },
          {
            id: "veo-3",
            description: "Veo 3 - Advanced video generation model",
          },
          {
            id: "imagen-3",
            description: "Imagen 3 - High-quality image generation",
          },
          {
            id: "nano-banana-pro",
            description: "Nano Banana Pro - Fast image generation",
          },
        ];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ models }, null, 2),
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
  const port = process.env.PORT || 3501;

  if (mode === "http") {
    // HTTP/SSE mode for external access
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get("/health", (_req, res) => {
      res.json({ status: "ok", server: "gemini-mcp" });
    });

    app.post("/sse", async (req, res) => {
      const transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
    });

    app.listen(port, () => {
      console.error(`Gemini MCP server running on HTTP port ${port}`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`SSE endpoint: http://localhost:${port}/sse`);
    });
  } else {
    // Default stdio mode
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gemini MCP server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
