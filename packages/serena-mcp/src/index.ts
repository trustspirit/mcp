#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

// Type definitions for tool parameters
interface GetSymbolsOverviewParams {
  directory?: string;
  file_pattern?: string;
  include_private?: boolean;
}

interface FindSymbolParams {
  symbol_name: string;
  directory?: string;
  exact_match?: boolean;
}

interface GetSymbolDetailsParams {
  file_path: string;
  symbol_name: string;
  include_references?: boolean;
}

interface SearchCodeParams {
  query: string;
  directory?: string;
  file_pattern?: string;
  case_sensitive?: boolean;
  max_results?: number;
}

interface GetFileContentParams {
  file_path: string;
  start_line?: number;
  end_line?: number;
}

interface GetDirectoryStructureParams {
  directory?: string;
  max_depth?: number;
  include_hidden?: boolean;
}

interface FindReferencesParams {
  symbol_name: string;
  directory?: string;
  file_pattern?: string;
}

interface GetImportsParams {
  file_path: string;
}

interface GetExportsParams {
  file_path: string;
}

interface GetFunctionSignatureParams {
  file_path: string;
  function_name: string;
}

interface GetClassInfoParams {
  file_path: string;
  class_name: string;
}

interface AnalyzeCodeParams {
  file_path: string;
  analysis_type?: "complexity" | "dependencies" | "issues" | "all";
}

interface SearchAndReplaceParams {
  file_path: string;
  search_pattern: string;
  replace_with: string;
  is_regex?: boolean;
  preview_only?: boolean;
}

interface InsertCodeParams {
  file_path: string;
  line_number: number;
  code: string;
}

interface DeleteLinesParams {
  file_path: string;
  start_line: number;
  end_line: number;
}

interface GetWorkspaceInfoParams {
  directory?: string;
}

// Symbol type for code analysis
interface SymbolInfo {
  name: string;
  type: "function" | "class" | "variable" | "interface" | "type" | "enum" | "const" | "method" | "property";
  line: number;
  column?: number;
  endLine?: number;
  visibility?: "public" | "private" | "protected";
  documentation?: string;
}

// Get workspace root from environment or use current directory
const getWorkspaceRoot = (): string => {
  return process.env.SERENA_WORKSPACE || process.cwd();
};

// Resolve path relative to workspace
const resolvePath = (inputPath?: string): string => {
  const workspaceRoot = getWorkspaceRoot();
  if (!inputPath) return workspaceRoot;
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.join(workspaceRoot, inputPath);
};

// Parse file to extract symbols (simplified AST-like parsing)
const extractSymbols = (content: string, filePath: string): SymbolInfo[] => {
  const symbols: SymbolInfo[] = [];
  const lines = content.split("\n");
  const ext = path.extname(filePath).toLowerCase();

  // TypeScript/JavaScript patterns
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Function declarations
      const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        symbols.push({ name: funcMatch[1], type: "function", line: lineNum });
      }

      // Arrow functions assigned to const/let
      const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/);
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], type: "function", line: lineNum });
      }

      // Class declarations
      const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], type: "class", line: lineNum });
      }

      // Interface declarations
      const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) {
        symbols.push({ name: interfaceMatch[1], type: "interface", line: lineNum });
      }

      // Type declarations
      const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)\s*=/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], type: "type", line: lineNum });
      }

      // Enum declarations
      const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({ name: enumMatch[1], type: "enum", line: lineNum });
      }

      // Const declarations (non-arrow function)
      const constMatch = trimmed.match(/^(?:export\s+)?const\s+(\w+)\s*[=:]/);
      if (constMatch && !arrowMatch) {
        symbols.push({ name: constMatch[1], type: "const", line: lineNum });
      }
    });
  }

  // Python patterns
  if ([".py"].includes(ext)) {
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Function definitions
      const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
      if (funcMatch) {
        const isPrivate = funcMatch[1].startsWith("_");
        symbols.push({
          name: funcMatch[1],
          type: "function",
          line: lineNum,
          visibility: isPrivate ? "private" : "public",
        });
      }

      // Class definitions
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], type: "class", line: lineNum });
      }
    });
  }

  return symbols;
};

// Get files matching pattern
const getFiles = async (directory: string, pattern: string): Promise<string[]> => {
  const fullPattern = path.join(directory, pattern);
  return await glob(fullPattern, {
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
    nodir: true,
  });
};

// Create server instance
const server = new Server(
  {
    name: "serena-mcp",
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
        name: "get_symbols_overview",
        description:
          "Get an overview of all symbols (functions, classes, interfaces, etc.) in a directory. Provides a high-level view of the codebase structure.",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory to analyze (relative to workspace root). Defaults to workspace root.",
            },
            file_pattern: {
              type: "string",
              default: "**/*.{ts,tsx,js,jsx,py}",
              description: "Glob pattern for files to analyze",
            },
            include_private: {
              type: "boolean",
              default: false,
              description: "Include private symbols (those starting with _)",
            },
          },
        },
      },
      {
        name: "find_symbol",
        description:
          "Find a symbol by name across the codebase. Returns file locations and line numbers where the symbol is defined.",
        inputSchema: {
          type: "object",
          properties: {
            symbol_name: {
              type: "string",
              description: "Name of the symbol to find",
            },
            directory: {
              type: "string",
              description: "Directory to search in (relative to workspace root)",
            },
            exact_match: {
              type: "boolean",
              default: false,
              description: "If true, only exact matches are returned. Otherwise, partial matches are included.",
            },
          },
          required: ["symbol_name"],
        },
      },
      {
        name: "get_symbol_details",
        description:
          "Get detailed information about a specific symbol including its definition, documentation, and optionally its references.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file containing the symbol",
            },
            symbol_name: {
              type: "string",
              description: "Name of the symbol",
            },
            include_references: {
              type: "boolean",
              default: false,
              description: "Include references to this symbol from other files",
            },
          },
          required: ["file_path", "symbol_name"],
        },
      },
      {
        name: "search_code",
        description:
          "Search for a pattern across files in the codebase. Supports both literal text and regex patterns.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (text or regex pattern)",
            },
            directory: {
              type: "string",
              description: "Directory to search in (relative to workspace root)",
            },
            file_pattern: {
              type: "string",
              default: "**/*",
              description: "Glob pattern for files to search",
            },
            case_sensitive: {
              type: "boolean",
              default: false,
              description: "Whether the search is case-sensitive",
            },
            max_results: {
              type: "number",
              default: 50,
              description: "Maximum number of results to return",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_file_content",
        description:
          "Read the content of a file, optionally specifying a line range. Useful for viewing specific sections of code.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
            start_line: {
              type: "number",
              description: "Starting line number (1-based, inclusive)",
            },
            end_line: {
              type: "number",
              description: "Ending line number (1-based, inclusive)",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_directory_structure",
        description:
          "Get the directory structure as a tree. Useful for understanding the project layout.",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory to analyze (relative to workspace root)",
            },
            max_depth: {
              type: "number",
              default: 3,
              description: "Maximum depth to traverse",
            },
            include_hidden: {
              type: "boolean",
              default: false,
              description: "Include hidden files and directories",
            },
          },
        },
      },
      {
        name: "find_references",
        description:
          "Find all references to a symbol across the codebase. Useful for understanding how a function or class is used.",
        inputSchema: {
          type: "object",
          properties: {
            symbol_name: {
              type: "string",
              description: "Name of the symbol to find references for",
            },
            directory: {
              type: "string",
              description: "Directory to search in (relative to workspace root)",
            },
            file_pattern: {
              type: "string",
              default: "**/*.{ts,tsx,js,jsx,py}",
              description: "Glob pattern for files to search",
            },
          },
          required: ["symbol_name"],
        },
      },
      {
        name: "get_imports",
        description: "Get all import statements from a file. Useful for understanding dependencies.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_exports",
        description: "Get all exports from a file. Useful for understanding what a module provides.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_function_signature",
        description:
          "Get the signature of a function including parameters and return type. Works for TypeScript, JavaScript, and Python.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file containing the function",
            },
            function_name: {
              type: "string",
              description: "Name of the function",
            },
          },
          required: ["file_path", "function_name"],
        },
      },
      {
        name: "get_class_info",
        description:
          "Get detailed information about a class including its methods, properties, and inheritance.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file containing the class",
            },
            class_name: {
              type: "string",
              description: "Name of the class",
            },
          },
          required: ["file_path", "class_name"],
        },
      },
      {
        name: "analyze_code",
        description:
          "Analyze a file for code quality metrics including complexity, dependencies, and potential issues.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file to analyze",
            },
            analysis_type: {
              type: "string",
              enum: ["complexity", "dependencies", "issues", "all"],
              default: "all",
              description: "Type of analysis to perform",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "search_and_replace",
        description:
          "Search and replace text in a file. Can preview changes before applying them.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
            search_pattern: {
              type: "string",
              description: "Pattern to search for",
            },
            replace_with: {
              type: "string",
              description: "Replacement text",
            },
            is_regex: {
              type: "boolean",
              default: false,
              description: "Whether search_pattern is a regex",
            },
            preview_only: {
              type: "boolean",
              default: true,
              description: "If true, only preview changes without applying",
            },
          },
          required: ["file_path", "search_pattern", "replace_with"],
        },
      },
      {
        name: "insert_code",
        description: "Insert code at a specific line in a file.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
            line_number: {
              type: "number",
              description: "Line number where code should be inserted (1-based)",
            },
            code: {
              type: "string",
              description: "Code to insert",
            },
          },
          required: ["file_path", "line_number", "code"],
        },
      },
      {
        name: "delete_lines",
        description: "Delete a range of lines from a file.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file",
            },
            start_line: {
              type: "number",
              description: "Starting line number (1-based, inclusive)",
            },
            end_line: {
              type: "number",
              description: "Ending line number (1-based, inclusive)",
            },
          },
          required: ["file_path", "start_line", "end_line"],
        },
      },
      {
        name: "get_workspace_info",
        description:
          "Get information about the workspace including project structure, detected languages, and configuration files.",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory to analyze (defaults to workspace root)",
            },
          },
        },
      },
      {
        name: "list_tools",
        description: "List all available Serena tools and their descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Helper function to build directory tree
const buildDirectoryTree = (
  dir: string,
  currentDepth: number,
  maxDepth: number,
  includeHidden: boolean
): object => {
  const result: Record<string, unknown> = {};

  if (currentDepth >= maxDepth) return result;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith(".")) continue;
      if (["node_modules", "dist", "build", "__pycache__", ".git"].includes(entry.name)) continue;

      if (entry.isDirectory()) {
        result[entry.name + "/"] = buildDirectoryTree(
          path.join(dir, entry.name),
          currentDepth + 1,
          maxDepth,
          includeHidden
        );
      } else {
        result[entry.name] = null;
      }
    }
  } catch {
    // Permission denied or other error
  }

  return result;
};

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_symbols_overview": {
        const params = args as unknown as GetSymbolsOverviewParams;
        const directory = resolvePath(params.directory);
        const pattern = params.file_pattern || "**/*.{ts,tsx,js,jsx,py}";

        const files = await getFiles(directory, pattern);
        const symbolsByFile: Record<string, SymbolInfo[]> = {};

        for (const file of files) {
          try {
            const content = fs.readFileSync(file, "utf-8");
            let symbols = extractSymbols(content, file);

            if (!params.include_private) {
              symbols = symbols.filter(
                (s) => s.visibility !== "private" && !s.name.startsWith("_")
              );
            }

            if (symbols.length > 0) {
              const relativePath = path.relative(directory, file);
              symbolsByFile[relativePath] = symbols;
            }
          } catch {
            // Skip files that can't be read
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  workspace: directory,
                  total_files: Object.keys(symbolsByFile).length,
                  symbols_by_file: symbolsByFile,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "find_symbol": {
        const params = args as unknown as FindSymbolParams;
        const directory = resolvePath(params.directory);
        const pattern = "**/*.{ts,tsx,js,jsx,py}";

        const files = await getFiles(directory, pattern);
        const results: Array<{ file: string; symbol: SymbolInfo }> = [];

        for (const file of files) {
          try {
            const content = fs.readFileSync(file, "utf-8");
            const symbols = extractSymbols(content, file);

            for (const symbol of symbols) {
              const matches = params.exact_match
                ? symbol.name === params.symbol_name
                : symbol.name.toLowerCase().includes(params.symbol_name.toLowerCase());

              if (matches) {
                results.push({
                  file: path.relative(directory, file),
                  symbol,
                });
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: params.symbol_name,
                  exact_match: params.exact_match,
                  results_count: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_symbol_details": {
        const params = args as unknown as GetSymbolDetailsParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const symbols = extractSymbols(content, filePath);
        const symbol = symbols.find((s) => s.name === params.symbol_name);

        if (!symbol) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Symbol '${params.symbol_name}' not found in ${params.file_path}` },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const lines = content.split("\n");
        let endLine = symbol.line;

        // Find the end of the symbol definition
        let braceCount = 0;
        let started = false;
        for (let i = symbol.line - 1; i < lines.length; i++) {
          const line = lines[i];
          for (const char of line) {
            if (char === "{" || char === "(") {
              braceCount++;
              started = true;
            } else if (char === "}" || char === ")") {
              braceCount--;
            }
          }
          if (started && braceCount === 0) {
            endLine = i + 1;
            break;
          }
        }

        const definition = lines.slice(symbol.line - 1, endLine).join("\n");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  symbol: {
                    ...symbol,
                    endLine,
                    definition,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_code": {
        const params = args as unknown as SearchCodeParams;
        const directory = resolvePath(params.directory);
        const pattern = params.file_pattern || "**/*";
        const maxResults = params.max_results || 50;

        const files = await getFiles(directory, pattern);
        const results: Array<{ file: string; line: number; content: string }> = [];

        const regex = new RegExp(
          params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          params.case_sensitive ? "g" : "gi"
        );

        fileLoop: for (const file of files) {
          try {
            const content = fs.readFileSync(file, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: path.relative(directory, file),
                  line: i + 1,
                  content: lines[i].trim(),
                });

                if (results.length >= maxResults) break fileLoop;
              }
            }
          } catch {
            // Skip binary or unreadable files
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: params.query,
                  results_count: results.length,
                  truncated: results.length >= maxResults,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_file_content": {
        const params = args as unknown as GetFileContentParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        const startLine = params.start_line ? Math.max(1, params.start_line) : 1;
        const endLine = params.end_line ? Math.min(lines.length, params.end_line) : lines.length;

        const selectedLines = lines.slice(startLine - 1, endLine);
        const numberedLines = selectedLines.map((line, i) => `${startLine + i}|${line}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  total_lines: lines.length,
                  range: { start: startLine, end: endLine },
                  content: numberedLines.join("\n"),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_directory_structure": {
        const params = args as unknown as GetDirectoryStructureParams;
        const directory = resolvePath(params.directory);
        const maxDepth = params.max_depth || 3;
        const includeHidden = params.include_hidden || false;

        const tree = buildDirectoryTree(directory, 0, maxDepth, includeHidden);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  root: directory,
                  max_depth: maxDepth,
                  structure: tree,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "find_references": {
        const params = args as unknown as FindReferencesParams;
        const directory = resolvePath(params.directory);
        const pattern = params.file_pattern || "**/*.{ts,tsx,js,jsx,py}";

        const files = await getFiles(directory, pattern);
        const results: Array<{ file: string; line: number; content: string }> = [];

        const regex = new RegExp(`\\b${params.symbol_name}\\b`, "g");

        for (const file of files) {
          try {
            const content = fs.readFileSync(file, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: path.relative(directory, file),
                  line: i + 1,
                  content: lines[i].trim(),
                });
              }
            }
          } catch {
            // Skip unreadable files
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  symbol: params.symbol_name,
                  references_count: results.length,
                  references: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_imports": {
        const params = args as unknown as GetImportsParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const imports: Array<{ line: number; statement: string; source?: string }> = [];

        const ext = path.extname(filePath).toLowerCase();

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            // ES6 imports
            const esImportMatch = line.match(/^import\s+.*\s+from\s+['"](.+)['"]/);
            if (esImportMatch) {
              imports.push({ line: i + 1, statement: line, source: esImportMatch[1] });
            }

            // require statements
            const requireMatch = line.match(/require\s*\(\s*['"](.+)['"]\s*\)/);
            if (requireMatch) {
              imports.push({ line: i + 1, statement: line, source: requireMatch[1] });
            }
          } else if (ext === ".py") {
            // Python imports
            const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
            if (importMatch) {
              imports.push({
                line: i + 1,
                statement: line,
                source: importMatch[1] || importMatch[2].split(",")[0].trim(),
              });
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  imports_count: imports.length,
                  imports,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_exports": {
        const params = args as unknown as GetExportsParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const exports: Array<{ line: number; statement: string; name?: string }> = [];

        const ext = path.extname(filePath).toLowerCase();

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            // Named exports
            const namedExportMatch = line.match(/^export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
            if (namedExportMatch) {
              exports.push({ line: i + 1, statement: line, name: namedExportMatch[1] });
            }

            // Default exports
            if (line.startsWith("export default")) {
              exports.push({ line: i + 1, statement: line, name: "default" });
            }

            // Re-exports
            if (line.match(/^export\s+\{/)) {
              exports.push({ line: i + 1, statement: line });
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  exports_count: exports.length,
                  exports,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_function_signature": {
        const params = args as unknown as GetFunctionSignatureParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const ext = path.extname(filePath).toLowerCase();

        let signature: string | null = null;
        let lineNumber: number | null = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            // Match function declaration
            const funcMatch = line.match(
              new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${params.function_name}\\s*(<[^>]*>)?\\s*\\([^)]*\\)`)
            );
            if (funcMatch) {
              // Get the full signature including return type
              let sig = line.trim();
              if (!sig.includes("{")) {
                // Multi-line signature
                let j = i + 1;
                while (j < lines.length && !lines[j].includes("{")) {
                  sig += " " + lines[j].trim();
                  j++;
                }
              }
              signature = sig.replace(/\s*\{.*$/, "").trim();
              lineNumber = i + 1;
              break;
            }

            // Match arrow function
            const arrowMatch = line.match(
              new RegExp(`(?:export\\s+)?(?:const|let)\\s+${params.function_name}\\s*(?::\\s*[^=]+)?\\s*=\\s*(?:async\\s+)?`)
            );
            if (arrowMatch) {
              signature = line.trim().replace(/\s*=>\s*\{?.*$/, "").trim();
              lineNumber = i + 1;
              break;
            }
          } else if (ext === ".py") {
            const pyMatch = line.match(new RegExp(`def\\s+${params.function_name}\\s*\\([^)]*\\)`));
            if (pyMatch) {
              signature = line.trim().replace(/:$/, "").trim();
              lineNumber = i + 1;
              break;
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                signature
                  ? { file: params.file_path, function: params.function_name, line: lineNumber, signature }
                  : { error: `Function '${params.function_name}' not found in ${params.file_path}` },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_class_info": {
        const params = args as unknown as GetClassInfoParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const ext = path.extname(filePath).toLowerCase();

        let classInfo: {
          name: string;
          line: number;
          extends?: string;
          implements?: string[];
          methods: Array<{ name: string; line: number; visibility?: string }>;
          properties: Array<{ name: string; line: number; visibility?: string }>;
        } | null = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            const classMatch = line.match(
              new RegExp(`class\\s+${params.class_name}(?:\\s+extends\\s+(\\w+))?(?:\\s+implements\\s+([\\w,\\s]+))?`)
            );
            if (classMatch) {
              classInfo = {
                name: params.class_name,
                line: i + 1,
                extends: classMatch[1],
                implements: classMatch[2]?.split(",").map((s) => s.trim()),
                methods: [],
                properties: [],
              };

              // Find class body
              let braceCount = 0;
              let started = false;
              for (let j = i; j < lines.length; j++) {
                const bodyLine = lines[j];
                for (const char of bodyLine) {
                  if (char === "{") {
                    braceCount++;
                    started = true;
                  } else if (char === "}") {
                    braceCount--;
                  }
                }

                // Parse methods and properties
                const methodMatch = bodyLine.match(
                  /^\s*(public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/
                );
                if (methodMatch && !methodMatch[2].match(/^(if|for|while|switch)$/)) {
                  classInfo.methods.push({
                    name: methodMatch[2],
                    line: j + 1,
                    visibility: methodMatch[1],
                  });
                }

                const propMatch = bodyLine.match(/^\s*(public|private|protected)?\s*(\w+)\s*[=:]/);
                if (propMatch && !bodyLine.includes("(")) {
                  classInfo.properties.push({
                    name: propMatch[2],
                    line: j + 1,
                    visibility: propMatch[1],
                  });
                }

                if (started && braceCount === 0) break;
              }
              break;
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                classInfo
                  ? { file: params.file_path, class: classInfo }
                  : { error: `Class '${params.class_name}' not found in ${params.file_path}` },
                null,
                2
              ),
            },
          ],
        };
      }

      case "analyze_code": {
        const params = args as unknown as AnalyzeCodeParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const analysisType = params.analysis_type || "all";

        const analysis: {
          file: string;
          lines_of_code: number;
          complexity?: { cyclomatic: number; nesting_depth: number };
          dependencies?: string[];
          issues?: Array<{ line: number; type: string; message: string }>;
        } = {
          file: params.file_path,
          lines_of_code: lines.filter((l) => l.trim().length > 0).length,
        };

        if (analysisType === "complexity" || analysisType === "all") {
          let cyclomatic = 1;
          let maxNesting = 0;
          let currentNesting = 0;

          for (const line of lines) {
            // Cyclomatic complexity
            const decisionPoints = (line.match(/\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g) || []).length;
            cyclomatic += decisionPoints;

            // Nesting depth
            currentNesting += (line.match(/{/g) || []).length;
            currentNesting -= (line.match(/}/g) || []).length;
            maxNesting = Math.max(maxNesting, currentNesting);
          }

          analysis.complexity = { cyclomatic, nesting_depth: maxNesting };
        }

        if (analysisType === "dependencies" || analysisType === "all") {
          const deps: Set<string> = new Set();
          for (const line of lines) {
            const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
            if (importMatch) deps.add(importMatch[1]);
            const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (requireMatch) deps.add(requireMatch[1]);
          }
          analysis.dependencies = Array.from(deps);
        }

        if (analysisType === "issues" || analysisType === "all") {
          const issues: Array<{ line: number; type: string; message: string }> = [];

          lines.forEach((line, i) => {
            // Long lines
            if (line.length > 120) {
              issues.push({ line: i + 1, type: "style", message: "Line exceeds 120 characters" });
            }

            // console.log statements
            if (line.includes("console.log")) {
              issues.push({ line: i + 1, type: "warning", message: "console.log statement found" });
            }

            // TODO comments
            if (line.match(/\/\/\s*TODO/i)) {
              issues.push({ line: i + 1, type: "info", message: "TODO comment found" });
            }

            // Any type
            if (line.includes(": any")) {
              issues.push({ line: i + 1, type: "warning", message: "'any' type used" });
            }
          });

          analysis.issues = issues;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        };
      }

      case "search_and_replace": {
        const params = args as unknown as SearchAndReplaceParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const regex = params.is_regex
          ? new RegExp(params.search_pattern, "g")
          : new RegExp(params.search_pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

        const matches: Array<{ line: number; original: string; replaced: string }> = [];
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push({
              line: i + 1,
              original: lines[i],
              replaced: lines[i].replace(regex, params.replace_with),
            });
          }
          regex.lastIndex = 0;
        }

        if (!params.preview_only && matches.length > 0) {
          const newContent = content.replace(regex, params.replace_with);
          fs.writeFileSync(filePath, newContent, "utf-8");
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  search_pattern: params.search_pattern,
                  replace_with: params.replace_with,
                  matches_count: matches.length,
                  preview_only: params.preview_only,
                  applied: !params.preview_only && matches.length > 0,
                  changes: matches,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "insert_code": {
        const params = args as unknown as InsertCodeParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        if (params.line_number < 1 || params.line_number > lines.length + 1) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Invalid line number: ${params.line_number}. File has ${lines.length} lines.` },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const codeLines = params.code.split("\n");
        lines.splice(params.line_number - 1, 0, ...codeLines);
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  inserted_at_line: params.line_number,
                  lines_inserted: codeLines.length,
                  success: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "delete_lines": {
        const params = args as unknown as DeleteLinesParams;
        const filePath = resolvePath(params.file_path);

        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        if (params.start_line < 1 || params.end_line > lines.length || params.start_line > params.end_line) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: `Invalid line range: ${params.start_line}-${params.end_line}. File has ${lines.length} lines.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const deletedLines = lines.splice(params.start_line - 1, params.end_line - params.start_line + 1);
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: params.file_path,
                  deleted_range: { start: params.start_line, end: params.end_line },
                  lines_deleted: deletedLines.length,
                  success: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_workspace_info": {
        const params = args as unknown as GetWorkspaceInfoParams;
        const directory = resolvePath(params.directory);

        const configFiles = [
          "package.json",
          "tsconfig.json",
          "pyproject.toml",
          "requirements.txt",
          "Cargo.toml",
          "go.mod",
          ".gitignore",
          "Dockerfile",
          "docker-compose.yml",
        ];

        const foundConfigs: string[] = [];
        const languages: Set<string> = new Set();

        for (const config of configFiles) {
          if (fs.existsSync(path.join(directory, config))) {
            foundConfigs.push(config);
          }
        }

        // Detect languages from file extensions
        const allFiles = await glob("**/*.*", {
          cwd: directory,
          ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
          nodir: true,
        });

        const extCounts: Record<string, number> = {};
        for (const file of allFiles) {
          const ext = path.extname(file).toLowerCase();
          if (ext) {
            extCounts[ext] = (extCounts[ext] || 0) + 1;
            if ([".ts", ".tsx"].includes(ext)) languages.add("TypeScript");
            if ([".js", ".jsx", ".mjs"].includes(ext)) languages.add("JavaScript");
            if (ext === ".py") languages.add("Python");
            if (ext === ".rs") languages.add("Rust");
            if (ext === ".go") languages.add("Go");
            if ([".java", ".kt"].includes(ext)) languages.add("Java/Kotlin");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  workspace: directory,
                  total_files: allFiles.length,
                  detected_languages: Array.from(languages),
                  configuration_files: foundConfigs,
                  file_extensions: Object.entries(extCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([ext, count]) => ({ extension: ext, count })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_tools": {
        const tools = [
          { name: "get_symbols_overview", description: "Get overview of all symbols in the codebase" },
          { name: "find_symbol", description: "Find a symbol by name across files" },
          { name: "get_symbol_details", description: "Get detailed info about a specific symbol" },
          { name: "search_code", description: "Search for patterns across files" },
          { name: "get_file_content", description: "Read file content with optional line range" },
          { name: "get_directory_structure", description: "Get directory tree structure" },
          { name: "find_references", description: "Find all references to a symbol" },
          { name: "get_imports", description: "Get import statements from a file" },
          { name: "get_exports", description: "Get exports from a file" },
          { name: "get_function_signature", description: "Get function signature with parameters" },
          { name: "get_class_info", description: "Get class info including methods and properties" },
          { name: "analyze_code", description: "Analyze code for complexity, dependencies, issues" },
          { name: "search_and_replace", description: "Search and replace text in files" },
          { name: "insert_code", description: "Insert code at a specific line" },
          { name: "delete_lines", description: "Delete a range of lines from a file" },
          { name: "get_workspace_info", description: "Get workspace information and statistics" },
        ];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  server: "serena-mcp",
                  version: "0.1.0",
                  tools_count: tools.length,
                  tools,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
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
  const port = process.env.PORT || 3502;

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
      res.json({ status: "ok", server: "serena-mcp", workspace: getWorkspaceRoot() });
    });

    // Handle all MCP requests (GET for SSE stream, POST for messages, DELETE for session)
    app.all("/mcp", async (req, res) => {
      await transport.handleRequest(req, res, req.body);
    });

    app.listen(port, () => {
      console.error(`Serena MCP server running on HTTP port ${port}`);
      console.error(`Workspace: ${getWorkspaceRoot()}`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    });
  } else {
    // Default stdio mode
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Serena MCP server running on stdio");
    console.error(`Workspace: ${getWorkspaceRoot()}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

