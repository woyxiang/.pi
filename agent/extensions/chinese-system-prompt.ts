export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    let p = event.systemPrompt;

    // Skills
    p = p.replace(
      "The following skills provide specialized instructions for specific tasks.",
      "skill 为特定任务提供指导"
    );
    p = p.replace(
      "Use the read tool to load a skill's file when the task matches its description.",
      "若任务匹配其描述，用 read 读取 skill 文件。"
    );
    p = p.replace(
      "When a skill file references a relative path, resolve it against the skill directory",
      "引用相对路径时，以 SKILL.md 所在目录为基准，"
    );
    p = p.replace(
      " (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
      "转换为绝对路径后使用。"
    );

    // 时间和路径
    p = p.replace(
      "Current date",
      "今日"
    );

    p = p.replace(
      "Current working directory",
      "当前目录"
    );

    return { systemPrompt: p };
  });
}