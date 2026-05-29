/**
 * Pi 内置工具中文翻译扩展
 *
 * 通过 before_provider_request 事件，在将请求发送给 LLM 之前，
 * 将 payload 中 read / bash / edit / write 四个内置工具的
 * description 和 parameters.properties.*.description 翻译为中文。
 *
 * 这样不覆写工具本身，内置工具的执行逻辑、settings.json 读取等完全不受影响。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── 中文翻译对照表 ────────────────────────────────────────────

const TRANSLATIONS: Record<
  string,
  { description: string; params: Record<string, string> }
> = {
  read: {
    description:
      "读取文件内容。支持文本文件和图片（jpg、png、gif、webp）。图片作为附件发送。对于文本文件，输出截断为 2000 行或 50KB（以先到者为准）。对于大文件请使用 offset/limit 参数。当需要读取完整文件时，请继续使用 offset 直到读取完毕。",
    params: {
      path: "要读取的文件路径（相对或绝对路径）",
      offset: "开始读取的行号（从 1 开始）",
      limit: "要读取的最大行数",
    },
  },
  bash: {
    description:
      "在当前工作目录中执行 bash 命令。返回标准输出和标准错误。输出截断为最后 2000 行或 50KB（以先到者为准）。如果被截断，完整输出会保存到临时文件中。可选择设置超时时间（秒）。",
    params: {
      command: "要执行的 bash 命令",
      timeout: "超时时间（秒，可选，默认无超时）",
    },
  },
  edit: {
    description:
      "使用精确文本替换编辑单个文件。每个 edits[].oldText 必须匹配原始文件中唯一的、不重叠的区域。如果两处修改影响同一代码块或相邻行，请将它们合并为一个 edit，而不是发出重叠的编辑。不要包含大段未修改的文本仅仅为了连接相距较远的修改。",
    params: {
      path: "要编辑的文件路径（相对或绝对路径）",
      edits: "一个或多个目标替换操作。每个 edit 与原始文件匹配（非增量匹配）。不要包含重叠或嵌套的编辑。如果两处修改触及同一代码块或相邻行，请合并成一个 edit。",
      oldText:
        "要替换的精确文本。必须在原始文件中唯一，且不能与同一次调用中的其他 edits[].oldText 重叠。",
      newText: "替换后的目标文本。",
    },
  },
  write: {
    description:
      "将内容写入文件。如果文件不存在则创建，如果已存在则覆盖。自动创建父目录。",
    params: {
      path: "要写入的文件路径（相对或绝对路径）",
      content: "要写入文件的内容",
    },
  },
};

/**
 * 递归遍历对象，对匹配的字段进行中文翻译。
 * 处理两种常见 payload 格式：
 *   Anthropic: { tools: [{ name, description, input_schema: { properties } }] }
 *   OpenAI:    { tools: [{ function: { name, description, parameters: { properties } } }] }
 */
function translateTools(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;

  // ── 处理 tools 数组 ──
  const tools = (obj as Record<string, unknown>).tools;
  if (Array.isArray(tools)) {
    for (const tool of tools) {
      if (!tool || typeof tool !== "object") continue;
      const t = tool as Record<string, unknown>;

      // 定位 description 和 properties 所在的对象
      let descObj: Record<string, unknown> | undefined;
      let props: Record<string, unknown> | undefined;

      if (t.function && typeof t.function === "object") {
        // OpenAI 格式: { type: "function", function: { name, description, parameters: { properties } } }
        descObj = t.function as Record<string, unknown>;
        const params = (descObj as Record<string, unknown>)
          .parameters as Record<string, unknown> | undefined;
        if (params && typeof params === "object") {
          props = params.properties as Record<string, unknown> | undefined;
        }
      } else {
        // Anthropic 格式: { name, description, input_schema: { properties } }
        descObj = t;
        const schema = t.input_schema as Record<string, unknown> | undefined;
        if (schema && typeof schema === "object") {
          props = schema.properties as Record<string, unknown> | undefined;
        }
      }

      // 翻译 description
      const name = descObj?.name as string | undefined;
      if (name && typeof name === "string" && TRANSLATIONS[name]) {
        const trans = TRANSLATIONS[name];
        if (descObj && typeof descObj.description === "string") {
          descObj.description = trans.description;
        }

        // 翻译各参数 description
        if (props && typeof props === "object") {
          for (const [propName, propDef] of Object.entries(props)) {
            if (
              propDef &&
              typeof propDef === "object" &&
              typeof (propDef as Record<string, unknown>).description === "string"
            ) {
              const paramTrans = trans.params[propName];
              if (paramTrans) {
                (propDef as Record<string, unknown>).description = paramTrans;
              }
            }
            // edits 数组中的 items 对象（oldText / newText）
            if (
              propDef &&
              typeof propDef === "object" &&
              (propDef as Record<string, unknown>).type === "array"
            ) {
              const items = (propDef as Record<string, unknown>)
                .items as Record<string, unknown> | undefined;
              if (items && typeof items === "object") {
                const itemProps = items.properties as
                  | Record<string, unknown>
                  | undefined;
                if (itemProps && typeof itemProps === "object") {
                  for (const [itemName, itemDef] of Object.entries(itemProps)) {
                    if (
                      itemDef &&
                      typeof itemDef === "object" &&
                      typeof (itemDef as Record<string, unknown>).description === "string"
                    ) {
                      const itemTrans = trans.params[itemName];
                      if (itemTrans) {
                        (itemDef as Record<string, unknown>).description =
                          itemTrans;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event) => {
    translateTools(event.payload);
    // return undefined — 保持 payload 引用不变，已原地修改
  });
}
